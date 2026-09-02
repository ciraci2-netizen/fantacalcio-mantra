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
