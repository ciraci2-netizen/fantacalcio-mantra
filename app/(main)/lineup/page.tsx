import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import LineupForm from "./LineupForm";

export default async function LineupPage() {
  const session = await getSession();
  if (!session) return null;

  const season = await prisma.season.findFirst({ where: { isActive: true } });
  if (!season) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nessuna stagione attiva. Attendi che l&apos;admin configuri il campionato.
      </div>
    );
  }

  const matchday = await prisma.matchday.findFirst({
    where: { seasonId: season.id, number: season.currentMatchday },
  });

  if (!matchday) {
    return <div className="text-center py-12 text-gray-500">Giornata non trovata.</div>;
  }

  const roster = await prisma.roster.findMany({
    where: { userId: session.userId },
    include: { player: true },
    orderBy: [{ player: { mantraRole: "asc" } }, { player: { name: "asc" } }],
  });

  const existingLineup = await prisma.lineup.findFirst({
    where: { userId: session.userId, matchdayId: matchday.id },
    include: { slots: { include: { player: true }, orderBy: { position: "asc" } } },
  });

  return (
    <LineupForm
      matchdayId={matchday.id}
      matchdayNumber={matchday.number}
      isLocked={matchday.isLocked}
      roster={roster.map((r) => ({
        id: r.player.id,
        name: r.player.name,
        realTeam: r.player.realTeam,
        mantraRole: r.player.mantraRole,
      }))}
      existingLineup={
        existingLineup
          ? {
              formation: existingLineup.formation,
              starters: existingLineup.slots
                .filter((s) => s.isStarter)
                .map((s) => s.player.id),
              reserves: existingLineup.slots
                .filter((s) => !s.isStarter)
                .map((s) => s.player.id),
            }
          : null
      }
    />
  );
}
