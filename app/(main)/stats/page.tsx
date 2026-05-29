import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { teamHex } from "@/app/lib/teamColor";

export const metadata: Metadata = { title: "Statistiche" };

/* ── Bar chart component ─────────────────────────────────────────────────── */
function TeamBarChart({ teams }: { teams: { teamName: string; avgScore: number; played: number }[] }) {
  const maxScore = Math.max(...teams.map(t => t.avgScore), 1);
  return (
    <div className="space-y-2.5">
      {teams.map((t) => {
        const pct = Math.round((t.avgScore / maxScore) * 100);
        const hex = teamHex(t.teamName);
        const initials = t.teamName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
        return (
          <div key={t.teamName} className="flex items-center gap-3">
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: hex }}
            >
              {initials}
            </div>
            {/* Name */}
            <span className="w-32 text-sm font-medium text-gray-700 truncate shrink-0">{t.teamName}</span>
            {/* Bar */}
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                style={{ width: `${Math.max(pct, 8)}%`, background: hex }}
              >
                <span className="text-white text-xs font-bold">{t.avgScore.toFixed(1)}</span>
              </div>
            </div>
            {/* Played */}
            <span className="text-xs text-gray-400 shrink-0 w-12 text-right">{t.played} part.</span>
          </div>
        );
      })}
    </div>
  );
}

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

  // Cache expensive stats queries for 5 minutes
  const getStatsData = unstable_cache(
    async (sid: number) => {
      const db2 = getDb();
      const [tp, tl, ts, ta] = await Promise.all([
        db2.execute({ sql: `SELECT p.id, p.name, p.mantraRole, p.realTeam,
                 COUNT(pv.id) as appearances,
                 ROUND(AVG(pv.fantavoto), 2) as avgScore,
                 MAX(pv.fantavoto) as maxScore,
                 SUM(CASE WHEN pv.gfGs > 0 THEN pv.gfGs ELSE 0 END) as goals,
                 SUM(pv.ass) as assists
          FROM "PlayerVote" pv
          JOIN "Player" p ON p.id = pv.playerId
          JOIN "Matchday" md ON md.id = pv.matchdayId
          WHERE md.seasonId = ? AND pv.fantavoto IS NOT NULL
          GROUP BY p.id HAVING appearances >= 3 ORDER BY avgScore DESC LIMIT 20`, args: [sid] }),
        db2.execute({ sql: `SELECT l.totalScore, l.userId, md.number as matchdayNumber, u.teamName
          FROM "Lineup" l JOIN "Matchday" md ON md.id = l.matchdayId JOIN "User" u ON u.id = l.userId
          WHERE md.seasonId = ? AND l.totalScore IS NOT NULL ORDER BY l.totalScore DESC LIMIT 10`, args: [sid] }),
        db2.execute({ sql: `SELECT p.id, p.name, p.mantraRole, p.realTeam,
                 SUM(CASE WHEN pv.gfGs > 0 THEN pv.gfGs ELSE 0 END) as goals, COUNT(pv.id) as appearances
          FROM "PlayerVote" pv JOIN "Player" p ON p.id = pv.playerId JOIN "Matchday" md ON md.id = pv.matchdayId
          WHERE md.seasonId = ? GROUP BY p.id HAVING goals > 0 ORDER BY goals DESC LIMIT 10`, args: [sid] }),
        db2.execute({ sql: `SELECT u.teamName, ROUND(AVG(l.totalScore), 1) as avgScore, COUNT(l.id) as played
          FROM "Lineup" l JOIN "User" u ON u.id = l.userId JOIN "Matchday" md ON md.id = l.matchdayId
          WHERE md.seasonId = ? AND l.totalScore IS NOT NULL GROUP BY u.id ORDER BY avgScore DESC`, args: [sid] }),
      ]);
      return { topPlayers: tp.rows, topLineups: tl.rows, topScorers: ts.rows, teamAvg: ta.rows };
    },
    [`stats-${season.id}`],
    { revalidate: 300, tags: [`stats-${season.id}`] }
  );

  const statsData = await getStatsData(season.id as number);

  const { topPlayers, topLineups, topScorers, teamAvg } = statsData;

  const noData = topPlayers.length === 0 && topLineups.length === 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">
        Statistiche — <span className="text-green-700">{season.name as string}</span>
      </h1>

      {/* ── Bar chart: media punteggi per squadra ── */}
      {teamAvg.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Stagione</p>
          <h2 className="font-semibold text-gray-800 mb-4">Media punteggi per squadra</h2>
          <TeamBarChart teams={teamAvg.map(r => ({
            teamName: r.teamName as string,
            avgScore: r.avgScore as number,
            played: r.played as number,
          }))} />
        </div>
      )}

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
