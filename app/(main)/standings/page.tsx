import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

export default async function StandingsPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nessuna stagione attiva.
      </div>
    );
  }

  const usersRes = await db.execute(
    `SELECT id, teamName, username FROM "User" WHERE isAdmin = 0`
  );

  const standings = await Promise.all(
    usersRes.rows.map(async (user) => {
      const matchesRes = await db.execute({
        sql: `SELECT m.homeUserId, m.awayUserId, m.homePoints, m.awayPoints, m.homeScore, m.awayScore
              FROM "Match" m
              JOIN "Matchday" md ON md.id = m.matchdayId
              WHERE md.seasonId = ? AND m.homePoints IS NOT NULL
              AND (m.homeUserId = ? OR m.awayUserId = ?)`,
        args: [season.id, user.id, user.id],
      });

      let points = 0, wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;

      for (const m of matchesRes.rows) {
        const isHome = m.homeUserId === user.id;
        const myPoints = isHome ? (m.homePoints as number) ?? 0 : (m.awayPoints as number) ?? 0;
        const myGf = isHome ? (m.homeScore as number) ?? 0 : (m.awayScore as number) ?? 0;
        const myGa = isHome ? (m.awayScore as number) ?? 0 : (m.homeScore as number) ?? 0;

        points += myPoints;
        gf += myGf;
        ga += myGa;
        if (myPoints === 3) wins++;
        else if (myPoints === 1) draws++;
        else if (myPoints === 0) losses++;
      }

      return {
        userId: user.id as number,
        teamName: user.teamName as string,
        username: user.username as string,
        played: wins + draws + losses,
        wins,
        draws,
        losses,
        points,
        gf: Math.round(gf * 10) / 10,
        ga: Math.round(ga * 10) / 10,
        gd: Math.round((gf - ga) * 10) / 10,
      };
    })
  );

  standings.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

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
                    <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold ${i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-300" : i === 2 ? "bg-amber-600 text-white" : "text-gray-500"}`}>
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
