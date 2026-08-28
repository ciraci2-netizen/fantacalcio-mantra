import { getDb } from "@/app/lib/db";

export const dynamic = "force-dynamic";

async function getStandings() {
  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;
  if (!season) return { season: null, standings: [] };

  const res = await db.execute({
    sql: `SELECT
            u.id, u.teamName, u.username,
            COALESCE(SUM(CASE WHEN m.homeUserId = u.id THEN m.homePoints ELSE m.awayPoints END), 0) as points,
            COALESCE(SUM(CASE WHEN (m.homeUserId = u.id AND m.homePoints = 3) OR (m.awayUserId = u.id AND m.awayPoints = 3) THEN 1 ELSE 0 END), 0) as wins,
            COALESCE(SUM(CASE WHEN (m.homeUserId = u.id AND m.homePoints = 1) OR (m.awayUserId = u.id AND m.awayPoints = 1) THEN 1 ELSE 0 END), 0) as draws,
            COALESCE(SUM(CASE WHEN (m.homeUserId = u.id AND m.homePoints = 0) OR (m.awayUserId = u.id AND m.awayPoints = 0) THEN 1 ELSE 0 END), 0) as losses,
            COALESCE(SUM(CASE WHEN m.homeUserId = u.id OR m.awayUserId = u.id THEN 1 ELSE 0 END), 0) as played,
            COALESCE(ROUND(SUM(CASE WHEN m.homeUserId = u.id THEN m.homeScore ELSE m.awayScore END), 1), 0) as gf
          FROM "User" u
          LEFT JOIN (
            SELECT m2.* FROM "Match" m2
            JOIN "Matchday" md ON md.id = m2.matchdayId
            WHERE md.seasonId = ? AND m2.homePoints IS NOT NULL
          ) m ON m.homeUserId = u.id OR m.awayUserId = u.id
          WHERE u.isParticipant = 1
          GROUP BY u.id
          ORDER BY points DESC, gf DESC`,
    args: [season.id],
  });

  return {
    season,
    standings: res.rows.map((r, i) => ({
      rank: i + 1,
      teamName: r.teamName as string,
      username: r.username as string,
      points: r.points as number,
      wins: r.wins as number,
      draws: r.draws as number,
      losses: r.losses as number,
      played: r.played as number,
      gf: r.gf as number,
    })),
  };
}

export default async function PublicStandingsPage() {
  const { season, standings } = await getStandings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Classifica</h1>
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
      ) : standings.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
          Nessuna partita giocata ancora.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-8">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Squadra</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">G</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">V</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">P</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">S</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-500">Pf</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Pt</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {standings.map((s, i) => (
                  <tr key={s.teamName} className={i % 2 === 0 ? "" : "bg-gray-50/50"}>
                    <td className="px-4 py-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0
                            ? "bg-yellow-400 text-yellow-900"
                            : i === 1
                            ? "bg-gray-300 text-gray-700"
                            : i === 2
                            ? "bg-amber-600 text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">{s.teamName}</span>
                      <span className="text-gray-400 text-xs ml-1.5">{s.username}</span>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-500">{s.played}</td>
                    <td className="px-3 py-3 text-center text-gray-700">{s.wins}</td>
                    <td className="px-3 py-3 text-center text-gray-700">{s.draws}</td>
                    <td className="px-3 py-3 text-center text-gray-700">{s.losses}</td>
                    <td className="px-3 py-3 text-center text-gray-500">{s.gf}</td>
                    <td className="px-4 py-3 text-center font-bold text-green-700">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
