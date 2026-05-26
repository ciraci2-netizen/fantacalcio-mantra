import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export default async function StandingsPage() {
  const session = await getSession();
  if (!session) return null;

  const season = await prisma.season.findFirst({ where: { isActive: true } });

  if (!season) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nessuna stagione attiva.
      </div>
    );
  }

  const users = await prisma.user.findMany({ where: { isAdmin: false } });

  const standings = await Promise.all(
    users.map(async (user) => {
      const matches = await prisma.match.findMany({
        where: {
          matchday: { seasonId: season.id },
          homePoints: { not: null },
          OR: [{ homeUserId: user.id }, { awayUserId: user.id }],
        },
      });

      let points = 0, wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;

      for (const m of matches) {
        const isHome = m.homeUserId === user.id;
        const myPoints = isHome ? (m.homePoints ?? 0) : (m.awayPoints ?? 0);
        const myGf = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
        const myGa = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);

        points += myPoints;
        gf += myGf;
        ga += myGa;
        if (myPoints === 3) wins++;
        else if (myPoints === 1) draws++;
        else if (myPoints === 0 && m.homePoints !== null) losses++;
      }

      return {
        userId: user.id,
        teamName: user.teamName,
        username: user.username,
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
        Classifica — <span className="text-green-700">{season.name}</span>
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
