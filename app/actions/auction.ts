"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { remainingBudget, resolveRound, roleSlotsUsed } from "@/app/lib/auction";
import { getRosterLimits } from "@/app/lib/leagueSettings";

function revalidateAuctionPaths() {
  revalidatePath("/asta");
  revalidatePath("/admin/asta");
  revalidatePath("/svincolati");
  revalidatePath("/admin/roster");
  revalidatePath("/admin/players");
}

// ── Admin: apre un nuovo round (fallisce se ce n'è già uno non risolto) ───
export async function openAuctionRound(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const name = ((formData.get("name") as string) || "").trim() || "Asta svincolati";
  const startDate = (formData.get("startDate") as string) || null;
  const endDate = formData.get("endDate") as string;
  if (!endDate) return "Imposta almeno una data di fine.";
  if (startDate && new Date(startDate).getTime() >= new Date(endDate).getTime()) {
    return "La data di fine deve essere dopo la data di inizio.";
  }

  const db = getDb();
  const seasonRes = await db.execute(`SELECT id FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const seasonId = seasonRes.rows[0]?.id as number | undefined;
  if (!seasonId) return "Nessuna stagione attiva.";

  const openRes = await db.execute({
    sql: `SELECT id FROM "AuctionRound" WHERE seasonId = ? AND resolvedAt IS NULL LIMIT 1`,
    args: [seasonId],
  });
  if (openRes.rows.length > 0) return "C'è già un round non ancora chiuso: chiudilo prima di aprirne uno nuovo.";

  await db.execute({
    sql: `INSERT INTO "AuctionRound" (seasonId, name, startDate, endDate) VALUES (?, ?, ?, ?)`,
    args: [seasonId, name, startDate, endDate],
  });

  revalidateAuctionPaths();
  return null;
}

// ── Admin: chiude un round subito (a prescindere dalla data di fine) ──────
export async function closeAuctionRoundNow(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const roundId = parseInt(formData.get("roundId") as string);
  if (!roundId) return "Round non valido.";

  const result = await resolveRound(roundId);
  revalidateAuctionPaths();

  const parts: string[] = [];
  if (result.winners.length > 0) {
    parts.push(
      `✅ Assegnati ${result.winners.length}: ` +
        result.winners.map((w) => `${w.playerName} → ${w.teamName} (${w.amount})`).join(", ")
    );
  }
  if (result.unsold.length > 0) {
    parts.push(`⚠️ Non assegnati per fondi insufficienti: ${result.unsold.map((u) => u.playerName).join(", ")}`);
  }
  if (parts.length === 0) parts.push("Round chiuso: nessuna offerta ricevuta.");
  return parts.join("\n");
}

// ── Utente: fa (o aggiorna) un'offerta segreta su uno svincolato ─────────
export async function submitBid(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const roundId = parseInt(formData.get("roundId") as string);
  const playerId = parseInt(formData.get("playerId") as string);
  const amount = parseInt(formData.get("amount") as string);

  if (!roundId || !playerId) return "Dati mancanti.";
  if (!Number.isFinite(amount) || amount <= 0) return "Inserisci un'offerta valida (maggiore di zero).";

  const db = getDb();

  const roundRes = await db.execute({
    sql: `SELECT id, startDate, endDate, resolvedAt FROM "AuctionRound" WHERE id = ?`,
    args: [roundId],
  });
  const round = roundRes.rows[0];
  if (!round || round.resolvedAt) return "Questo round non è più aperto.";
  const now = Date.now();
  if (round.startDate && new Date(round.startDate as string).getTime() > now) return "L'asta non è ancora iniziata.";
  if (new Date(round.endDate as string).getTime() <= now) return "L'asta è scaduta.";

  const playerRes = await db.execute({ sql: `SELECT mantraRole FROM "Player" WHERE id = ?`, args: [playerId] });
  const mantraRole = playerRes.rows[0]?.mantraRole as string | undefined;
  if (!mantraRole) return "Giocatore non trovato.";

  const takenRes = await db.execute({ sql: `SELECT id FROM "Roster" WHERE playerId = ?`, args: [playerId] });
  if (takenRes.rows.length > 0) return "Questo giocatore non è più svincolato.";

  const existingRes = await db.execute({
    sql: `SELECT id FROM "SealedBid" WHERE roundId = ? AND playerId = ? AND userId = ?`,
    args: [roundId, playerId, session.userId],
  });
  const existingBidId = existingRes.rows[0]?.id as number | undefined;

  const remaining = await remainingBudget(db, session.userId, existingBidId);
  if (amount > remaining) return `Offerta troppo alta: ti restano ${remaining} crediti disponibili (contando le altre offerte in corso).`;

  // Non ha senso fare un'offerta per un ruolo per cui non c'è più posto in
  // rosa, contando anche le altre offerte pendenti (vedi roleSlotsUsed).
  if (!existingBidId) {
    const limits = await getRosterLimits(db);
    const used = await roleSlotsUsed(db, session.userId);
    const isPor = mantraRole === "POR";
    if (isPor ? used.por >= limits.numPortieri : used.mov >= limits.numMovimento) {
      return isPor
        ? `Slot portieri già al completo (${limits.numPortieri}), contando anche le offerte in corso.`
        : `Slot giocatori di movimento già al completo (${limits.numMovimento}), contando anche le offerte in corso.`;
    }
  }

  if (existingBidId) {
    await db.execute({ sql: `UPDATE "SealedBid" SET amount = ? WHERE id = ?`, args: [amount, existingBidId] });
  } else {
    await db.execute({
      sql: `INSERT INTO "SealedBid" (roundId, playerId, userId, amount) VALUES (?, ?, ?, ?)`,
      args: [roundId, playerId, session.userId, amount],
    });
  }

  revalidatePath("/asta");
  return null;
}

// ── Utente: ritira una propria offerta pendente ───────────────────────────
export async function withdrawBid(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const bidId = parseInt(formData.get("bidId") as string);
  const db = getDb();

  const res = await db.execute({
    sql: `SELECT sb.userId, sb.status, ar.resolvedAt
          FROM "SealedBid" sb JOIN "AuctionRound" ar ON ar.id = sb.roundId
          WHERE sb.id = ?`,
    args: [bidId],
  });
  const bid = res.rows[0];
  if (!bid) return "Offerta non trovata.";
  if (Number(bid.userId) !== session.userId && !session.isAdmin) return "Non autorizzato.";
  if (bid.resolvedAt || bid.status !== "pending") return "Il round è già chiuso.";

  await db.execute({ sql: `DELETE FROM "SealedBid" WHERE id = ?`, args: [bidId] });
  revalidatePath("/asta");
  return null;
}
