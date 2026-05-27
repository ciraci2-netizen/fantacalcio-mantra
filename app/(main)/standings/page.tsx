import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

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

  return res.rows.map((r) => ({
    userId: r.id as number,
    teamName: r.teamName as string,
    username: r.username as string,
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">
        Classifica — <span className="text-green-700">{season.name as string}</span>
      </h1>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-green-700 text-white">
              <tr>
                <th className="px-3 py-3 text-left w-8">#</th>
                <th className="px-3 py-3 text-left">Squadra</th>
                <th className="px-3 py-3 text-center">G</th>
                <th className="px-3 py-3 text-center">V</th>
                <th className="px-3 py-3 text-center">P</th>
                <th className="px-3 py-3 text-center">S</th>
                <th className="px-3 py-3 text-center">Pf</th>
                <th className="px-3 py-3 text-center">Ps</th>
                <th className="px-3 py-3 text-center">Diff</th>
                <th className="px-3 py-3 text-center font-bold">Pt</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {standings.map((s, i) => (
                <tr
                  key={s.userId}
                  className={`${s.userId === session.userId ? "bg-green-50" : "hover:bg-gray-50"} transition-colors`}
                >
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold ${
                      i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-300" : i === 2 ? "bg-amber-600 text-white" : "text-gray-500"
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-semibold">{s.teamName}</p>
                    <p className="text-gray-400 text-xs">{s.username}</p>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">{s.played}</td>
                  <td className="px-3 py-2 text-center text-green-600 font-medium">{s.wins}</td>
                  <td className="px-3 py-2 text-center text-gray-500">{s.draws}</td>
                  <td className="px-3 py-2 text-center text-red-500">{s.losses}</td>
                  <td className="px-3 py-2 text-center">{s.gf}</td>
                  <td className="px-3 py-2 text-center">{s.ga}</td>
                  <td className="px-3 py-2 text-center">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                  <td className="px-3 py-2 text-center font-bold text-green-700 text-base">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
