import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { getDb } from "@/app/lib/db";
import VotesAdminClient from "./VotesAdminClient";

export default async function AdminVotesPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id, name, currentMatchday FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nessuna stagione attiva. Crea prima una stagione.
      </div>
    );
  }

  const matchdaysRes = await db.execute({
    sql: `SELECT id, number, votesImported, isLocked FROM "Matchday" WHERE seasonId = ? ORDER BY number ASC`,
    args: [season.id],
  });

  return (
    <VotesAdminClient
      seasonName={season.name as string}
      currentMatchday={season.currentMatchday as number}
      matchdays={matchdaysRes.rows.map((m) => ({
        id: m.id as number,
        number: m.number as number,
        votesImported: Boolean(m.votesImported),
        isLocked: Boolean(m.isLocked),
      }))}
    />
  );
}
