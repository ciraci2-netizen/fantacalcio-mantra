"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.isAdmin) throw new Error("Non autorizzato");
  return session;
}

export async function createCup(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const name = formData.get("name") as string;
    const seasonRes = await db.execute(`SELECT id FROM "Season" WHERE isActive = 1 LIMIT 1`);
    const season = seasonRes.rows[0];
    if (!season) return { error: "Nessuna stagione attiva" };
    await db.execute({ sql: `INSERT INTO "Cup" (seasonId, name) VALUES (?, ?)`, args: [season.id, name] });
    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function createCupRound(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const cupId = Number(formData.get("cupId"));
    const name = formData.get("name") as string;
    const countRes = await db.execute({ sql: `SELECT COUNT(*) as n FROM "CupRound" WHERE cupId = ?`, args: [cupId] });
    const number = (Number(countRes.rows[0].n) + 1);
    await db.execute({ sql: `INSERT INTO "CupRound" (cupId, name, number) VALUES (?, ?, ?)`, args: [cupId, name, number] });
    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function createCupMatch(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const cupRoundId = Number(formData.get("cupRoundId"));
    const homeUserId = Number(formData.get("homeUserId"));
    const awayUserId = Number(formData.get("awayUserId"));
    await db.execute({
      sql: `INSERT INTO "CupMatch" (cupRoundId, homeUserId, awayUserId) VALUES (?, ?, ?)`,
      args: [cupRoundId, homeUserId, awayUserId],
    });
    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function setCupMatchScore(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const matchId = Number(formData.get("matchId"));
    const homeScore = parseFloat(formData.get("homeScore") as string);
    const awayScore = parseFloat(formData.get("awayScore") as string);
    await db.execute({
      sql: `UPDATE "CupMatch" SET homeScore = ?, awayScore = ? WHERE id = ?`,
      args: [homeScore, awayScore, matchId],
    });
    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteCup(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const cupId = Number(formData.get("cupId"));
    const rounds = await db.execute({ sql: `SELECT id FROM "CupRound" WHERE cupId = ?`, args: [cupId] });
    for (const r of rounds.rows) {
      await db.execute({ sql: `DELETE FROM "CupMatch" WHERE cupRoundId = ?`, args: [r.id] });
    }
    await db.execute({ sql: `DELETE FROM "CupRound" WHERE cupId = ?`, args: [cupId] });
    await db.execute({ sql: `DELETE FROM "Cup" WHERE id = ?`, args: [cupId] });
    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
