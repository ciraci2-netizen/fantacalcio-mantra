"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { calculateScoresCore } from "@/app/lib/voteImporter";

/**
 * Admin: imposta (o toglie) la sconfitta a tavolino 3-0 su una partita.
 *
 * value: "none" | "home" | "away" | "both"
 *   - "home" = la squadra di CASA perde 0-3 a tavolino
 *   - "away" = la squadra OSPITE perde 3-0 a tavolino
 *   - "both" = entrambe: 0-0, zero punti a testa
 *
 * Si puo usare in qualsiasi momento:
 *   - PRIMA del calcolo: viene applicato quando si calcola la giornata
 *   - DOPO il calcolo: la giornata viene ricalcolata subito
 * I fantapunti della formazione restano quelli realmente fatti (contano
 * per la classifica "fantapunti totali"), cambiano solo gol e punti.
 */
export async function setMatchForfeit(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session?.isAdmin) return;

  const matchId = parseInt(formData.get("matchId") as string);
  const value = formData.get("forfeit") as string;
  if (!matchId || !["none", "home", "away", "both"].includes(value)) return;

  const db = getDb();

  // Crea le colonne se mancano (cosi non serve lanciare la migrazione a mano)
  try { await db.execute(`ALTER TABLE "Match" ADD COLUMN "homeForfeit" INTEGER NOT NULL DEFAULT 0`); } catch { /* già presente */ }
  try { await db.execute(`ALTER TABLE "Match" ADD COLUMN "awayForfeit" INTEGER NOT NULL DEFAULT 0`); } catch { /* già presente */ }

  const homeForfeit = value === "home" || value === "both" ? 1 : 0;
  const awayForfeit = value === "away" || value === "both" ? 1 : 0;

  await db.execute({
    sql: `UPDATE "Match" SET homeForfeit = ?, awayForfeit = ? WHERE id = ?`,
    args: [homeForfeit, awayForfeit, matchId],
  });

  // Se la partita e' gia stata calcolata, ricalcola la giornata per
  // applicare (o togliere) subito il tavolino.
  const mRes = await db.execute({
    sql: `SELECT matchdayId, homeScore FROM "Match" WHERE id = ?`,
    args: [matchId],
  });
  const row = mRes.rows[0];
  if (row && row.homeScore !== null) {
    await calculateScoresCore(row.matchdayId as number);
  }

  revalidatePath(`/calendar/${matchId}`);
  revalidatePath("/calendar");
  revalidatePath("/standings");
  revalidatePath("/dashboard");
}
