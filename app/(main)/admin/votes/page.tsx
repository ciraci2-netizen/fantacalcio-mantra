import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import VotesAdminClient from "./VotesAdminClient";

export default async function AdminVotesPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const season = await prisma.season.findFirst({
    where: { isActive: true },
    include: { matchdays: { orderBy: { number: "asc" } } },
  });

  if (!season) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nessuna stagione attiva. Crea prima una stagione.
      </div>
    );
  }

  return (
    <VotesAdminClient
      seasonName={season.name}
      currentMatchday={season.currentMatchday}
      matchdays={season.matchdays.map((m) => ({
        id: m.id,
        number: m.number,
        votesImported: m.votesImported,
        isLocked: m.isLocked,
      }))}
    />
  );
}
