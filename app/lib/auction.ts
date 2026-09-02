import type { Client } from "@libsql/client/http";
import { getDb } from "./db";
import { getRosterLimits } from "./leagueSettings";

/**
 * Asta a buste sugli svincolati.
 *
 * Un solo round aperto per stagione: l'admin imposta inizio/fine, ogni
 * partecipante può fare UNA offerta segreta per giocatore (invisibile agli
 * altri finché il round non si chiude — vedi app/actions/auction.ts per la
 * sottomissione). Alla chiusura vince l'offerta più alta per ciascun
 * giocatore; a parità vince la più vecchia (chi ha offerto per primo).
 *
 * Non c'è un cron dedicato: la chiusura/assegnazione scatta "pigramente" al
 * primo caricamento di /asta o /admin/asta dopo la scadenza (vedi
 * resolveExpiredRounds), oppure subito se l'admin chiude il round a mano.
 */

export interface AuctionWinner {
  playerId: number;
  playerName: string;
  userId: number;
  teamName: string;
  amount: number;
}

export interface AuctionUnsold {
  playerId: number;
  playerName: string;
  reason: "fondi insufficienti" | "slot rosa pieni";
}

export interface ResolveResult {
  winners: AuctionWinner[];
  unsold: AuctionUnsold[];
}

/** Vero se un round con questa startDate non è ancora iniziato (o non ne ha una). */
export function isRoundNotStarted(startDate: string | null): boolean {
  return Boolean(startDate && new Date(startDate).getTime() > Date.now());
}

/**
 * Budget residuo di un utente: crediti totali meno quanto già speso in rosa
 * meno quanto già "impegnato" in offerte pendenti su round non ancora
 * chiusi (così non si possono promettere più crediti di quanti se ne hanno,
 * sommando più offerte contemporanee). `excludeBidId` esclude la propria
 * offerta quando la si sta modificando.
 */
export async function remainingBudget(db: Client, userId: number, excludeBidId?: number): Promise<number> {
  const [creditsRes, rosterRes, pendingRes] = await Promise.all([
    db.execute({ sql: `SELECT credits FROM "User" WHERE id = ?`, args: [userId] }),
    db.execute({ sql: `SELECT COALESCE(SUM(purchasePrice),0) as s FROM "Roster" WHERE userId = ?`, args: [userId] }),
    db.execute({
      sql: `SELECT COALESCE(SUM(sb.amount),0) as s
            FROM "SealedBid" sb JOIN "AuctionRound" ar ON ar.id = sb.roundId
            WHERE sb.userId = ? AND sb.status = 'pending' AND ar.resolvedAt IS NULL AND sb.id != ?`,
      args: [userId, excludeBidId ?? -1],
    }),
  ]);
  const credits = (creditsRes.rows[0]?.credits as number) ?? 0;
  const rosterSpent = (rosterRes.rows[0]?.s as number) ?? 0;
  const pendingSpent = (pendingRes.rows[0]?.s as number) ?? 0;
  return credits - rosterSpent - pendingSpent;
}

/**
 * Slot di rosa (portieri / movimento) già occupati da un utente, contando
 * sia la rosa attuale sia le proprie offerte pendenti su round non ancora
 * chiusi (così non si può fare offerte per più portieri di quanti slot
 * liberi si abbiano, sommando più offerte contemporanee). `excludeBidId`
 * esclude la propria offerta quando la si sta modificando.
 */
export async function roleSlotsUsed(
  db: Client,
  userId: number,
  excludeBidId?: number
): Promise<{ por: number; mov: number }> {
  const [rosterRes, pendingRes] = await Promise.all([
    db.execute({
      sql: `SELECT p.mantraRole FROM "Roster" r JOIN "Player" p ON p.id = r.playerId WHERE r.userId = ?`,
      args: [userId],
    }),
    db.execute({
      sql: `SELECT p.mantraRole
            FROM "SealedBid" sb
            JOIN "AuctionRound" ar ON ar.id = sb.roundId
            JOIN "Player" p ON p.id = sb.playerId
            WHERE sb.userId = ? AND sb.status = 'pending' AND ar.resolvedAt IS NULL AND sb.id != ?`,
      args: [userId, excludeBidId ?? -1],
    }),
  ]);
  let por = 0;
  let mov = 0;
  for (const row of [...rosterRes.rows, ...pendingRes.rows]) {
    if ((row.mantraRole as string) === "POR") por++;
    else mov++;
  }
  return { por, mov };
}

