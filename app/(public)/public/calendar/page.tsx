import { getDb } from "@/app/lib/db";

export const dynamic = "force-dynamic";

type MatchRow = {
  id: number;
  homeScore: number | null;
  awayScore: number | null;
  homePoints: number | null;
  homeTeamName: string;
  awayTeamName: string;
};

async function getCalendar() {
  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;
  if (!season) return { season: null, matchdays: [] };

  const matchesRes = await db.execute({
    sql: `SELECT m.id, m.matchdayId, m.homeScore, m.awayScore, m.homePoints,
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

  const matchdayMap = new Map<number, { id: number; number: number; matches: MatchRow[] }>();
  for (const row of matchesRes.rows) {
    const mdId = row.matchdayId as number;
    if (!matchdayMap.has(mdId)) {
      matchdayMap.set(mdId, { id: mdId, number: row.matchdayNumber as number, matches: [] });
    }
    matchdayMap.get(mdId)!.matches.push({
      id: row.id as number,
      homeScore: row.homeScore as number | null,
      awayScore: row.awayScore as number | null,
      homePoints: row.homePoints as number | null,
      homeTeamName: row.homeTeamName as string,
      awayTeamName: row.awayTeamName as string,
    });
  }

  return {
    season,
    matchdays: [...matchdayMap.values()].sort((a, b) => a.number - b.number),
  };
}

export default async function PublicCalendarPage() {
  const { season, matchdays } = await getCalendar();

  const playedMatchdays = matchdays.filter((md) =>
    md.matches.some((m) => m.homeScore !== null)
  );
  const upcomingMatchdays = matchdays.filter(
    (md) => md.matches.length > 0 && md.matches.every((m) => m.homeScore === null)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Calendario</h1>
        {season && (
          <p className="text-gray-500 text-sm mt-1">
            Stagione <strong>{season.name as string}</strong>
          </p>
        )}
      </div>

      {!season ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
          Nessuna stagione attiva.
        </div>
      ) : (
        <>
          {playedMatchdays.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Risultati</h2>
              <div className="space-y-4">
                {[...playedMatchdays].reverse().map((md) => (
                  <MatchdayCard key={md.id} md={md} />
                ))}
              </div>
            </section>
          )}

          {upcomingMatchdays.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Prossime giornate</h2>
              <div className="space-y-4">
                {upcomingMatchdays.slice(0, 5).map((md) => (
                  <MatchdayCard key={md.id} md={md} />
                ))}
              </div>
            </section>
          )}

          {matchdays.length === 0 && (
            <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
              Nessuna partita programmata.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MatchdayCard({ md }: { md: { number: number; matches: MatchRow[] } }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="bg-green-700 text-white px-4 py-2 font-semibold text-sm">
        Giornata {md.number}
      </div>
      <div className="divide-y">
        {md.matches.map((m) => {
          const played = m.homeScore !== null;
          return (
            <div key={m.id} className="px-4 py-3 flex items-center gap-2">
              <span className="flex-1 text-right font-medium text-sm text-gray-700">
                {m.homeTeamName}
              </span>

              {played ? (
                <div className="flex items-center gap-1 min-w-[90px] justify-center">
                  <span
                    className={`font-bold text-sm ${
                      (m.homePoints ?? 0) === 3
                        ? "text-green-600"
                        : (m.homePoints ?? 0) === 0
                        ? "text-red-500"
                        : "text-gray-500"
                    }`}
                  >
                    {m.homeScore?.toFixed(1)}
                  </span>
                  <span className="text-gray-300">—</span>
                  <span
                    className={`font-bold text-sm ${
                      (m.homePoints ?? 0) === 0
                        ? "text-green-600"
                        : (m.homePoints ?? 0) === 3
                        ? "text-red-500"
                        : "text-gray-500"
                    }`}
                  >
                    {m.awayScore?.toFixed(1)}
                  </span>
                </div>
              ) : (
                <span className="text-gray-200 min-w-[90px] text-center font-bold text-sm">VS</span>
              )}

              <span className="flex-1 font-medium text-sm text-gray-700">
                {m.awayTeamName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
