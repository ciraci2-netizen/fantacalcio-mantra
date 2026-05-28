"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

/** Propose a trade: offer one of my players in exchange for one of another user's players */
export async function proposeTrade(prevState: string | null, formData: FormData): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const offeredPlayerId   = parseInt(formData.get("offeredPlayerId")   as string);
  const requestedPlayerId = parseInt(formData.get("requestedPlayerId") as string);
  const toUserId          = parseInt(formData.get("toUserId")          as string);
  const note              = ((formData.get("note") as string) ?? "").slice(0, 200).trim();

  if (!offeredPlayerId || !requestedPlayerId || !toUserId) return "Dati mancanti.";
  if (toUserId === session.userId) return "Non puoi scambiare con te stesso.";

  const db = getDb();

  const seasonRes = await db.execute(`SELECT id FROM "Season" WHERE isActive = 1 LIMIT 1`);
  if (!seasonRes.rows[0]) return "Nessuna stagione attiva.";
  const seasonId = seasonRes.rows[0].id as number;

  // Verify offered player is in my roster
  const myOwnership = await db.execute({
    sql: `SELECT id FROM "Roster" WHERE userId = ? AND playerId = ?`,
    args: [session.userId, offeredPlayerId],
  });
  if (!myOwnership.rows[0]) return "Il giocatore offerto non è nella tua rosa.";

  // Verify requested player is in target user's roster
  const theirOwnership = await db.execute({
    sql: `SELECT id FROM "Roster" WHERE userId = ? AND playerId = ?`,
    args: [toUserId, requestedPlayerId],
  });
  if (!theirOwnership.rows[0]) return "Il giocatore richiesto non è nella rosa dell'avversario.";

  // Check no duplicate pending offer for same pair
  const dupCheck = await db.execute({
    sql: `SELECT id FROM "TradeOffer"
          WHERE fromUserId = ? AND toUserId = ?
            AND offeredPlayerId = ? AND requestedPlayerId = ?
            AND status = 'pending'`,
    args: [session.userId, toUserId, offeredPlayerId, requestedPlayerId],
  });
  if (dupCheck.rows.length > 0) return "Hai già una proposta in attesa per questo scambio.";

  await db.execute({
    sql: `INSERT INTO "TradeOffer" (seasonId, fromUserId, toUserId, offeredPlayerId, requestedPlayerId, note)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [seasonId, session.userId, toUserId, offeredPlayerId, requestedPlayerId, note],
  });

  revalidatePath("/scambi");
  return "ok";
}

/** Accept an incoming trade offer — swap the two players in Roster */
export async function acceptTrade(prevState: string | null, formData: FormData): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const tradeId = parseInt(formData.get("tradeId") as string);
  const db = getDb();

  const tradeRes = await db.execute({
    sql: `SELECT * FROM "TradeOffer" WHERE id = ? AND toUserId = ? AND status = 'pending'`,
    args: [tradeId, session.userId],
  });
  if (!tradeRes.rows[0]) return "Proposta non trovata o non autorizzato.";

  const trade = tradeRes.rows[0];
  const fromUserId        = trade.fromUserId        as number;
  const toUserId          = trade.toUserId          as number;
  const offeredPlayerId   = trade.offeredPlayerId   as number;
  const requestedPlayerId = trade.requestedPlayerId as number;

  // Re-verify both players are still in the respective rosters
  const [off, req] = await Promise.all([
    db.execute({ sql: `SELECT id FROM "Roster" WHERE userId = ? AND playerId = ?`, args: [fromUserId, offeredPlayerId] }),
    db.execute({ sql: `SELECT id FROM "Roster" WHERE userId = ? AND playerId = ?`, args: [toUserId, requestedPlayerId] }),
  ]);
  if (!off.rows[0] || !req.rows[0]) return "Uno dei giocatori non è più disponibile.";

  // Swap: move offeredPlayer to toUser, requestedPlayer to fromUser
  await db.execute({ sql: `UPDATE "Roster" SET userId = ? WHERE userId = ? AND playerId = ?`, args: [toUserId,   fromUserId, offeredPlayerId]   });
  await db.execute({ sql: `UPDATE "Roster" SET userId = ? WHERE userId = ? AND playerId = ?`, args: [fromUserId, toUserId,   requestedPlayerId] });

  // Mark this offer accepted
  await db.execute({ sql: `UPDATE "TradeOffer" SET status = 'accepted' WHERE id = ?`, args: [tradeId] });

  // Cancel all other pending offers that involve either player (now invalid)
  await db.execute({
    sql: `UPDATE "TradeOffer" SET status = 'cancelled'
          WHERE status = 'pending' AND id != ?
            AND (offeredPlayerId IN (?, ?) OR requestedPlayerId IN (?, ?))`,
    args: [tradeId, offeredPlayerId, requestedPlayerId, offeredPlayerId, requestedPlayerId],
  });

  revalidatePath("/scambi");
  revalidatePath("/team");
  return "ok";
}

/** Reject an incoming trade offer */
export async function rejectTrade(prevState: string | null, formData: FormData): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const tradeId = parseInt(formData.get("tradeId") as string);
  const db = getDb();

  await db.execute({
    sql: `UPDATE "TradeOffer" SET status = 'rejected' WHERE id = ? AND toUserId = ? AND status = 'pending'`,
    args: [tradeId, session.userId],
  });

  revalidatePath("/scambi");
  return "ok";
}

/** Cancel an outgoing trade offer (I proposed it) */
export async function cancelTrade(prevState: string | null, formData: FormData): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const tradeId = parseInt(formData.get("tradeId") as string);
  const db = getDb();

  await db.execute({
    sql: `UPDATE "TradeOffer" SET status = 'cancelled' WHERE id = ? AND fromUserId = ? AND status = 'pending'`,
    args: [tradeId, session.userId],
  });

  revalidatePath("/scambi");
  return "ok";
}
