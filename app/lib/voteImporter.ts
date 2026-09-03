/**
 * Core vote import + score calculation logic.
 * Used by both the admin server actions and the auto-import cron.
 * No authentication here — callers must verify auth themselves.
 */

import { revalidatePath } from "next/cache";
import { getDb } from "./db";
import { scrapeVotesWithMeta } from "./scraper";
import {
  calculateFantavoto,
  calculateGoalBonus,
  calculateDefenseModifier,
  convertScoreToGoals,
  computeAutoSubstitutions,
  DEFAULT_GOAL_THRESHOLDS,
  DEFAULT_SCORE_CONVERSION,
  type GoalThreshold,
  type ScoreConversion,
} from "./scoring";

/** Tetto assoluto alle sostituzioni automatiche per assenti/sv, a prescindere
 * da cosa sia impostato in LeagueSettings (vedi anche il clamp in
 * saveLeagueSettings — questo è la seconda linea di difesa, a valori già
 * salvati prima che il limite esistesse). */
const HARD_MAX_SUBSTITUTIONS = 5;

export interface ImportResult {
  matched: number;
  unmatched: number;
  matchdayNumber: number;
  /** Nomi (così come mostrati da fantapiu3) dei voti non abbinati a nessun giocatore in rosa. */
  unmatchedNames: string[];
}

/**
 * Prefisso dell'errore lanciato quando la giornata mostrata da fantapiu3 non
 * corrisponde alla giornata che si sta importando. Il chiamante (server
 * action / cron) lo riconosce da questo prefisso per offrire una scelta
 * esplicita ("importa comunque") invece di un errore generico — vedi
 * `force` sotto.
 */
export const MISMATCH_PREFIX = "MISMATCH_GIORNATA:";