/** Id dei round scaduti (endDate passata) ma non ancora risolti, per una stagione. */
export async function findExpiredOpenRoundIds(db: Client, seasonId: number): Promise<number[]> {
  const res = await db.execute({
    sql: `SELECT id FROM "AuctionRound" WHERE seasonId = ? AND resolvedAt IS NULL AND endDate <= datetime('now')`,
    args: [seasonId],
  });
  return res.rows.map((r) => r.id as number);
}

/**
 * Risolve tutti i round scaduti di una stagione. Va chiamata a ogni
 * caricamento di /asta e /admin/asta: se non c'è nulla di scaduto non fa
 * nulla, quindi è sicura ed economica da richiamare spesso.
 */
export async function resolveExpiredRounds(seasonId: number): Promise<void> {
  const db = getDb();
  const ids = await findExpiredOpenRoundIds(db, seasonId);
  for (const id of ids) {
    await resolveRound(id);
  }
}

/**
 * Chiude e assegna un round: per ogni giocatore con almeno un'offerta
 * pendente, vince l'offerta più alta (a parità la più vecchia) fra quelle
 * che il vincitore può davvero permettersi — se anche la migliore offerta
 * supera il budget residuo di chi l'ha fatta (caso limite: è già successo
 * qualcos'altro nel frattempo), si passa alla successiva.
 * Idempotente: un round già risolto (resolvedAt valorizzato) non viene
 * ritoccato e ritorna risultati vuoti.
 */
