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

// --- Admin: apre un nuovo round (fallisce se ce n'e gia uno non risolto) ---
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
  if (openRes.rows.length > 0) return "C'e gia un round non ancora chiuso: chiudilo prima di aprirne uno nuovo.";

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
        result.winners
          .map((w) => `${w.playerName} -> ${w.teamName} (${w.amount})${w.releasedPlayerName ? ` [svincolato ${w.releasedPlayerName}]` : ""}`)
          .join(", ")
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
  const releaseRaw = (formData.get("releasePlayerId") as string) || "";
  const releasePlayerId = releaseRaw ? parseInt(releaseRaw) : null;

  if (!roundId || !playerId) return "Dati mancanti.";
  if (!Number.isFinite(amount) || amount <= 0) return "Inserisci un'offerta valida (maggiore di zero).";

  const db = getDb();

  const roundRes = await db.execute({
    sql: `SELECT id, startDate, endDate, resolvedAt FROM "AuctionRound" WHERE id = ?`,
    args: [roundId],
  });
  const round = roundRes.rows[0];
  if (!round || round.resolvedAt) return "Questo round non e piu aperto.";
  const now = Date.now();
  if (round.startDate && new Date(round.startDate as string).getTime() > now) return "L'asta non e ancora iniziata.";
  if (new Date(round.endDate as string).getTime() <= now) return "L'asta e scaduta.";

  const playerRes = await db.execute({ sql: `SELECT mantraRole FROM "Player" WHERE id = ?`, args: [playerId] });
  const mantraRole = playerRes.rows[0]?.mantraRole as string | undefined;
  if (!mantraRole) return "Giocatore non trovato.";

  const takenRes = await db.execute({ sql: `SELECT id FROM "Roster" WHERE playerId = ?`, args: [playerId] });
  if (takenRes.rows.length > 0) return "Questo giocatore non e piu svincolato.";

  const existingRes = await db.execute({
    sql: `SELECT id FROM "SealedBid" WHERE roundId = ? AND playerId = ? AND userId = ?`,
    args: [roundId, playerId, session.userId],
  });
  const existingBidId = existingRes.rows[0]?.id as number | undefined;

  const remaining = await remainingBudget(db, session.userId, existingBidId);
  if (amount > remaining) return `Offerta troppo alta: ti restano ${remaining} crediti disponibili (contando le altre offerte in corso).`;

  // Svincolo contestuale: se indicato, deve essere un TUO giocatore in
  // rosa, dello stesso "pool" del giocatore che stai cercando di prendere
  // (portiere per portiere, movimento per movimento - i ruoli DC/TER/M/OFF/
  // ATT condividono lo stesso slot), e non gia promesso a un'altra tua
  // offerta pendente (non ha senso pensare di svincolare due volte lo
  // stesso giocatore per due offerte diverse).
  const isPor = mantraRole === "POR";
  if (releasePlayerId) {
    const releaseRes = await db.execute({
      sql: `SELECT p.mantraRole FROM "Roster" r JOIN "Player" p ON p.id = r.playerId WHERE r.userId = ? AND r.playerId = ?`,
      args: [session.userId, releasePlayerId],
    });
    const releaseRole = releaseRes.rows[0]?.mantraRole as string | undefined;
    if (!releaseRole) return "Il giocatore da svincolare selezionato non e nella tua rosa.";
    const releaseIsPor = releaseRole === "POR";
    if (releaseIsPor !== isPor) {
      return "Il giocatore da svincolare deve essere dello stesso tipo di slot (portiere/movimento) di quello che stai prendendo.";
    }
    const pledgedRes = await db.execute({
      sql: `SELECT sb.id FROM "SealedBid" sb JOIN "AuctionRound" ar ON ar.id = sb.roundId
            WHERE sb.userId = ? AND sb.releasePlayerId = ? AND sb.status = 'pending' AND ar.resolvedAt IS NULL AND sb.id != ?`,
      args: [session.userId, releasePlayerId, existingBidId ?? -1],
    });
    if (pledgedRes.rows.length > 0) {
      return "Hai gia indicato questo giocatore come svincolo per un'altra offerta in corso.";
    }
  }

  // Non ha senso fare un'offerta per un ruolo per cui non c'e piu posto in
  // rosa, contando anche le altre offerte pendenti (vedi roleSlotsUsed) - a
  // meno che l'offerta non porti con se uno svincolo valido, che libera lo
  // slot al posto suo.
  if (!existingBidId && !releasePlayerId) {
    const limits = await getRosterLimits(db);
    const used = await roleSlotsUsed(db, session.userId);
    if (isPor ? used.por >= limits.numPortieri : used.mov >= limits.numMovimento) {
      return (isPor
        ? `Slot portieri gia al completo (${limits.numPortieri}): scegli quale portiere svincolare per fare posto.`
        : `Slot giocatori di movimento gia al completo (${limits.numMovimento}): scegli quale giocatore svincolare per fare posto.`);
    }
  }

  if (existingBidId) {
    await db.execute({ sql: `UPDATE "SealedBid" SET amount = ?, releasePlayerId = ? WHERE id = ?`, args: [amount, releasePlayerId, existingBidId] });
  } else {
    await db.execute({
      sql: `INSERT INTO "SealedBid" (roundId, playerId, userId, amount, releasePlayerId) VALUES (?, ?, ?, ?, ?)`,
      args: [roundId, playerId, session.userId, amount, releasePlayerId],
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
  if (bid.resolvedAt || bid.status !== "pending") return "Il round e gia chiuso.";

  await db.execute({ sql: `DELETE FROM "SealedBid" WHERE id = ?`, args: [bidId] });
  revalidatePath("/asta");
  return null;
}
