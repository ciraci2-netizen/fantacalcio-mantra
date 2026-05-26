import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import ScheduleAdminClient from "./ScheduleAdminClient";

export default async function AdminSchedulePage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const seasons = await prisma.season.findMany({
    orderBy: { id: "desc" },
    include: { matchdays: { orderBy: { number: "asc" } } },
  });

  const activeSeason = seasons.find((s) => s.isActive) ?? null;

  return (
    <ScheduleAdminClient
      seasons={seasons.map((s) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive,
        currentMatchday: s.currentMatchday,
        matchdayCount: s.matchdays.length,
        matchdays: s.matchdays.map((m) => ({ id: m.id, number: m.number, isLocked: m.isLocked, votesImported: m.votesImported })),
      }))}
      activeSeasonId={activeSeason?.id ?? null}
    />
  );
}
