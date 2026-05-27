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

  const currentMd = matchdaysRes.rows.find(
    (m) => m.number === season.currentMatchday
  ) ?? null;

  // Lineup submission status for the current matchday
  const usersRes = await db.execute(`SELECT id, teamName FROM "User" WHERE isAdmin = 0 ORDER BY teamName ASC`);
  let lineupSubmissions: { userId: number; teamName: string; submitted: boolean; score: number | null }[] = [];

  if (currentMd) {
    const lineupsRes = await db.execute({
      sql: `SELECT userId, totalScore FROM "Lineup" WHERE matchdayId = ? AND isSubmitted = 1`,
      args: [currentMd.id],
    });
    const lineupMap = new Map(
      lineupsRes.rows.map((l) => [l.userId as number, l.totalScore as number | null])
    );
    lineupSubmissions = usersRes.rows.map((u) => ({
      userId: u.id as number,
      teamName: u.teamName as string,
      submitted: lineupMap.has(u.id as number),
      score: lineupMap.get(u.id as number) ?? null,
    }));
  }

  return (
    <VotesAdminClient
      seasonId={season.id as number}
      seasonName={season.name as string}
      currentMatchday={season.currentMatchday as number}
      currentMatchdayId={currentMd ? (currentMd.id as number) : null}
      currentMatchdayTotal={matchdaysRes.rows.length}
      matchdays={matchdaysRes.rows.map((m) => ({
        id: m.id as number,
        number: m.number as number,
        votesImported: Boolean(m.votesImported),
        isLocked: Boolean(m.isLocked),
      }))}
      lineupSubmissions={lineupSubmissions}
    />
  );
}
