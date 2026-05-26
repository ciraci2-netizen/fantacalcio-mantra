import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import PlayersAdminClient from "./PlayersAdminClient";

export default async function AdminPlayersPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const players = await prisma.player.findMany({
    orderBy: [{ mantraRole: "asc" }, { name: "asc" }],
    include: { roster: { include: { user: true } } },
  });

  return (
    <PlayersAdminClient
      players={players.map((p) => ({
        id: p.id,
        name: p.name,
        realTeam: p.realTeam,
        mantraRole: p.mantraRole,
        fantapiu3Name: p.fantapiu3Name,
        assignedTo: p.roster[0]?.user.teamName ?? null,
      }))}
    />
  );
}
