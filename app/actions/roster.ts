"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

export async function addPlayerToRoster(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const userId = parseInt(formData.get("userId") as string);
  const playerId = parseInt(formData.get("playerId") as string);
  const purchasePrice = parseInt(formData.get("purchasePrice") as string) || 0;

  const db = getDb();

  const countRes = await db.execute({ sql: `SELECT COUNT(*) as c FROM "Roster" WHERE userId = ?`, args: [userId] });
  if ((countRes.rows[0].c as number) >= 26) return "La rosa è già completa (26 giocatori).";

  const existing = await db.execute({ sql: `SELECT id FROM "Roster" WHERE playerId = ?`, args: [playerId] });
  if (existing.rows.length > 0) return "Questo giocatore è già nella rosa di un altro utente.";

  await db.execute({
    sql: `INSERT INTO "Roster" (userId, playerId, purchasePrice) VALUES (?, ?, ?)`,
    args: [userId, playerId, purchasePrice],
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return null;
}

export async function removePlayerFromRoster(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const rosterId = parseInt(formData.get("rosterId") as string);
  await getDb().execute({ sql: `DELETE FROM "Roster" WHERE id = ?`, args: [rosterId] });
  revalidatePath("/admin/users");
  return null;
}

export async function updatePurchasePrice(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const rosterId = parseInt(formData.get("rosterId") as string);
  const purchasePrice = parseInt(formData.get("purchasePrice") as string) || 0;

  await getDb().execute({
    sql: `UPDATE "Roster" SET purchasePrice = ? WHERE id = ?`,
    args: [purchasePrice, rosterId],
  });
  revalidatePath("/admin/users");
  return null;
}
