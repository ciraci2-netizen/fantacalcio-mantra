import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import TeamLogo from "@/app/components/TeamLogo";

async function getStandings(seasonId: number) {
  const db = getDb();

  const res = await db.execute({
    sql: `SELECT
            u.id, u.teamName, u.username,
            COALESCE(SUM(CASE WHEN m.homeUserId = u.id THEN m.homePoints ELSE m.awayPoints END), 0) as points,
            COALESCE(SUM(CASE WHEN (m.homeUserId = u.id AND m.homePoints = 3) OR (m.awayUserId = u.id AND m.awayPoints = 3) THEN 1 ELSE 0 END), 0) as wins,
            COALESCE(SUM(CASE WHEN (m.homeUserId = u.id AND m.homePoints = 1) OR (m.awayUserId = u.id AND m.awayPoints = 1) THEN 1 ELSE 0 END), 0) as draws,
            COALESCE(SUM(CASE WHEN (m.homeUserId = u.id AND m.homePoints = 0) OR (m.awayUserId = u.id AND m.awayPoints = 0) THEN 1 ELSE 0 END), 0) as losses,
            COALESCE(COUNT(m.id), 0) as played,
            COALESCE(ROUND(SUM(CASE WHEN m.homeUserId = u.id THEN m.homeScore ELSE m.awayScore END), 1), 0) as gf,
            COALESCE(ROUND(SUM(CASE WHEN m.homeUserId = u.id THEN m.awayScore ELSE m.homeScore END), 1), 0) as ga
          FROM "User" u
          LEFT JOIN (
            SELECT m2.* FROM "Match" m2
            JOIN "Matchday" md ON md.id = m2.matchdayId
            WHERE md.seasonId = ? AND m2.homePoints IS NOT NULL
          ) m ON m.homeUserId = u.id OR m.awayUserId = u.id
          WHERE u.isAdmin = 0
          GROUP BY u.id
          ORDER BY points DESC, gf DESC`,
    args: [seasonId],
  });

  const logoMap: Record<number, string | null> = {};
  try {
    const logoRes = await db.execute(`SELECT id, logoUrl FROM "User" WHERE isAdmin = 0`);
    for (const row of logoRes.rows) {
      logoMap[row.id as number] = (row.logoUrl as string | null) ?? null;
    }
  } catch { /* column not yet migrated */ }

  return res.rows.map((r) => ({
    userId: r.id as number,
    teamName: r.teamName as string,
    username: r.username as string,
    logoUrl: logoMap[r.id as number] ?? null,
    points: r.points as number,
    wins: r.wins as number,
    draws: r.draws as number,
    losses: r.losses as number,
    played: r.played as number,
    gf: r.gf as number,
    ga: r.ga as number,
    gd: Math.round(((r.gf as number) - (r.ga as number)) * 10) / 10,
  }));
}

const POSITION_COLORS = [
  "text-yellow-500",   // 1°
  "text-slate-400",    // 2°
  "text-amber-600",    // 3°
];

export default async function StandingsPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();
  const seasonRes = await db.execute(`SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return <div className="text-center py-12 text-gray-500">Nessuna stagione attiva.</div>;
  }

  const standings = await getStandings(season.id as number);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">
        Classifica —{" "}
        <span className="text-green-700">{season.name as string}</span>
      </h1>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* Column headers */}
        <div className="hidden sm:grid grid-cols-[3rem_1fr_repeat(9,3.5rem)] px-4 py-2 border-b bg-gray-50 text-xs font-medium text-gray-400 uppercase tracking-wide">
          <div />
          <div />
          <div className="text-center">g</div>
          <div className="text-center">v</div>
          <div className="text-center">n</div>
          <div className="text-center">p</div>
          <div className="text-center">g+</div>
          <div className="text-center">g-</div>
          <div className="text-center">dr</div>
          <div className="text-center font-semibold text-gray-600">pt</div>
          <div className="text-center">pt tot</div>
        </div>

        <div className="divide-y">
          {standings.map((s, i) => {
            const isMe = s.userId === session.userId;
            return (
              <div
                key={s.userId}
                className={`flex sm:grid sm:grid-cols-[3rem_1fr_repeat(9,3.5rem)] items-center gap-2 sm:gap-0 px-4 py-3 transition-colors ${
                  isMe
                    ? "border-l-4 border-blue-500 bg-blue-50/40"
                    : "border-l-4 border-transparent hover:bg-gray-50"
                }`}
              >
                {/* Position */}
                <div className="flex items-center justify-center w-8 sm:w-auto">
                  <span
                    className={`text-lg font-bold leading-none ${
                      POSITION_COLORS[i] ?? "text-gray-400"
                    }`}
                  >
                    {i + 1}
                  </span>
                </div>

                {/* Team */}
                <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none">
                  <TeamLogo logoUrl={s.logoUrl} teamName={s.teamName} size="sm" />
                  <div className="min-w-0">
                    <p
                      className={`font-semibold text-sm leading-tight truncate ${
                        isMe ? "text-blue-700" : "text-blue-600"
                      }`}
                    >
                      {s.teamName}
                    </p>
                    <p className="text-gray-400 text-xs leading-tight truncate hidden sm:block">
                      {s.username}
                    </p>
                  </div>
                </div>

                {/* Stats — hidden on mobile, shown as grid on sm+ */}
                <div className="hidden sm:contents text-sm text-gray-600 text-center">
                  <div className="flex items-center justify-center">{s.played}</div>
                  <div className="flex items-center justify-center text-green-600 font-medium">{s.wins}</div>
                  <div className="flex items-center justify-center">{s.draws}</div>
                  <div className="flex items-center justify-center text-red-500">{s.losses}</div>
                  <div className="flex items-center justify-center">{s.gf}</div>
                  <div className="flex items-center justify-center">{s.ga}</div>
                  <div className="flex items-center justify-center">
                    {s.gd > 0 ? `+${s.gd}` : s.gd}
                  </div>
                  <div className="flex items-center justify-center font-bold text-blue-600 text-base">
                    {s.points}
                  </div>
                  <div className="flex items-center justify-center text-gray-500 text-xs font-medium">
                    {s.gf}
                  </div>
                </div>

                {/* Mobile: show only pt */}
                <div className="sm:hidden ml-auto font-bold text-blue-600 text-lg">
                  {s.points}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
          <span>g = giocate</span>
          <span>v = vinte</span>
          <span>n = nulle</span>
          <span>p = perse</span>
          <span>g+ = gol fatti</span>
          <span>g- = gol subiti</span>
          <span>dr = diff. reti</span>
          <span className="font-semibold text-gray-500">pt = punti lega</span>
          <span>pt tot = punti fantacalcio totali</span>
        </div>
      </div>
    </div>
  );
}
