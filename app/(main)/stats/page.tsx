import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

const ROLE_BG: Record<string, string> = {
  Por: "bg-yellow-100 text-yellow-800",
  Dc: "bg-blue-100 text-blue-800", Dd: "bg-blue-100 text-blue-800", Ds: "bg-blue-100 text-blue-800",
  M: "bg-green-100 text-green-800", C: "bg-green-100 text-green-800",
  T: "bg-green-100 text-green-800", W: "bg-green-100 text-green-800",
  A: "bg-red-100 text-red-800", Pc: "bg-red-100 text-red-800",
};

export default async function StatsPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const seasonRes = await db.execute(`SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nessuna stagione attiva.
      </div>
    );
  }

  // Top players by average fantavoto (min 3 appearances)
  const topPlayersRes = await db.execute({
    sql: `SELECT p.id, p.name, p.mantraRole, p.realTeam,
                 COUNT(pv.id) as appearances,
                 ROUND(AVG(pv.fantavoto), 2) as avgScore,
                 MAX(pv.fantavoto) as maxScore,
                 SUM(CASE WHEN pv.gfGs > 0 THEN pv.gfGs ELSE 0 END) as goals,
                 SUM(pv.ass) as assists
          FROM "PlayerVote" pv
          JOIN "Player" p ON p.id = pv.playerId
          JOIN "Matchday" md ON md.id = pv.matchdayId
          WHERE md.seasonId = ? AND pv.fantavoto IS NOT NULL
          GROUP BY p.id
          HAVING appearances >= 3
          ORDER BY avgScore DESC
          LIMIT 20`,
    args: [season.id],
  });

  // Top scoring matchday lineups
  const topLineupsRes = await db.execute({
    sql: `SELECT l.totalScore, l.userId, md.number as matchdayNumber,
                 u.teamName
          FROM "Lineup" l
          JOIN "Matchday" md ON md.id = l.matchdayId
          JOIN "User" u ON u.id = l.userId
          WHERE md.seasonId = ? AND l.totalScore IS NOT NULL
          ORDER BY l.totalScore DESC
          LIMIT 10`,
    args: [season.id],
  });

  // Top scorers (goals only)
  const topScorersRes = await db.execute({
    sql: `SELECT p.id, p.name, p.mantraRole, p.realTeam,
                 SUM(CASE WHEN pv.gfGs > 0 THEN pv.gfGs ELSE 0 END) as goals,
                 COUNT(pv.id) as appearances
          FROM "PlayerVote" pv
          JOIN "Player" p ON p.id = pv.playerId
          JOIN "Matchday" md ON md.id = pv.matchdayId
          WHERE md.seasonId = ?
          GROUP BY p.id
          HAVING goals > 0
          ORDER BY goals DESC
          LIMIT 10`,
    args: [season.id],
  });

  const topPlayers = topPlayersRes.rows;
  const topLineups = topLineupsRes.rows;
  const topScorers = topScorersRes.rows;

  const noData = topPlayers.length === 0 && topLineups.length === 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">
        Statistiche — <span className="text-green-700">{season.name as string}</span>
      </h1>

      {noData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-700">
          <p className="font-medium">Nessuna statistica disponibile.</p>
          <p className="text-sm mt-1">Le statistiche saranno visibili dopo l&apos;import dei voti.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top players by avg score */}
        {topPlayers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="bg-green-700 text-white px-4 py-3 font-semibold">
              ⭐ Top 20 Media Fantavoto <span className="text-green-200 text-xs font-normal">(min. 3 presenze)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left w-6">#</th>
                    <th className="px-3 py-2 text-left">Giocatore</th>
                    <th className="px-3 py-2 text-center">Pres</th>
                    <th className="px-3 py-2 text-center font-bold">Media</th>
                    <th className="px-3 py-2 text-center">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topPlayers.map((p, i) => (
                    <tr key={p.id as number} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_BG[p.mantraRole as string] ?? "bg-gray-100"}`}>
                            {p.mantraRole as string}
                          </span>
                          <div>
                            <p className="font-medium text-gray-800">{p.name as string}</p>
                            <p className="text-xs text-gray-400">{p.realTeam as string}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-gray-500">{p.appearances as number}</td>
                      <td className="px-3 py-2 text-center font-bold text-green-700">{(p.avgScore as number)?.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{(p.maxScore as number)?.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Top scorers (goals) */}
          {topScorers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="bg-green-700 text-white px-4 py-3 font-semibold">
                ⚽ Classifica Marcatori
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left w-6">#</th>
                    <th className="px-3 py-2 text-left">Giocatore</th>
                    <th className="px-3 py-2 text-center font-bold">Gol</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topScorers.map((p, i) => (
                    <tr key={p.id as number} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_BG[p.mantraRole as string] ?? "bg-gray-100"}`}>
                            {p.mantraRole as string}
                          </span>
                          <div>
                            <p className="font-medium text-gray-800">{p.name as string}</p>
                            <p className="text-xs text-gray-400">{p.realTeam as string}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-green-700">{p.goals as number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top matchday lineups */}
          {topLineups.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="bg-green-700 text-white px-4 py-3 font-semibold">
                🏅 Migliori formazioni della stagione
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left w-6">#</th>
                    <th className="px-3 py-2 text-left">Squadra</th>
                    <th className="px-3 py-2 text-center">G</th>
                    <th className="px-3 py-2 text-center font-bold">Punti</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topLineups.map((l, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-gray-50 ${(l.userId as number) === session.userId ? "bg-green-50" : ""}`}
                    >
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{l.teamName as string}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{l.matchdayNumber as number}</td>
                      <td className="px-3 py-2 text-center font-bold text-green-700">
                        {(l.totalScore as number)?.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
