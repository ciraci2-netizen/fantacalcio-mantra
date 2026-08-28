import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { getDb } from "@/app/lib/db";
import { getRosterLimits } from "@/app/lib/leagueSettings";
import RosterAdminClient from "./RosterAdminClient";

export default async function AdminRosterPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/dashboard");

  const db = getDb();
  const rosterLimits = await getRosterLimits(db);

  // Tutti gli utenti con le loro rose (in un'unica query per efficienza)
  const usersRes = await db.execute(
    `SELECT id, teamName, username, credits, logoUrl FROM "User" WHERE isParticipant = 1 ORDER BY teamName ASC`
  );

  const rosterRes = await db.execute(
    `SELECT r.id, r.userId, r.playerId, r.purchasePrice,
            p.name, p.mantraRole, p.realTeam
     FROM "Roster" r
     JOIN "Player" p ON p.id = r.playerId
     ORDER BY r.userId ASC, p.mantraRole ASC, p.name ASC`
  );

  // Raggruppa per userId
  const rosterByUser = new Map<number, {
    id: number; playerId: number; purchasePrice: number;
    name: string; mantraRole: string; realTeam: string;
  }[]>();
  for (const r of rosterRes.rows) {
    const uid = r.userId as number;
    if (!rosterByUser.has(uid)) rosterByUser.set(uid, []);
    rosterByUser.get(uid)!.push({
      id: r.id as number,
      playerId: r.playerId as number,
      purchasePrice: r.purchasePrice as number,
      name: r.name as string,
      mantraRole: r.mantraRole as string,
      realTeam: r.realTeam as string,
    });
  }

  const users = usersRes.rows.map((u) => ({
    id: u.id as number,
    teamName: u.teamName as string,
    username: u.username as string,
    credits: u.credits as number,
    logoUrl: u.logoUrl as string | null,
    roster: rosterByUser.get(u.id as number) ?? [],
  }));

  // Svincolati
  const assignedIds = new Set(rosterRes.rows.map((r) => r.playerId as number));
  const allPlayersRes = await db.execute(
    `SELECT id, name, realTeam, mantraRole FROM "Player" ORDER BY mantraRole ASC, name ASC`
  );
  const freePlayers = allPlayersRes.rows
    .filter((p) => !assignedIds.has(p.id as number))
    .map((p) => ({
      id: p.id as number,
      name: p.name as string,
      realTeam: p.realTeam as string,
      mantraRole: p.mantraRole as string,
    }));

  return (
    <RosterAdminClient users={users} freePlayers={freePlayers} rosterLimits={rosterLimits} />
  );
}
