import type { Metadata } from "next";
import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import ScambiClient from "./ScambiClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scambi" };

export default async function ScambiPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const seasonRes = await db.execute(`SELECT id FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return <div className="text-center py-12 text-gray-500">Nessuna stagione attiva.</div>;
  }

  const seasonId = season.id as number;

  // My roster
  const myRosterRes = await db.execute({
    sql: `SELECT p.id, p.name, p.mantraRole, p.realTeam
          FROM "Roster" r
          JOIN "Player" p ON p.id = r.playerId
          WHERE r.userId = ?
          ORDER BY p.mantraRole ASC, p.name ASC`,
    args: [session.userId],
  });

  // All other users and their rosters
  const usersRes = await db.execute({
    sql: `SELECT u.id, u.teamName, u.username FROM "User" u WHERE u.isParticipant = 1 AND u.id != ? ORDER BY u.teamName ASC`,
    args: [session.userId],
  });

  const otherUsers = await Promise.all(
    usersRes.rows.map(async (u) => {
      const rosterRes = await db.execute({
        sql: `SELECT p.id, p.name, p.mantraRole, p.realTeam
              FROM "Roster" r
              JOIN "Player" p ON p.id = r.playerId
              WHERE r.userId = ?
              ORDER BY p.mantraRole ASC, p.name ASC`,
        args: [u.id],
      });
      return {
        id: u.id as number,
        teamName: u.teamName as string,
        username: u.username as string,
        roster: rosterRes.rows.map((p) => ({
          id: p.id as number,
          name: p.name as string,
          mantraRole: p.mantraRole as string,
          realTeam: p.realTeam as string,
        })),
      };
    })
  );

  // All trade offers involving me (incoming + outgoing)
  let trades: {
    id: number;
    status: string;
    note: string;
    createdAt: string;
    fromUserId: number;
    toUserId: number;
    fromTeam: string;
    toTeam: string;
    offeredPlayerName: string;
    offeredPlayerRole: string;
    requestedPlayerName: string;
    requestedPlayerRole: string;
  }[] = [];

  try {
    const tradesRes = await db.execute({
      sql: `SELECT t.id, t.status, t.note, t.createdAt,
                   t.fromUserId, t.toUserId,
                   fu.teamName as fromTeam, tu.teamName as toTeam,
                   op.name as offeredPlayerName, op.mantraRole as offeredPlayerRole,
                   rp.name as requestedPlayerName, rp.mantraRole as requestedPlayerRole
            FROM "TradeOffer" t
            JOIN "User" fu ON fu.id = t.fromUserId
            JOIN "User" tu ON tu.id = t.toUserId
            JOIN "Player" op ON op.id = t.offeredPlayerId
            JOIN "Player" rp ON rp.id = t.requestedPlayerId
            WHERE t.seasonId = ? AND (t.fromUserId = ? OR t.toUserId = ?)
            ORDER BY t.createdAt DESC
            LIMIT 50`,
      args: [seasonId, session.userId, session.userId],
    });

    trades = tradesRes.rows.map((r) => ({
      id: r.id as number,
      status: r.status as string,
      note: r.note as string,
      createdAt: r.createdAt as string,
      fromUserId: r.fromUserId as number,
      toUserId: r.toUserId as number,
      fromTeam: r.fromTeam as string,
      toTeam: r.toTeam as string,
      offeredPlayerName: r.offeredPlayerName as string,
      offeredPlayerRole: r.offeredPlayerRole as string,
      requestedPlayerName: r.requestedPlayerName as string,
      requestedPlayerRole: r.requestedPlayerRole as string,
    }));
  } catch { /* table not yet created — autoMigrate runs on next request */ }

  return (
    <ScambiClient
      myUserId={session.userId}
      myTeamName={session.teamName}
      myRoster={myRosterRes.rows.map((p) => ({
        id: p.id as number,
        name: p.name as string,
        mantraRole: p.mantraRole as string,
        realTeam: p.realTeam as string,
      }))}
      otherUsers={otherUsers}
      trades={trades}
    />
  );
}