export async function resolveRound(roundId: number): Promise<ResolveResult> {
  const db = getDb();

  const roundRes = await db.execute({ sql: `SELECT id, resolvedAt FROM "AuctionRound" WHERE id = ?`, args: [roundId] });
  const round = roundRes.rows[0];
  if (!round || round.resolvedAt) return { winners: [], unsold: [] };

  const bidsRes = await db.execute({
    sql: `SELECT sb.id, sb.playerId, sb.userId, sb.amount, p.name as playerName, p.mantraRole, u.teamName, u.credits
          FROM "SealedBid" sb
          JOIN "Player" p ON p.id = sb.playerId
          JOIN "User" u ON u.id = sb.userId
          WHERE sb.roundId = ? AND sb.status = 'pending'
          ORDER BY sb.playerId ASC, sb.amount DESC, sb.createdAt ASC`,
    args: [roundId],
  });

  const limits = await getRosterLimits(db);

  // Giocatori già assegnati nel frattempo (es. l'admin li ha messi in rosa a
  // mano da "Gestione Rose" mentre il round era aperto): le offerte relative
  // decadono, il giocatore non è più uno svincolato da assegnare qui.
  const takenRes = await db.execute(`SELECT playerId FROM "Roster"`);
  const taken = new Set(takenRes.rows.map((r) => r.playerId as number));

  const rosterSpentRes = await db.execute(
    `SELECT userId, COALESCE(SUM(purchasePrice),0) as s FROM "Roster" GROUP BY userId`
  );
  const rosterSpent = new Map<number, number>();
  for (const r of rosterSpentRes.rows) rosterSpent.set(r.userId as number, r.s as number);

  const rosterRolesRes = await db.execute(
    `SELECT r.userId, p.mantraRole FROM "Roster" r JOIN "Player" p ON p.id = r.playerId`
  );
  const slotsUsed = new Map<number, { por: number; mov: number }>();
  for (const r of rosterRolesRes.rows) {
    const uid = r.userId as number;
    const cur = slotsUsed.get(uid) ?? { por: 0, mov: 0 };
    if ((r.mantraRole as string) === "POR") cur.por++; else cur.mov++;
    slotsUsed.set(uid, cur);
  }

  // Quanto ciascun utente sta già "spendendo"/occupando fra i giocatori
  // assegnati in QUESTO stesso round, mano a mano che si procede — evita che
  // qualcuno vinca più giocatori di quanti crediti o slot di rosa abbia.
  const spentThisRound = new Map<number, number>();

  type Bid = {
    id: number; playerId: number; userId: number; amount: number;
    playerName: string; mantraRole: string; teamName: string; credits: number;
  };
  const byPlayer = new Map<number, Bid[]>();
  for (const row of bidsRes.rows) {
    const bid: Bid = {
      id: row.id as number,
      playerId: row.playerId as number,
      userId: row.userId as number,
      amount: row.amount as number,
      playerName: row.playerName as string,
      mantraRole: row.mantraRole as string,
      teamName: row.teamName as string,
      credits: row.credits as number,
    };
    if (!byPlayer.has(bid.playerId)) byPlayer.set(bid.playerId, []);
    byPlayer.get(bid.playerId)!.push(bid);
  }

  const winners: AuctionWinner[] = [];
  const unsold: AuctionUnsold[] = [];
  const winningBidIds: number[] = [];
  const losingBidIds: number[] = [];

  for (const [playerId, bids] of byPlayer) {
    if (taken.has(playerId)) {
      for (const b of bids) losingBidIds.push(b.id);
      continue;
    }

    // bids è già ordinato per amount DESC, poi createdAt ASC (pareggio → prima offerta)
    let winner: Bid | null = null;
    let skippedForSlots = false;
    for (const b of bids) {
      const already = spentThisRound.get(b.userId) ?? 0;
      const remaining = b.credits - (rosterSpent.get(b.userId) ?? 0) - already;
      if (b.amount > remaining) continue;

      const used = slotsUsed.get(b.userId) ?? { por: 0, mov: 0 };
      const isPor = b.mantraRole === "POR";
      const full = isPor ? used.por >= limits.numPortieri : used.mov >= limits.numMovimento;
      if (full) { skippedForSlots = true; continue; }

      winner = b;
      break;
    }

    if (!winner) {
      for (const b of bids) losingBidIds.push(b.id);
      unsold.push({
        playerId, playerName: bids[0].playerName,
        reason: skippedForSlots ? "slot rosa pieni" : "fondi insufficienti",
      });
      continue;
    }

    for (const b of bids) (b.id === winner.id ? winningBidIds : losingBidIds).push(b.id);
    spentThisRound.set(winner.userId, (spentThisRound.get(winner.userId) ?? 0) + winner.amount);
    {
      const used = slotsUsed.get(winner.userId) ?? { por: 0, mov: 0 };
      if (winner.mantraRole === "POR") used.por++; else used.mov++;
      slotsUsed.set(winner.userId, used);
    }
    taken.add(playerId);

    await db.execute({
      sql: `INSERT INTO "Roster" (userId, playerId, purchasePrice) VALUES (?, ?, ?)`,
      args: [winner.userId, playerId, winner.amount],
    });
    winners.push({
      playerId, playerName: winner.playerName,
      userId: winner.userId, teamName: winner.teamName, amount: winner.amount,
    });
  }

  for (const id of winningBidIds) {
    await db.execute({ sql: `UPDATE "SealedBid" SET status = 'won' WHERE id = ?`, args: [id] });
  }
  for (const id of losingBidIds) {
    await db.execute({ sql: `UPDATE "SealedBid" SET status = 'lost' WHERE id = ?`, args: [id] });
  }

  await db.execute({ sql: `UPDATE "AuctionRound" SET resolvedAt = datetime('now') WHERE id = ?`, args: [roundId] });

  return { winners, unsold };
}
