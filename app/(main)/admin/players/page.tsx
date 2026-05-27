import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { getDb } from "@/app/lib/db";
import PlayersAdminClient from "./PlayersAdminClient";

export default async function AdminPlayersPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const db = getDb();
  const playersRes = await db.execute(
    `SELECT p.id, p.name, p.realTeam, p.mantraRole, p.fantapiu3Name, u.teamName as assignedTo
     FROM "Player" p
     LEFT JOIN "Roster" r ON r.playerId = p.id
     LEFT JOIN "User" u ON u.id = r.userId
     ORDER BY p.mantraRole ASC, p.name ASC`
  );

  return (
    <PlayersAdminClient
      players={playersRes.rows.map((p) => ({
        id: p.id as number,
        name: p.name as string,
        realTeam: p.realTeam as string,
        mantraRole: p.mantraRole as string,
        fantapiu3Name: p.fantapiu3Name as string | null,
        assignedTo: p.assignedTo as string | null,
      }))}
    />
  );
}
