import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import Link from "next/link";
import TeamLogo from "@/app/components/TeamLogo";

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
  const playedMatchdays = matchdays.filter((md) => md.matches.some((m) => m.homeScore !== null));
  const upcomingMatchdays = matchdays.filter(
    (md) => md.matches.length > 0 && md.matches.every((m) => m.homeScore === null)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">
        Calendario — <span className="text-green-700">{season.name as string}</span>
      </h1>

      {playedMatchdays.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Risultati</h2>
          {[...playedMatchdays].reverse().slice(0, 5).map((md) => (
            <MatchdayCard key={md.id} md={md} currentUserId={session.userId} />
          ))}
        </section>
      )}

      {upcomingMatchdays.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Prossime giornate</h2>
          {upcomingMatchdays.slice(0, 3).map((md) => (
            <MatchdayCard key={md.id} md={md} currentUserId={session.userId} />
          ))}
        </section>
      )}
    </div>
  );
}

function MatchdayCard({
  md,
  currentUserId,
}: {
  md: { number: number; matches: MatchRow[] };
  currentUserId: number;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
        <span className="text-sm font-semibold text-gray-700">Giornata {md.number}</span>
      </div>

      <div className="divide-y">
        {md.matches.map((m) => {
          const isMyMatch = m.homeUser.id === currentUserId || m.awayUser.id === currentUserId;
          const played = m.homeScore !== null;
          const homeWon = (m.homePoints ?? -1) === 3;
          const awayWon = (m.homePoints ?? -1) === 0;
          const isDraw = (m.homePoints ?? -1) === 1;

          return (
            <Link
              key={m.id}
              href={`/calendar/${m.id}`}
              className={`flex items-center px-4 py-3 gap-3 hover:bg-gray-50/80 transition-colors ${
                isMyMatch ? "border-l-4 border-blue-500 bg-blue-50/30" : "border-l-4 border-transparent"
              }`}
            >
              {/* Home team */}
              <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                <span
                  className={`text-sm font-semibold truncate ${
                    isMyMatch && m.homeUser.id === currentUserId
                      ? "text-blue-700"
                      : played
                      ? homeWon
                        ? "text-gray-800"
                        : "text-gray-400"
                      : "text-gray-700"
                  }`}
                >
                  {m.homeUser.teamName}
                </span>
                <TeamLogo logoUrl={m.homeUser.logoUrl} teamName={m.homeUser.teamName} size="sm" />
              </div>

              {/* Score / VS */}
              <div className="flex items-center gap-1.5 shrink-0 min-w-[100px] justify-center">
                {played ? (
                  <>
                    <span
                      className={`text-base font-bold w-10 text-right ${
                        homeWon ? "text-green-600" : isDraw ? "text-gray-500" : "text-red-400"
                      }`}
                    >
                      {m.homeScore?.toFixed(1)}
                    </span>
                    <span className="text-gray-300 text-sm">—</span>
                    <span
                      className={`text-base font-bold w-10 text-left ${
                        awayWon ? "text-green-600" : isDraw ? "text-gray-500" : "text-red-400"
                      }`}
                    >
                      {m.awayScore?.toFixed(1)}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-300 font-semibold text-sm tracking-widest">VS</span>
                )}
              </div>

              {/* Away team */}
              <div className="flex items-center gap-2 flex-1 justify-start min-w-0">
                <TeamLogo logoUrl={m.awayUser.logoUrl} teamName={m.awayUser.teamName} size="sm" />
                <span
                  className={`text-sm font-semibold truncate ${
                    isMyMatch && m.awayUser.id === currentUserId
                      ? "text-blue-700"
                      : played
                      ? awayWon
                        ? "text-gray-800"
                        : "text-gray-400"
                      : "text-gray-700"
                  }`}
                >
                  {m.awayUser.teamName}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
