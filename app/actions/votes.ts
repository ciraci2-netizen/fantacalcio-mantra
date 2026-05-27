"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { scrapeVotes } from "@/app/lib/scraper";
import {
  calculateFantavoto,
  calculateGoalBonus,
  DEFAULT_GOAL_THRESHOLDS,
  type GoalThreshold,
  VALID_FORMATIONS,
  MANTRA_ROLES,
  type MantraRole,
} from "@/app/lib/scoring";

export async function importVotes(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const matchdayNumber = parseInt(formData.get("matchdayNumber") as string);

  const db = getDb();
  const matchdayRes = await db.execute({ sql: `SELECT id FROM "Matchday" WHERE id = ?`, args: [matchdayId] });
  if (matchdayRes.rows.length === 0) return "Giornata non trovata.";

  try {
    const scraped = await scrapeVotes(matchdayNumber);
    if (scraped.length === 0) return "Nessun voto trovato sul sito. Riprova più tardi.";

    const playersRes = await db.execute(`SELECT id, name, fantapiu3Name, mantraRole FROM "Player"`);
    const players = playersRes.rows;

    let matched = 0;
    let unmatched = 0;

    for (const vote of scraped) {
      const player = players.find(
        (p) => (p.fantapiu3Name && p.fantapiu3Name === vote.name) || p.name === vote.name
      );

      if (!player) { unmatched++; continue; }

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
          player.id, matchdayId, vote.vote, fantavoto,
          vote.gfGs, vote.gsr, vote.amm, vote.esp, vote.rpRs, vote.aut, vote.ass, vote.adf,
        ],
      });
      matched++;
    }

    await db.execute({
      sql: `UPDATE "Matchday" SET votesImported = 1 WHERE id = ?`,
      args: [matchdayId],
    });

    revalidatePath("/admin/votes");
    revalidatePath("/standings");
    return `Voti importati: ${matched} giocatori trovati, ${unmatched} non abbinati.`;
  } catch (err) {
    return `Errore durante l'importazione: ${err instanceof Error ? err.message : "Errore sconosciuto"}`;
  }
}

