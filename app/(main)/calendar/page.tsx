import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import CalendarClient from "./CalendarClient";

type MatchRow = {
  id: number;
  homeScore: number | null;
  awayScore: number | null;
  homePoints: number | null;
  homeUser: { id: number; teamName: string; logoUrl: string | null };
  awayUser: { id: number; teamName: string; logoUrl: string | null };
};

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return <div className="text-center py-12 text-gray-500">Nessuna stagione attiva.</div>;
  }

  const matchesRes = await db.execute({
    sql: `SELECT m.id, m.matchdayId, m.homeScore, m.awayScore, m.homePoints,
                 m.homeUserId, m.awayUserId,
                 hu.teamName as homeTeamName,
                 au.teamName as awayTeamName,
                 md.number as matchdayNumber
          FROM "Match" m
          JOIN "Matchday" md ON md.id = m.matchdayId
          JOIN "User" hu ON hu.id = m.homeUserId
          JOIN "User" au ON au.id = m.awayUserId
          WHERE md.seasonId = ?
          ORDER BY md.number ASC`,
    args: [season.id],
  });

  // Load logos separately (column may not exist yet)
  const logoMap: Record<number, string | null> = {};
  try {
    const logoRes = await db.execute(`SELECT id, logoUrl FROM "User" WHERE isAdmin = 0`);
    for (const row of logoRes.rows) {
      logoMap[row.id as number] = (row.logoUrl as string | null) ?? null;
    }
  } catch { /* not yet migrated */ }

  const matchdayMap = new Map<number, { id: number; number: number; matches: MatchRow[] }>();
  for (const row of matchesRes.rows) {
    const mdId = row.matchdayId as number;
    if (!matchdayMap.has(mdId)) {
      matchdayMap.set(mdId, { id: mdId, number: row.matchdayNumber as number, matches: [] });
    }
    const homeId = row.homeUserId as number;
    const awayId = row.awayUserId as number;
    matchdayMap.get(mdId)!.matches.push({
      id: row.id as number,
      homeScore: row.homeScore as number | null,
      awayScore: row.awayScore as number | null,
      homePoints: row.homePoints as number | null,
      homeUser: { id: homeId, teamName: row.homeTeamName as string, logoUrl: logoMap[homeId] ?? null },
      awayUser: { id: awayId, teamName: row.awayTeamName as string, logoUrl: logoMap[awayId] ?? null },
    });
  }

  const matchdays = [...matchdayMap.values()].sort((a, b) => a.number - b.number);

  // Default to most recent played matchday, or last if none played
  let initialIndex = Math.max(0, matchdays.length - 1);
  for (let i = matchdays.length - 1; i >= 0; i--) {
    if (matchdays[i].matches.some((m) => m.homeScore !== null)) {
      initialIndex = i;
      break;
    }
  }

  return (
    <CalendarClient
      matchdays={matchdays}
      currentUserId={session.userId}
      seasonName={season.name as string}
      initialIndex={initialIndex}
    />
  );
}
