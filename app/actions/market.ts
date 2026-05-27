"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.isAdmin) throw new Error("Non autorizzato");
  return session;
}

export async function createMarket(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const name = formData.get("name") as string;
    const budget = Number(formData.get("budget") || 0);
    const seasonRes = await db.execute(`SELECT id FROM "Season" WHERE isActive = 1 LIMIT 1`);
    const season = seasonRes.rows[0];
    if (!season) return { error: "Nessuna stagione attiva" };
    await db.execute({
      sql: `INSERT INTO "Market" (seasonId, name, budget) VALUES (?, ?, ?)`,
      args: [season.id, name, budget],
    });
    revalidatePath("/mercato");
    revalidatePath("/admin/mercato");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function toggleMarket(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const marketId = Number(formData.get("marketId"));
    const current = await db.execute({ sql: `SELECT isOpen FROM "Market" WHERE id = ?`, args: [marketId] });
    const isOpen = Number(current.rows[0]?.isOpen) === 1 ? 0 : 1;
    await db.execute({ sql: `UPDATE "Market" SET isOpen = ? WHERE id = ?`, args: [isOpen, marketId] });
    revalidatePath("/mercato");
    revalidatePath("/admin/mercato");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function submitOffer(prevState: unknown, formData: FormData) {
  try {
    const session = await getSession();
    if (!session) return { error: "Non autenticato" };
    const db = getDb();
    const marketId = Number(formData.get("marketId"));
    const playerId = Number(formData.get("playerId"));
    const price = Number(formData.get("price"));
    const note = (formData.get("note") as string) || "";

    const market = await db.execute({ sql: `SELECT isOpen FROM "Market" WHERE id = ?`, args: [marketId] });
    if (!market.rows[0] || Number(market.rows[0].isOpen) !== 1) return { error: "Mercato chiuso" };

    const existing = await db.execute({
      sql: `SELECT id FROM "MarketOffer" WHERE marketId = ? AND playerId = ? AND status = 'pending'`,
      args: [marketId, playerId],
    });
    if (existing.rows.length > 0) return { error: "Offerta già presente per questo giocatore" };

    await db.execute({
      sql: `INSERT INTO "MarketOffer" (marketId, fromUserId, playerId, price, note) VALUES (?, ?, ?, ?, ?)`,
      args: [marketId, session.userId, playerId, price, note],
    });
    revalidatePath("/mercato");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function resolveOffer(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const offerId = Number(formData.get("offerId"));
    const action = formData.get("action") as "accept" | "reject";

    if (action === "accept") {
      const offer = await db.execute({ sql: `SELECT * FROM "MarketOffer" WHERE id = ?`, args: [offerId] });
      const o = offer.rows[0];
      if (!o) return { error: "Offerta non trovata" };

      const toUserId = Number(formData.get("toUserId") || 0);
      if (toUserId) {
        await db.execute({ sql: `DELETE FROM "Roster" WHERE playerId = ? AND userId = ?`, args: [o.playerId, o.fromUserId] });
        await db.execute({
          sql: `INSERT OR IGNORE INTO "Roster" (userId, playerId, purchasePrice) VALUES (?, ?, ?)`,
          args: [toUserId, o.playerId, o.price],
        });
      } else {
        await db.execute({ sql: `DELETE FROM "Roster" WHERE playerId = ? AND userId = ?`, args: [o.playerId, o.fromUserId] });
      }
      await db.execute({ sql: `UPDATE "MarketOffer" SET status = 'accepted', toUserId = ? WHERE id = ?`, args: [toUserId || null, offerId] });
    } else {
      await db.execute({ sql: `UPDATE "MarketOffer" SET status = 'rejected' WHERE id = ?`, args: [offerId] });
    }

    revalidatePath("/mercato");
    revalidatePath("/admin/mercato");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteOffer(prevState: unknown, formData: FormData) {
  try {
    const session = await getSession();
    if (!session) return { error: "Non autenticato" };
    const db = getDb();
    const offerId = Number(formData.get("offerId"));
    const offer = await db.execute({ sql: `SELECT fromUserId, status FROM "MarketOffer" WHERE id = ?`, args: [offerId] });
    const o = offer.rows[0];
    if (!o) return { error: "Offerta non trovata" };
    if (Number(o.fromUserId) !== session.userId && !session.isAdmin) return { error: "Non autorizzato" };
    if (o.status !== "pending") return { error: "Offerta già processata" };
    await db.execute({ sql: `DELETE FROM "MarketOffer" WHERE id = ?`, args: [offerId] });
    revalidatePath("/mercato");
    revalidatePath("/admin/mercato");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
