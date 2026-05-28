"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/app/lib/session";
import { importVotesCore, calculateScoresCore } from "@/app/lib/voteImporter";
import { sendPushToAll } from "@/app/lib/pushNotification";
import { getDb } from "@/app/lib/db";

// ── Admin: import votes for a matchday ────────────────────────────────────
export async function importVotes(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const matchdayNumber = parseInt(formData.get("matchdayNumber") as string);

  const db = getDb();
  const check = await db.execute({
    sql: `SELECT id FROM "Matchday" WHERE id = ?`,
    args: [matchdayId],
  });
  if (check.rows.length === 0) return "Giornata non trovata.";

  try {
    const result = await importVotesCore(matchdayId, matchdayNumber);

    revalidatePath("/admin/votes");

    // Send push notification to all subscribers
    await sendPushToAll(
      `⚽ Voti G${matchdayNumber} importati!`,
      `${result.matched} giocatori aggiornati. Controlla il tuo punteggio!`,
      "/standings"
    );

    return `Voti importati: ${result.matched} giocatori trovati, ${result.unmatched} non abbinati.`;
  } catch (err) {
    return `Errore durante l'importazione: ${err instanceof Error ? err.message : "Errore sconosciuto"}`;
  }
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
