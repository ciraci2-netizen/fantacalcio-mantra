"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/app/lib/session";
import { importVotesCore, calculateScoresCore, MISMATCH_PREFIX } from "@/app/lib/voteImporter";
import { calculateFantavoto } from "@/app/lib/scoring";
import { log } from "@/app/lib/logger";
import { sendPushToAll } from "@/app/lib/pushNotification";
import { getDb } from "@/app/lib/db";

// ── Admin: import votes for a matchday ────────────────────────────────────
export async function importVotes(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const matchdayNumber = parseInt(formData.get("matchdayNumber") as string);
  const force = formData.get("force") === "1";

  const db = getDb();
  const check = await db.execute({
    sql: `SELECT id FROM "Matchday" WHERE id = ?`,
    args: [matchdayId],
  });
  if (check.rows.length === 0) return "Giornata non trovata.";

  // Check if already imported — skip push notification on re-import
  const alreadyImported = check.rows[0] && (await db.execute({
    sql: `SELECT votesImported FROM "Matchday" WHERE id = ?`,
    args: [matchdayId],
  })).rows[0]?.votesImported;

  const start = Date.now();
  try {
    const result = await importVotesCore(matchdayId, matchdayNumber, { force });
    log("import_votes", { matchdayId, matchdayNumber, matched: result.matched, unmatched: result.unmatched, forced: force, ms: Date.now() - start });

    revalidatePath("/admin/votes");
    revalidatePath("/standings");
    revalidatePath("/calendar");

    // Only send push on first import (avoid double notifications on re-import)
    if (!alreadyImported) {
      await sendPushToAll(
        `⚽ Voti G${matchdayNumber} importati!`,
        `${result.matched} giocatori aggiornati. Controlla il tuo punteggio!`,
        "/standings"
      );
    }

    // Elenca i nomi non abbinati così l'admin sa esattamente quali giocatori
    // sistemare (nome o "Nome su Fantapiu3") in Admin → Giocatori prima di
    // ripetere l'import.
    const unmatchedList = result.unmatchedNames.length > 0
      ? ` Non trovati: ${result.unmatchedNames.slice(0, 25).join(", ")}${result.unmatchedNames.length > 25 ? `, +${result.unmatchedNames.length - 25} altri` : ""}. Correggili in Admin → Giocatori (campo "Nome su Fantapiu3") e reimporta.`
      : "";

    return `Voti importati: ${result.matched} trovati, ${result.unmatched} non abbinati.${unmatchedList}${alreadyImported ? " (re-import, nessuna push inviata)" : ""}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    // Prefisso riconosciuto dal client per mostrare la scelta "importa comunque"
    // invece di un errore generico — vedi MISMATCH_PREFIX in voteImporter.ts.
    if (message.startsWith(MISMATCH_PREFIX)) return message;
    return `Errore durante l'importazione: ${message}`;
  }
}

