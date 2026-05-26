import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import UsersAdminClient from "./UsersAdminClient";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const users = await prisma.user.findMany({
    where: { isAdmin: false },
    include: {
      roster: { include: { player: true } },
    },
    orderBy: { id: "asc" },
  });

  const allPlayers = await prisma.player.findMany({
    orderBy: [{ mantraRole: "asc" }, { name: "asc" }],
  });

  const assignedPlayerIds = new Set(
    users.flatMap((u) => u.roster.map((r) => r.playerId))
  );

  return (
    <UsersAdminClient
      users={users.map((u) => ({
        id: u.id,
        username: u.username,
        teamName: u.teamName,
        roster: u.roster.map((r) => ({
          id: r.id,
          playerId: r.playerId,
          playerName: r.player.name,
          playerRole: r.player.mantraRole,
          playerTeam: r.player.realTeam,
          purchasePrice: r.purchasePrice,
        })),
      }))}
      availablePlayers={allPlayers
        .filter((p) => !assignedPlayerIds.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, realTeam: p.realTeam, mantraRole: p.mantraRole }))}
    />
  );
}