// ── Import scraped votes for a matchday ────────────────────────────────────
export async function importVotesCore(
  matchdayId: number,
  matchdayNumber: number,
  options?: { force?: boolean }
): Promise<ImportResult> {
  const { votes: scraped, detectedMatchday } = await scrapeVotesWithMeta();
  if (scraped.length === 0) {
    throw new Error("Nessun voto trovato sul sito. Riprova più tardi.");
  }

  // Il sito fantapiu3 mostra sempre e solo l'ultima giornata disponibile (non
  // permette di consultarne di precedenti): se non corrisponde alla giornata
  // che si sta importando, i voti sarebbero abbinati alla giornata sbagliata.
  // Di default blocchiamo qui (nessuna scrittura è ancora avvenuta) invece di
  // salvare dati sbagliati silenziosamente — ma chi importa può scegliere
  // esplicitamente di procedere comunque (es. numerazione delle giornate
  // diversa tra il proprio campionato e quello ufficiale) passando force:true.
  if (!options?.force && detectedMatchday !== null && detectedMatchday !== matchdayNumber) {
    throw new Error(`${MISMATCH_PREFIX}${detectedMatchday}`);
  }

  const db = getDb();
  const playersRes = await db.execute(
    `SELECT id, name, fantapiu3Name, mantraRole FROM "Player"`
  );
  const players = playersRes.rows;

  let matched = 0;
  let unmatched = 0;
  const unmatchedNames: string[] = [];

  for (const vote of scraped) {
    const player = players.find(
      (p) =>
        (p.fantapiu3Name && p.fantapiu3Name === vote.name) ||
        p.name === vote.name
    );

    if (!player) {
      unmatched++;
      unmatchedNames.push(vote.name);
      continue;
    }

    const fantavoto = calculateFantavoto(
      {
        vote: vote.vote,
        fantavoto: vote.fantavoto,
        gfGs: vote.gfGs,
        gsr: vote.gsr,
        amm: vote.amm,
        esp: vote.esp,
        rpRs: vote.rpRs,
        aut: vote.aut,
        ass: vote.ass,
        adf: vote.adf,
      },
      player.mantraRole as string
    );

    await db.execute({
      sql: `INSERT OR REPLACE INTO "PlayerVote"
            (playerId, matchdayId, vote, fantavoto, gfGs, gsr, amm, esp, rpRs, aut, ass, adf)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        player.id,
        matchdayId,
        vote.vote,
        fantavoto,
        vote.gfGs,
        vote.gsr,
        vote.amm,
        vote.esp,
        vote.rpRs,
        vote.aut,
        vote.ass,
        vote.adf,
      ],
    });
    matched++;
  }

  await db.execute({
    sql: `UPDATE "Matchday" SET votesImported = 1 WHERE id = ?`,
    args: [matchdayId],
  });

  return { matched, unmatched, matchdayNumber, unmatchedNames };
}

// ── Auto-generate best lineup for users who didn't submit ─────────────────
async function autoGenerateLineup(
  userId: number,
  matchdayId: number,
  db: ReturnType<typeof getDb>
) {
  const existing = await db.execute({
    sql: `SELECT id FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
    args: [userId, matchdayId],
  });
  if (existing.rows.length > 0) return;

  const rosterRes = await db.execute({
    sql: `SELECT p.id, p.mantraRole, COALESCE(pv.fantavoto, 0) as fv, pv.fantavoto as hasFv
          FROM "Roster" r
          JOIN "Player" p ON p.id = r.playerId
          LEFT JOIN "PlayerVote" pv ON pv.playerId = p.id AND pv.matchdayId = ?
          WHERE r.userId = ?
          ORDER BY COALESCE(pv.fantavoto, 0) DESC`,
    args: [matchdayId, userId],
  });

  if (rosterRes.rows.length === 0) return;

  type RP = { id: number; mantraRole: string; fv: number; hasFv: boolean };
  const roster: RP[] = rosterRes.rows.map((r) => ({
    id: r.id as number,
    mantraRole: r.mantraRole as string,
    fv: r.fv as number,
    hasFv: r.hasFv !== null,
  }));

  const pick = (pool: RP[], roles: string[], n: number): RP[] => {
    const sorted = pool
      .filter((p) => roles.includes(p.mantraRole))
      .sort((a, b) => (b.hasFv ? 1 : 0) - (a.hasFv ? 1 : 0) || b.fv - a.fv);
    return sorted.slice(0, n);
  };

  const gk = pick(roster, ["POR"], 1);
  const def = pick(roster.filter((p) => !gk.includes(p)), ["DC", "TER"], 4);
  const mid = pick(
    roster.filter((p) => !gk.includes(p) && !def.includes(p)),
    ["M", "OFF"],
    4
  );
  const att = pick(
    roster.filter((p) => !gk.includes(p) && !def.includes(p) && !mid.includes(p)),
    ["ATT"],
    2
  );

  const starters = [...gk, ...def, ...mid, ...att];
  if (starters.length < 11) return;

  const usedIds = new Set(starters.map((p) => p.id));
  const reserves = roster
    .filter((p) => !usedIds.has(p.id))
    .sort((a, b) => (b.hasFv ? 1 : 0) - (a.hasFv ? 1 : 0) || b.fv - a.fv)
    .slice(0, 11);

  const lineupRes = await db.execute({
    sql: `INSERT INTO "Lineup" (userId, matchdayId, formation, isSubmitted, isAutomatic) VALUES (?, ?, '4-4-2', 1, 1)`,
    args: [userId, matchdayId],
  });
  const lineupId = Number(lineupRes.lastInsertRowid);

  for (let i = 0; i < starters.length; i++) {
    await db.execute({
      sql: `INSERT INTO "LineupSlot" (lineupId, playerId, position, isStarter) VALUES (?, ?, ?, 1)`,
      args: [lineupId, starters[i].id, i + 1],
    });
  }
  for (let i = 0; i < reserves.length; i++) {
    await db.execute({
      sql: `INSERT INTO "LineupSlot" (lineupId, playerId, position, isStarter) VALUES (?, ?, ?, 0)`,
      args: [lineupId, reserves[i].id, i + 1],
    });
  }
}

// ── Calculate scores for all lineups in a matchday ────────────────────────
export async function calculateScoresCore(matchdayId: number): Promise<void> {
  const db = getDb();

  const mdRes = await db.execute({
    sql: `SELECT seasonId FROM "Matchday" WHERE id = ?`,
    args: [matchdayId],
  });
  if (mdRes.rows.length === 0) throw new Error("Giornata non trovata.");
  const seasonId = mdRes.rows[0].seasonId as number;

  let maxSubstitutions = 3;
  let goalThresholds: GoalThreshold[] = DEFAULT_GOAL_THRESHOLDS;
  let homeAdvantage = 0;
  let minWinMargin = 0;
  let scoreConversion: ScoreConversion = DEFAULT_SCORE_CONVERSION;
  let defenseModifierEnabled = false;

  try {
    const settingsRes = await db.execute({
      sql: `SELECT maxSubstitutions, goalThresholds, homeAdvantage, minWinMargin, scoreConversion, defenseModifierEnabled FROM "LeagueSettings" WHERE seasonId = ?`,
      args: [seasonId],
    });
    if (settingsRes.rows.length > 0) {
      maxSubstitutions = Math.min(settingsRes.rows[0].maxSubstitutions as number, HARD_MAX_SUBSTITUTIONS);
      homeAdvantage = (settingsRes.rows[0].homeAdvantage as number) ?? 0;
      minWinMargin = (settingsRes.rows[0].minWinMargin as number) ?? 0;
      defenseModifierEnabled = Boolean(settingsRes.rows[0].defenseModifierEnabled);
      try {
        goalThresholds = JSON.parse(settingsRes.rows[0].goalThresholds as string);
      } catch { /* usa default */ }
      try {
        if (settingsRes.rows[0].scoreConversion) {
          scoreConversion = JSON.parse(settingsRes.rows[0].scoreConversion as string);
        }
      } catch { /* usa default */ }
    }
  } catch { /* table not yet migrated */ }

  // Auto-generate for non-submitters
  const allUsersRes = await db.execute(`SELECT id FROM "User" WHERE isParticipant = 1`);
  for (const user of allUsersRes.rows) {
    await autoGenerateLineup(user.id as number, matchdayId, db);
  }

  // Score each lineup
  const lineupsRes = await db.execute({
    sql: `SELECT id, userId FROM "Lineup" WHERE matchdayId = ? AND isSubmitted = 1`,
    args: [matchdayId],
  });

  // Titolari ORIGINALI (ruolo + voto grezzo, non fantavoto) di ciascun
  // utente, per il modificatore difensivo calcolato piu sotto a livello di
  // partita (serve conoscere ENTRAMBE le formazioni della partita, non solo
  // la propria). Si usa SEMPRE la formazione di partenza, mai quella dopo
  // le sostituzioni: un titolare assente (sv, senza voto) tra portiere e
  // difensori disabilita il modificatore per quella squadra in quella
  // giornata, indipendentemente da chi lo ha sostituito in panchina.
  const defenseStartersByUser = new Map<number, Array<{ mantraRole: string; vote: number | null }>>();

  for (const lineup of lineupsRes.rows) {
    const lineupId = lineup.id as number;
    const userId = lineup.userId as number;
    const slotsRes = await db.execute({
      sql: `SELECT ls.position, ls.isStarter, p.mantraRole,
                   pv.vote, pv.fantavoto, COALESCE(pv.gfGs, 0) as goals
            FROM "LineupSlot" ls
            JOIN "Player" p ON p.id = ls.playerId
            LEFT JOIN "PlayerVote" pv ON pv.playerId = ls.playerId AND pv.matchdayId = ?
            WHERE ls.lineupId = ?`,
      args: [matchdayId, lineupId],
    });

    const starterRows = slotsRes.rows
      .filter((s) => Number(s.isStarter) === 1)
      .sort((a, b) => (a.position as number) - (b.position as number));
    const reserveRows = slotsRes.rows
      .filter((s) => Number(s.isStarter) === 0)
      .sort((a, b) => (a.position as number) - (b.position as number));

    defenseStartersByUser.set(
      userId,
      starterRows.map((s) => ({
        mantraRole: s.mantraRole as string,
        vote: s.vote as number | null,
      }))
    );

    let base = 0;
    let subsUsed = 0;
    let totalGoals = 0;

    // Sostituzioni automatiche: vedi computeAutoSubstitutions in
    // app/lib/scoring.ts per la logica condivisa con il tabellino (ordine di
    // priorita delle riserve, modulo libero di cambiare, limiti su
    // difensori/attaccanti/OFF+ATT).
    const reserveForStarter = computeAutoSubstitutions(
      starterRows.map((s) => ({
        mantraRole: s.mantraRole as string,
        fantavoto: s.fantavoto as number | null,
      })),
      reserveRows.map((r) => ({
        mantraRole: r.mantraRole as string,
        fantavoto: r.fantavoto as number | null,
      })),
      maxSubstitutions
    );

    starterRows.forEach((starter, si) => {
      const gfGs = starter.goals as number;
      if (gfGs > 0) totalGoals += gfGs;

      if (starter.fantavoto !== null) {
        base += starter.fantavoto as number;
        return;
      }

      const rIdx = reserveForStarter[si];
      if (rIdx !== null) {
        base += reserveRows[rIdx].fantavoto as number;
        subsUsed++;
      }
    });

    const goalBonus = calculateGoalBonus(totalGoals, goalThresholds);
    const total = Math.round((base + goalBonus) * 100) / 100;

    await db.execute({
      sql: `UPDATE "Lineup" SET totalScore = ?, goalBonus = ?, substitutions = ? WHERE id = ?`,
      args: [total, goalBonus, subsUsed, lineupId],
    });
  }

  // Compute match results
  const matchesRes = await db.execute({
    sql: `SELECT id, homeUserId, awayUserId FROM "Match" WHERE matchdayId = ?`,
    args: [matchdayId],
  });

  for (const match of matchesRes.rows) {
    const homeRes = await db.execute({
      sql: `SELECT totalScore FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
      args: [match.homeUserId, matchdayId],
    });
    const awayRes = await db.execute({
      sql: `SELECT totalScore FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
      args: [match.awayUserId, matchdayId],
    });

    const rawHomeScore = (homeRes.rows[0]?.totalScore as number) ?? 0;
    const rawAwayScore = (awayRes.rows[0]?.totalScore as number) ?? 0;

    // Modificatore difensivo: la BUONA difesa di una squadra toglie punti al
    // punteggio finale dell'AVVERSARIA (portiere + 3 migliori difensori
    // titolari a voto — vedi calculateDefenseModifier). Non tocca il
    // Lineup.totalScore di nessuno (quello resta "quanto ha fatto la tua
    // formazione"): si applica solo al punteggio di partita nel tabellino.
    const homeDefense = defenseModifierEnabled
      ? calculateDefenseModifier(defenseStartersByUser.get(match.homeUserId as number) ?? [])
      : { applies: false, average: null, malus: 0 };
    const awayDefense = defenseModifierEnabled
      ? calculateDefenseModifier(defenseStartersByUser.get(match.awayUserId as number) ?? [])
      : { applies: false, average: null, malus: 0 };

    // Punteggio di partita mostrato/salvato: include gia il fattore campo
    // (bonus alla squadra di casa) e il modificatore difensivo. Da qui in
    // poi ogni decisione (chi vince, quanti punti in classifica, i gol
    // convertiti) si basa SOLO su questi due valori - mai su una versione
    // "nascosta" diversa da quella mostrata nel tabellino. Cosi un
    // risultato pareggiato o perso a vista (es. 1-1) assegna sempre gli
    // stessi punti che ci si aspetta dal risultato mostrato (1-1 pareggio
    // -> 1 punto a testa, non puo mai succedere che chi ha pareggiato
    // a vista prenda 3 punti).
    const homeScore = Math.round((rawHomeScore + awayDefense.malus + homeAdvantage) * 100) / 100;
    const awayScore = Math.round((rawAwayScore + homeDefense.malus) * 100) / 100;

    // Convert scores to goals (Mantra system) — null when conversion disabled
    let homeGoals = scoreConversion.enabled ? convertScoreToGoals(homeScore, scoreConversion) : null;
    let awayGoals = scoreConversion.enabled ? convertScoreToGoals(awayScore, scoreConversion) : null;

    let homePoints = 1;
    let awayPoints = 1;

    // Distacco minimo di fantapunti per vincere (impostazione lega,
    // minWinMargin): sotto questa soglia il risultato resta pareggio anche
    // se un punteggio (o i gol da esso derivati) e piu alto dell altro.
    // Calcolato sugli stessi punteggi mostrati (fattore campo gia incluso),
    // cosi da coprire anche il caso "69.5 a 70" con margine reale 0.5.
    const rawMargin = Math.abs(homeScore - awayScore);

    if (rawMargin >= minWinMargin) {
      if (scoreConversion.enabled && homeGoals !== null && awayGoals !== null) {
        // Vittoria/sconfitta/pareggio decisi dagli STESSI gol mostrati nel tabellino
        if (homeGoals > awayGoals) { homePoints = 3; awayPoints = 0; }
        else if (awayGoals > homeGoals) { homePoints = 0; awayPoints = 3; }
      } else {
        // Senza conversione in gol: confronto diretto sugli STESSI punteggi mostrati
        if (homeScore > awayScore) { homePoints = 3; awayPoints = 0; }
        else if (awayScore > homeScore) { homePoints = 0; awayPoints = 3; }
      }
    }

    // Il distacco minimo puo forzare un pareggio (rawMargin < minWinMargin)
    // anche quando i gol convertiti sarebbero diversi (es. 71.5 vs 69.0 pt
    // -> 2 vs 1 gol, ma sotto la soglia): senza questo allineamento si
    // vedrebbe "2-1" etichettato "Pareggio", di nuovo un risultato mostrato
    // che non corrisponde ai punti assegnati. Se il pareggio e stato deciso,
    // i gol mostrati vengono allineati al piu basso dei due (non si regalano
    // gol che il distacco minimo non ha confermato).
    if (homePoints === 1 && awayPoints === 1 && homeGoals !== null && awayGoals !== null && homeGoals !== awayGoals) {
      const tiedGoals = Math.min(homeGoals, awayGoals);
      homeGoals = tiedGoals;
      awayGoals = tiedGoals;
    }

    await db.execute({
      sql: `UPDATE "Match" SET homeScore = ?, awayScore = ?, homePoints = ?, awayPoints = ?, homeGoals = ?, awayGoals = ?,
                   homeDefenseAvg = ?, homeDefenseMalus = ?, awayDefenseAvg = ?, awayDefenseMalus = ? WHERE id = ?`,
      args: [
        homeScore, awayScore, homePoints, awayPoints, homeGoals, awayGoals,
        homeDefense.average, homeDefense.applies ? homeDefense.malus : null,
        awayDefense.average, awayDefense.applies ? awayDefense.malus : null,
        match.id,
      ],
    });
  }

  revalidatePath("/standings");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}