// ── Admin: correggi manualmente un voto già importato (o inseriscine uno
// nuovo per un giocatore non abbinato durante lo scraping) ─────────────────
export async function updatePlayerVote(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const playerId = parseInt(formData.get("playerId") as string);
  if (!matchdayId || !playerId) return "Dati mancanti.";

  const voteRaw = ((formData.get("vote") as string) ?? "").trim();
  const fantavotoRaw = ((formData.get("fantavoto") as string) ?? "").trim();
  const vote = voteRaw === "" ? null : parseFloat(voteRaw);
  const manualFantavoto = fantavotoRaw === "" ? null : parseFloat(fantavotoRaw);
  if (voteRaw !== "" && Number.isNaN(vote)) return "Voto non valido.";
  if (fantavotoRaw !== "" && Number.isNaN(manualFantavoto)) return "Fantavoto non valido.";

  // Eventi (gol, ammonizioni, ecc.): interi, 0 se lasciati vuoti
  const intField = (name: string) => {
    const raw = ((formData.get(name) as string) ?? "").trim();
    if (raw === "") return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  };
  const gfGs = intField("gfGs");
  const gsr = intField("gsr");
  const amm = intField("amm");
  const esp = intField("esp");
  const rpRs = intField("rpRs");
  const aut = intField("aut");
  const ass = intField("ass");
  const adf = intField("adf");

  const db = getDb();
  const playerRes = await db.execute({ sql: `SELECT mantraRole FROM "Player" WHERE id = ?`, args: [playerId] });
  const mantraRole = playerRes.rows[0]?.mantraRole as string | undefined;
  if (!mantraRole) return "Giocatore non trovato.";

  // Stessa logica usata in fase di import: se manca il voto (sv) si usa
  // direttamente il fantavoto inserito a mano; altrimenti si ricalcola dal
  // voto + eventi, ignorando un eventuale fantavoto digitato per errore.
  const fantavoto = calculateFantavoto(
    { vote, fantavoto: manualFantavoto, gfGs, gsr, amm, esp, rpRs, aut, ass, adf },
    mantraRole
  );

  await db.execute({
    sql: `INSERT OR REPLACE INTO "PlayerVote"
          (playerId, matchdayId, vote, fantavoto, gfGs, gsr, amm, esp, rpRs, aut, ass, adf)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [playerId, matchdayId, vote, fantavoto, gfGs, gsr, amm, esp, rpRs, aut, ass, adf],
  });

  // Segna la giornata come "voti importati" nel caso si stia inserendo il
  // primo voto manuale prima di un import (es. giornata mai scaricata).
  await db.execute({ sql: `UPDATE "Matchday" SET votesImported = 1 WHERE id = ?`, args: [matchdayId] });

  revalidatePath("/admin/votes");
  return null;
}

// -- Admin: azzera voti e risultati di una giornata gia importata/calcolata,
// per poterla reimportare/ricalcolare da zero a mano. Cancella i voti
// importati, i risultati delle partite (che spariscono anche dalla
// classifica, calcolata al volo da Match.homePoints/awayPoints) e le
// formazioni generate automaticamente per chi non aveva inviato la propria
// (isAutomatic = 1) - le formazioni inviate a mano dagli utenti restano,
// solo il punteggio calcolato viene azzerato, cosi non si perde cosa
// avevano schierato.
export async function resetMatchday(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  if (!matchdayId) return "Giornata non valida.";

  const db = getDb();
  const check = await db.execute({ sql: `SELECT number, seasonId FROM "Matchday" WHERE id = ?`, args: [matchdayId] });
  if (check.rows.length === 0) return "Giornata non trovata.";
  const matchdayNumber = check.rows[0].number as number;
  const seasonId = check.rows[0].seasonId as number;

  await db.execute({ sql: `DELETE FROM "PlayerVote" WHERE matchdayId = ?`, args: [matchdayId] });

  await db.execute({
    sql: `DELETE FROM "LineupSlot" WHERE lineupId IN (
            SELECT id FROM "Lineup" WHERE matchdayId = ? AND isAutomatic = 1
          )`,
    args: [matchdayId],
  });
  await db.execute({ sql: `DELETE FROM "Lineup" WHERE matchdayId = ? AND isAutomatic = 1`, args: [matchdayId] });
  await db.execute({
    sql: `UPDATE "Lineup" SET totalScore = NULL, goalBonus = NULL, substitutions = 0
          WHERE matchdayId = ? AND (isAutomatic = 0 OR isAutomatic IS NULL)`,
    args: [matchdayId],
  });

  await db.execute({
    sql: `UPDATE "Match" SET homeScore = NULL, awayScore = NULL, homePoints = NULL, awayPoints = NULL,
                 homeGoals = NULL, awayGoals = NULL,
                 homeDefenseAvg = NULL, homeDefenseMalus = NULL, awayDefenseAvg = NULL, awayDefenseMalus = NULL
          WHERE matchdayId = ?`,
    args: [matchdayId],
  });

  await db.execute({ sql: `UPDATE "Matchday" SET votesImported = 0 WHERE id = ?`, args: [matchdayId] });

  // Sblocca la giornata e cancella la sua scadenza: se restasse bloccata e
  // con una scadenza nel passato, il cron automatico (auto-lock) la
  // ribloccherebbe da solo al giro successivo, generando di nuovo
  // formazioni automatiche al posto di chi non ha ancora schierato.
  await db.execute({ sql: `UPDATE "Matchday" SET isLocked = 0 WHERE id = ?`, args: [matchdayId] });
  try {
    await db.execute({ sql: `UPDATE "Matchday" SET deadline = NULL WHERE id = ?`, args: [matchdayId] });
  } catch { /* colonna deadline non ancora migrata: ignora */ }

  // Riporta indietro il puntatore "giornata corrente" della stagione, ma
  // SOLO se nel frattempo era gia' avanzato oltre questa giornata - altrimenti
  // il sito continuerebbe a proporre a tutti la formazione della giornata
  // successiva, lasciando questa azzerata irraggiungibile dal menu normale.
  await db.execute({
    sql: `UPDATE "Season" SET currentMatchday = ? WHERE id = ? AND currentMatchday > ?`,
    args: [matchdayNumber, seasonId, matchdayNumber],
  });

  revalidatePath("/admin/votes");
  revalidatePath("/admin/schedule");
  revalidatePath("/standings");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/lineup");

  return `AZZERATA: Giornata ${matchdayNumber} riportata a "non calcolata" e riaperta (sbloccata, senza scadenza) - voti, risultati e formazioni automatiche rimossi, ed e' di nuovo la giornata corrente per schierare. Le formazioni inviate a mano restano, solo il punteggio e stato azzerato.`;
}

// ── Admin: calculate all scores for a matchday ───────────────────────────
export async function calculateAllScores(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);

  try {
    await calculateScoresCore(matchdayId);
    revalidatePath("/admin/votes");
    return null;
  } catch (err) {
    return `Errore: ${err instanceof Error ? err.message : "Errore sconosciuto"}`;
  }
}

// -- Admin: fix una tantum per il bug "gol su rigore" -----------------------
// I gol segnati su rigore (campo gsr) venivano scorati con rigoreSbagliato
// (-3) invece che con golFatto (+3): vedi app/lib/scoring.ts. La formula e
// gia corretta per i NUOVI import; queste due action ricalcolano il
// fantavoto dei voti gia salvati con la formula sbagliata (dryRun di default,
// apply=true per scrivere davvero) e rilanciano calculateScoresCore per le
// giornate coinvolte gia importate, cosi anche punteggi/classifica gia
// calcolati vengono corretti.
async function computeGsrBackfillDiffs() {
  const db = getDb();
  const res = await db.execute(
    `SELECT pv.playerId, pv.matchdayId, pv.vote, pv.fantavoto, pv.gfGs, pv.gsr,
            pv.amm, pv.esp, pv.rpRs, pv.aut, pv.ass, pv.adf,
            p.name, p.mantraRole
     FROM "PlayerVote" pv
     JOIN "Player" p ON p.id = pv.playerId
     WHERE pv.gsr > 0`
  );

  const diffs: Array<{
    playerId: number;
    name: string;
    matchdayId: number;
    gsr: number;
    oldFantavoto: number | null;
    newFantavoto: number | null;
  }> = [];

  for (const row of res.rows) {
    const mantraRole = row.mantraRole as string;
    const newFantavoto = calculateFantavoto(
      {
        vote: row.vote as number | null,
        fantavoto: null, // se vote non e null, il fantavoto va sempre ricalcolato dagli eventi
        gfGs: row.gfGs as number,
        gsr: row.gsr as number,
        amm: row.amm as number,
        esp: row.esp as number,
        rpRs: row.rpRs as number,
        aut: row.aut as number,
        ass: row.ass as number,
        adf: row.adf as number,
      },
      mantraRole
    );
    const oldFantavoto = row.fantavoto as number | null;
    if (newFantavoto !== oldFantavoto) {
      diffs.push({
        playerId: row.playerId as number,
        name: row.name as string,
        matchdayId: row.matchdayId as number,
        gsr: row.gsr as number,
        oldFantavoto,
        newFantavoto,
      });
    }
  }
  return diffs;
}

export async function backfillGsrDryRun(prevState: string | null, formData: FormData) {
  void formData;
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const diffs = await computeGsrBackfillDiffs();
  if (diffs.length === 0) {
    return "OK: nessun voto da correggere (nessun gol su rigore era stato scorato con la formula sbagliata).";
  }
  const matchdays = [...new Set(diffs.map((d) => d.matchdayId))].sort((a, b) => a - b);
  const lines = diffs
    .map((d) => `  - G${d.matchdayId}: ${d.name}: ${d.oldFantavoto} -> ${d.newFantavoto} (${d.gsr} gol su rigore)`)
    .slice(0, 40);
  const more = diffs.length > 40 ? `\n  ... e altri ${diffs.length - 40} voti` : "";
  return `DRYRUN: ${diffs.length} voti da correggere su ${matchdays.length} giornate (id: ${matchdays.join(", ")}).\n${lines.join("\n")}${more}`;
}

export async function backfillGsrApply(prevState: string | null, formData: FormData) {
  void formData;
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const db = getDb();
  const diffs = await computeGsrBackfillDiffs();
  if (diffs.length === 0) {
    return "OK: nessun voto da correggere.";
  }

  for (const d of diffs) {
    await db.execute({
      sql: `UPDATE "PlayerVote" SET fantavoto = ? WHERE playerId = ? AND matchdayId = ?`,
      args: [d.newFantavoto, d.playerId, d.matchdayId],
    });
  }

  const matchdaysAffected = [...new Set(diffs.map((d) => d.matchdayId))].sort((a, b) => a - b);
  let recalculated = 0;
  const recalcErrors: string[] = [];
  for (const matchdayId of matchdaysAffected) {
    try {
      const mdRes = await db.execute({
        sql: `SELECT votesImported FROM "Matchday" WHERE id = ?`,
        args: [matchdayId],
      });
      if (mdRes.rows[0]?.votesImported) {
        await calculateScoresCore(matchdayId);
        recalculated++;
      }
    } catch (err) {
      recalcErrors.push(`G${matchdayId}: ${err instanceof Error ? err.message : "errore sconosciuto"}`);
    }
  }

  revalidatePath("/admin/votes");
  revalidatePath("/standings");
  revalidatePath("/calendar");

  const errPart = recalcErrors.length > 0 ? `\nATTENZIONE - errori nel ricalcolo: ${recalcErrors.join("; ")}` : "";
  return `APPLIED: ${diffs.length} voti corretti su ${matchdaysAffected.length} giornate, ${recalculated} giornate ricalcolate.${errPart}`;
}