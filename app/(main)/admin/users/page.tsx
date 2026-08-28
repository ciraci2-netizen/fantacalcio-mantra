import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { getDb } from "@/app/lib/db";
import UsersAdminClient from "./UsersAdminClient";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const db = getDb();

  const usersRes = await db.execute(
    `SELECT id, username, teamName, isAdmin FROM "User" WHERE isParticipant = 1 ORDER BY id ASC`
  );

  const usersData = [];
  for (const user of usersRes.rows) {
    const rosterRes = await db.execute({
      sql: `SELECT r.id, r.playerId, r.purchasePrice,
                   p.name as playerName, p.mantraRole as playerRole, p.realTeam as playerTeam
            FROM "Roster" r
            JOIN "Player" p ON p.id = r.playerId
            WHERE r.userId = ?
            ORDER BY p.mantraRole ASC, p.name ASC`,
      args: [user.id],
    });
    usersData.push({
      id: user.id as number,
      username: user.username as string,
      teamName: user.teamName as string,
      isAdmin: Boolean(user.isAdmin),
      roster: rosterRes.rows.map((r) => ({
        id: r.id as number,
        playerId: r.playerId as number,
        playerName: r.playerName as string,
        playerRole: r.playerRole as string,
        playerTeam: r.playerTeam as string,
        purchasePrice: r.purchasePrice as number,
      })),
    });
  }

  const assignedRes = await db.execute(`SELECT playerId FROM "Roster"`);
  const assignedIds = new Set(assignedRes.rows.map((r) => r.playerId as number));

  const allPlayersRes = await db.execute(
    `SELECT id, name, realTeam, mantraRole FROM "Player" ORDER BY mantraRole ASC, name ASC`
  );
  const availablePlayers = allPlayersRes.rows
    .filter((p) => !assignedIds.has(p.id as number))
    .map((p) => ({
      id: p.id as number,
      name: p.name as string,
      realTeam: p.realTeam as string,
      mantraRole: p.mantraRole as string,
    }));

  return (
    <UsersAdminClient
      users={usersData}
      availablePlayers={availablePlayers}
    />
  );
}
