import type { Metadata } from "next";
import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import { resolveExpiredRounds, remainingBudget, roleSlotsUsed, isRoundNotStarted } from "@/app/lib/auction";
import { getRosterLimits } from "@/app/lib/leagueSettings";
import { MANTRA_ROLES } from "@/app/lib/scoring";
import AstaClient from "./AstaClient";
import AstaHistory from "./AstaHistory";

export const metadata: Metadata = { title: "Asta buste" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  POR: "Portieri", DC: "Difensori Centrali", TER: "Terzini",
  M: "Mediani", OFF: "Offensivi", ATT: "Attaccanti",
};

export default async function AstaPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const seasonRes = await db.execute(`SELECT id FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const seasonId = seasonRes.rows[0]?.id as number | undefined;

  if (!seasonId) {
    return <div className="text-center py-12 text-gray-500">Nessuna stagione attiva al momento.</div>;
  }

  await resolveExpiredRounds(seasonId);

  // Storico completo: le offerte di TUTTI (non solo le proprie) nei round
  // gia chiusi di questa stagione - prima si vedevano solo le proprie offerte,
  // ma lo storico di chi ha preso/svincolato cosa e chi ha offerto quanto e
  // ora visibile a chiunque, non solo all'admin (stessa vista di /admin/asta,
  // qui in sola lettura).
  const pastRoundsRes = await db.execute({
    sql: `SELECT id, name, resolvedAt FROM "AuctionRound"
          WHERE seasonId = ? AND resolvedAt IS NOT NULL ORDER BY id DESC LIMIT 10`,
    args: [seasonId],
  });
  type HistoryBid = {
    playerId: number; playerName: string; mantraRole: string; teamName: string;
    amount: number; status: string; releasedPlayerName: string | null; unsoldReason: string | null;
  };
  const myHistory = await Promise.all(
    pastRoundsRes.rows.map(async (r) => {
      const bidsRes = await db.execute({
        sql: `SELECT sb.playerId, sb.amount, sb.status, p.name as playerName, p.mantraRole,
                     u.teamName, rp.name as releasedPlayerName
              FROM "SealedBid" sb
              JOIN "Player" p ON p.id = sb.playerId
              JOIN "User" u ON u.id = sb.userId
              LEFT JOIN "Player" rp ON rp.id = sb.releasePlayerId
              WHERE sb.roundId = ?
              ORDER BY sb.playerId ASC, sb.amount DESC`,
        args: [r.id],
      });
      const unsoldRes = await db.execute({
        sql: `SELECT playerId, reason FROM "AuctionUnsold" WHERE roundId = ?`,
        args: [r.id],
      });
      const unsoldReasons: Record<number, string> = {};
      for (const u of unsoldRes.rows) unsoldReasons[u.playerId as number] = u.reason as string;

      const bids: HistoryBid[] = bidsRes.rows.map((b) => ({
        playerId: b.playerId as number,
        playerName: b.playerName as string,
        mantraRole: b.mantraRole as string,
        teamName: b.teamName as string,
        amount: b.amount as number,
        status: b.status as string,
        releasedPlayerName: (b.releasedPlayerName as string | null) ?? null,
        unsoldReason: unsoldReasons[b.playerId as number] ?? null,
      }));
      return { roundId: r.id as number, roundName: r.name as string, resolvedAt: r.resolvedAt as string, bids };
    })
  );

  const roundRes = await db.execute({
    sql: `SELECT id, name, startDate, endDate FROM "AuctionRound"
          WHERE seasonId = ? AND resolvedAt IS NULL ORDER BY id DESC LIMIT 1`,
    args: [seasonId],
  });
  const roundRow = roundRes.rows[0] ?? null;

  if (!roundRow) {
    return (
      <div className="space-y-6">
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">{"\u{1F528}"}</div>
          <p className="font-medium text-gray-500">Nessuna asta aperta al momento.</p>
          <p className="text-sm mt-1">L&apos;admin aprira un nuovo round quando ci saranno svincolati da assegnare.</p>
        </div>
        <AstaHistory history={myHistory} myTeamName={session.teamName} />
      </div>
    );
  }

  const round = {
    id: roundRow.id as number,
    name: roundRow.name as string,
    startDate: roundRow.startDate as string | null,
    endDate: roundRow.endDate as string,
  };
  const notStarted = isRoundNotStarted(round.startDate);

  const [playersRes, myBidsRes, limits, slotsUsed, myRosterRes] = await Promise.all([
    db.execute(
      `SELECT p.id, p.name, p.realTeam, p.mantraRole
       FROM "Player" p
       WHERE p.id NOT IN (SELECT playerId FROM "Roster")
       ORDER BY p.mantraRole ASC, p.name ASC`
    ),
    db.execute({
      sql: `SELECT id, playerId, amount, releasePlayerId FROM "SealedBid" WHERE roundId = ? AND userId = ? AND status = 'pending'`,
      args: [round.id, session.userId],
    }),
    getRosterLimits(db),
    roleSlotsUsed(db, session.userId),
    db.execute({
      sql: `SELECT p.id, p.name, p.mantraRole
            FROM "Roster" r JOIN "Player" p ON p.id = r.playerId
            WHERE r.userId = ? ORDER BY p.mantraRole ASC, p.name ASC`,
      args: [session.userId],
    }),
  ]);

  const remaining = await remainingBudget(db, session.userId);

  // Conteggio offerte per giocatore (nessun importo, nessun nome — solo "quante" per dare un'idea della concorrenza)
  const bidCountsRes = await db.execute({
    sql: `SELECT playerId, COUNT(*) as c FROM "SealedBid" WHERE roundId = ? AND status = 'pending' GROUP BY playerId`,
    args: [round.id],
  });
  const bidCounts: Record<number, number> = {};
  for (const r of bidCountsRes.rows) bidCounts[r.playerId as number] = r.c as number;

  const players = playersRes.rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    realTeam: r.realTeam as string,
    mantraRole: r.mantraRole as string,
    bidCount: bidCounts[r.id as number] ?? 0,
  }));

  const myBids: Record<number, { bidId: number; amount: number; releasePlayerId: number | null }> = {};
  for (const b of myBidsRes.rows) {
    myBids[b.playerId as number] = {
      bidId: b.id as number,
      amount: b.amount as number,
      releasePlayerId: (b.releasePlayerId as number | null) ?? null,
    };
  }

  const myRoster = myRosterRes.rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    mantraRole: r.mantraRole as string,
  }));

  const countByRole: Record<string, number> = {};
  for (const p of players) countByRole[p.mantraRole] = (countByRole[p.mantraRole] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <AstaClient
        round={round}
        notStarted={notStarted}
        players={players}
        myBids={myBids}
        myRoster={myRoster}
        remainingBudget={remaining}
        slotsUsed={slotsUsed}
        limits={limits}
        countByRole={countByRole}
        roleLabel={ROLE_LABEL}
        roles={MANTRA_ROLES as unknown as string[]}
      />
      <AstaHistory history={myHistory} myTeamName={session.teamName} />
    </div>
  );
}