// ─── Funzione helper: auto-genera la formazione migliore da una rosa ───────────
async function autoGenerateLineup(userId: number, matchdayId: number, db: ReturnType<typeof import("@/app/lib/db").getDb>) {
  // Controlla se esiste già
  const existing = await db.execute({
    sql: `SELECT id FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
    args: [userId, matchdayId],
  });
  if (existing.rows.length > 0) return; // già presente

  // Prendi tutti i giocatori della rosa con il loro fantavoto per questa giornata
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

  // Prova a costruire una formazione 4-4-2 di default
  // Prima metti i giocatori con voto, poi quelli senza
  type RosterPlayer = { id: number; mantraRole: string; fv: number; hasFv: boolean };
  const roster: RosterPlayer[] = rosterRes.rows.map((r) => ({
    id: r.id as number,
    mantraRole: r.mantraRole as string,
    fv: r.fv as number,
    hasFv: r.hasFv !== null,
  }));

  // Formazione: 1 Por, 4 Dif (Dc/Dd/Ds), 4 Cen (M/C/T/W), 2 Att (A/Pc)
  const defRoles = ["Dc", "Dd", "Ds"];
  const midRoles = ["M", "C", "T", "W"];
  const attRoles = ["A", "Pc"];

  const pick = (pool: RosterPlayer[], roles: string[], n: number): RosterPlayer[] => {
    const picked: RosterPlayer[] = [];
    // Prima quelli con voto, ordinati per fv desc
    const sorted = pool
      .filter((p) => roles.includes(p.mantraRole))
      .sort((a, b) => (b.hasFv ? 1 : 0) - (a.hasFv ? 1 : 0) || b.fv - a.fv);
    for (const p of sorted) {
      if (picked.length >= n) break;
      picked.push(p);
    }
    return picked;
  };

  const goalkeeper = pick(roster, ["Por"], 1);
  const defenders = pick(roster.filter((p) => !goalkeeper.includes(p)), defRoles, 4);
  const midfielders = pick(roster.filter((p) => !goalkeeper.includes(p) && !defenders.includes(p)), midRoles, 4);
  const attackers = pick(roster.filter((p) => !goalkeeper.includes(p) && !defenders.includes(p) && !midfielders.includes(p)), attRoles, 2);

  const starters = [...goalkeeper, ...defenders, ...midfielders, ...attackers];
  if (starters.length < 11) return; // rosa troppo piccola, saltiamo

  // Riserve: prendi i migliori rimasti fino a 7
  const usedIds = new Set(starters.map((p) => p.id));
  const reserves = roster
    .filter((p) => !usedIds.has(p.id))
    .sort((a, b) => (b.hasFv ? 1 : 0) - (a.hasFv ? 1 : 0) || b.fv - a.fv)
    .slice(0, 7);

  // Crea Lineup
  const lineupRes = await db.execute({
    sql: `INSERT INTO "Lineup" (userId, matchdayId, formation, isSubmitted, isAutomatic) VALUES (?, ?, '4-4-2', 1, 1)`,
    args: [userId, matchdayId],
  });
  const lineupId = Number(lineupRes.lastInsertRowid);

  // Inserisci slot
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

// ─── Calcola tutti i punteggi con soglie gol e limite sostituzioni ────────────
export async function calculateAllScores(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const db = getDb();

  // Recupera la stagione per trovare le impostazioni
  const mdRes = await db.execute({
    sql: `SELECT seasonId FROM "Matchday" WHERE id = ?`,
    args: [matchdayId],
  });
  if (mdRes.rows.length === 0) return "Giornata non trovata.";
  const seasonId = mdRes.rows[0].seasonId as number;

  // Carica LeagueSettings (se esistono)
  let maxSubstitutions = 3;
  let goalThresholds: GoalThreshold[] = DEFAULT_GOAL_THRESHOLDS;

  const settingsRes = await db.execute({
    sql: `SELECT maxSubstitutions, goalThresholds FROM "LeagueSettings" WHERE seasonId = ?`,
    args: [seasonId],
  });
  if (settingsRes.rows.length > 0) {
    maxSubstitutions = settingsRes.rows[0].maxSubstitutions as number;
    try {
      goalThresholds = JSON.parse(settingsRes.rows[0].goalThresholds as string);
    } catch { /* usa default */ }
  }

  // Auto-genera formazioni per chi non ha inviato
  const allUsersRes = await db.execute(`SELECT id FROM "User" WHERE isAdmin = 0`);
  for (const user of allUsersRes.rows) {
    await autoGenerateLineup(user.id as number, matchdayId, db);
  }

  // Calcola punteggi per tutte le formazioni della giornata
  const lineupsRes = await db.execute({
    sql: `SELECT id FROM "Lineup" WHERE matchdayId = ? AND isSubmitted = 1`,
    args: [matchdayId],
  });

  for (const lineup of lineupsRes.rows) {
    const lineupId = lineup.id as number;

    const slotsRes = await db.execute({
      sql: `SELECT ls.position, ls.isStarter, p.mantraRole,
                   pv.fantavoto, COALESCE(pv.gfGs, 0) as goals
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

    // Calcola punteggio base con soglie gol e limite sostituzioni
    let base = 0;
    let subsUsed = 0;
    let totalGoals = 0;

    const usedReserveIdxs = new Set<number>();
    for (const starter of starterRows) {
      const gfGs = starter.goals as number;
      if (gfGs > 0) totalGoals += gfGs;

      if (starter.fantavoto !== null) {
        base += starter.fantavoto as number;
      } else {
        // Sostituzione automatica (entro il limite)
        if (subsUsed < maxSubstitutions) {
          const rIdx = reserveRows.findIndex((_, i) => !usedReserveIdxs.has(i) && reserveRows[i].fantavoto !== null);
          if (rIdx !== -1) {
            usedReserveIdxs.add(rIdx);
            base += reserveRows[rIdx].fantavoto as number;
            subsUsed++;
          }
        }
      }
    }

    const goalBonus = calculateGoalBonus(totalGoals, goalThresholds);
    const total = Math.round((base + goalBonus) * 100) / 100;

    await db.execute({
      sql: `UPDATE "Lineup" SET totalScore = ?, goalBonus = ?, substitutions = ? WHERE id = ?`,
      args: [total, goalBonus, subsUsed, lineupId],
    });
  }

  // Calcola risultati partite
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

    const homeScore = (homeRes.rows[0]?.totalScore as number) ?? 0;
    const awayScore = (awayRes.rows[0]?.totalScore as number) ?? 0;

    let homePoints = 1;
    let awayPoints = 1;
    if (homeScore > awayScore) { homePoints = 3; awayPoints = 0; }
    else if (awayScore > homeScore) { homePoints = 0; awayPoints = 3; }

    await db.execute({
      sql: `UPDATE "Match" SET homeScore = ?, awayScore = ?, homePoints = ?, awayPoints = ? WHERE id = ?`,
      args: [homeScore, awayScore, homePoints, awayPoints, match.id],
    });
  }

  revalidatePath("/standings");
  revalidatePath("/calendar");
  revalidatePath("/admin/votes");
  return null;
}
