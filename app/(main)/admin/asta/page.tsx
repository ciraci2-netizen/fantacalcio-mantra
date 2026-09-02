import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import { resolveExpiredRounds, isRoundNotStarted } from "@/app/lib/auction";
import AdminAstaClient from "./AdminAstaClient";

export const metadata: Metadata = { title: "Admin — Asta buste" };
export const dynamic = "force-dynamic";

export default async function AdminAstaPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const db = getDb();

  const seasonRes = await db.execute(`SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nessuna stagione attiva. Crea prima una stagione in Calendario.
      </div>
    );
  }

  const seasonId = season.id as number;

  // Chiude "pigramente" ogni round scaduto prima di mostrare la pagina.
  await resolveExpiredRounds(seasonId);

  const currentRoundRes = await db.execute({
    sql: `SELECT id, name, startDate, endDate, createdAt FROM "AuctionRound"
          WHERE seasonId = ? AND resolvedAt IS NULL ORDER BY id DESC LIMIT 1`,
    args: [seasonId],
  });
  const currentRoundRow = currentRoundRes.rows[0] ?? null;

  let currentRound: {
    id: number; name: string; startDate: string | null; endDate: string; bidCount: number; notStarted: boolean;
  } | null = null;

  if (currentRoundRow) {
    const bidCountRes = await db.execute({
      sql: `SELECT COUNT(*) as c FROM "SealedBid" WHERE roundId = ? AND status = 'pending'`,
      args: [currentRoundRow.id],
    });
    const startDate = currentRoundRow.startDate as string | null;
    currentRound = {
      id: currentRoundRow.id as number,
      name: currentRoundRow.name as string,
      startDate,
      endDate: currentRoundRow.endDate as string,
      bidCount: bidCountRes.rows[0].c as number,
      notStarted: isRoundNotStarted(startDate),
    };
  }

  // Storico round risolti, con tutte le offerte rivelate (vinte e perse).
  const pastRoundsRes = await db.execute({
    sql: `SELECT id, name, startDate, endDate, resolvedAt FROM "AuctionRound"
          WHERE seasonId = ? AND resolvedAt IS NOT NULL ORDER BY id DESC LIMIT 10`,
    args: [seasonId],
  });

  const pastRounds = await Promise.all(
    pastRoundsRes.rows.map(async (r) => {
      const bidsRes = await db.execute({
        sql: `SELECT sb.playerId, sb.userId, sb.amount, sb.status, p.name as playerName, u.teamName
              FROM "SealedBid" sb
              JOIN "Player" p ON p.id = sb.playerId
              JOIN "User" u ON u.id = sb.userId
              WHERE sb.roundId = ?
              ORDER BY sb.playerId ASC, sb.amount DESC`,
        args: [r.id],
      });
      return {
        id: r.id as number,
        name: r.name as string,
        startDate: r.startDate as string | null,
        endDate: r.endDate as string,
        resolvedAt: r.resolvedAt as string,
        bids: bidsRes.rows.map((b) => ({
          playerId: b.playerId as number,
          playerName: b.playerName as string,
          teamName: b.teamName as string,
          amount: b.amount as number,
          status: b.status as string,
        })),
      };
    })
  );

  const freeCountRes = await db.execute(
    `SELECT COUNT(*) as c FROM "Player" WHERE id NOT IN (SELECT playerId FROM "Roster")`
  );

  return (
    <AdminAstaClient
      seasonName={season.name as string}
      currentRound={currentRound}
      pastRounds={pastRounds}
      freeCount={freeCountRes.rows[0].c as number}
    />
  );
}
