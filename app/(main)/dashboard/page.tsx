import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const season = await prisma.season.findFirst({
    where: { isActive: true },
    include: {
      matchdays: {
        where: { number: { gt: 0 } },
        orderBy: { number: "asc" },
      },
    },
  });

  const currentMatchday = season
    ? season.matchdays.find((m) => m.number === season.currentMatchday)
    : null;

  const standings = await getStandings(season?.id);

  const nextMatch = currentMatchday
    ? await prisma.match.findFirst({
        where: {
          matchdayId: currentMatchday.id,
          OR: [{ homeUserId: session.userId }, { awayUserId: session.userId }],
        },
        include: { homeUser: true, awayUser: true },
      })
    : null;

  const lastLineup = await prisma.lineup.findFirst({
    where: { userId: session.userId, totalScore: { not: null } },
    orderBy: { matchdayId: "desc" },
    include: { matchday: true },
  });

  const rosterCount = await prisma.roster.count({ where: { userId: session.userId } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Benvenuto, <span className="text-green-700">{session.teamName}</span>!
        </h1>
        {season ? (
          <p className="text-gray-500 mt-1">
            Stagione <strong>{season.name}</strong> — Giornata corrente:{" "}
            <strong>{season.currentMatchday}</strong>
          </p>
        ) : (
          <p className="text-amber-600 mt-1">
            Nessuna stagione attiva. Attendi che l&apos;admin configuri il campionato.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="👥"
          label="Giocatori in rosa"
          value={`${rosterCount} / 26`}
          color={rosterCount === 26 ? "green" : "amber"}
          href="/team"
        />
        <StatCard
          icon="📋"
          label="Formazione"
          value={currentMatchday?.isLocked ? "Bloccata" : "Invia entro la giornata"}
          color="blue"
          href="/lineup"
        />
        {lastLineup && (
          <StatCard
            icon="⭐"
            label={`Punteggio G${lastLineup.matchday.number}`}
            value={lastLineup.totalScore?.toFixed(1) ?? "-"}
            color="purple"
            href="/calendar"
          />
        )}
        <StatCard
          icon="🏆"
          label="Classifica"
          value="Vedi posizione"
          color="green"
          href="/standings"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {nextMatch && (
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="font-semibold text-gray-700 mb-3">
              Prossima partita — Giornata {season?.currentMatchday}
            </h2>
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="font-bold text-lg">{nextMatch.homeUser.teamName}</p>
                <p className="text-gray-400 text-sm">{nextMatch.homeUser.username}</p>
              </div>
              <div className="text-2xl font-bold text-gray-300 px-4">VS</div>
              <div className="text-center flex-1">
                <p className="font-bold text-lg">{nextMatch.awayUser.teamName}</p>
                <p className="text-gray-400 text-sm">{nextMatch.awayUser.username}</p>
              </div>
            </div>
            {nextMatch.homeScore !== null && (
              <div className="text-center mt-3 text-2xl font-bold text-green-700">
                {nextMatch.homeScore?.toFixed(1)} — {nextMatch.awayScore?.toFixed(1)}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-700 mb-3">Classifica (Top 5)</h2>
          {standings.length === 0 ? (
            <p className="text-gray-400 text-sm">Nessuna partita giocata ancora.</p>
          ) : (
            <ol className="space-y-2">
              {standings.slice(0, 5).map((s, i) => (
                <li key={s.userId} className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0
                        ? "bg-yellow-400"
                        : i === 1
                        ? "bg-gray-300"
                        : i === 2
                        ? "bg-amber-600 text-white"
                        : "bg-gray-100"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 font-medium">{s.teamName}</span>
                  <span className="text-green-700 font-bold">{s.points} pt</span>
                </li>
              ))}
            </ol>
          )}
          <Link href="/standings" className="text-green-600 text-sm hover:underline mt-3 block">
            Vedi classifica completa →
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  href,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  href: string;
}) {
  const colors: Record<string, string> = {
    green: "bg-green-50 border-green-200",
    blue: "bg-blue-50 border-blue-200",
    amber: "bg-amber-50 border-amber-200",
    purple: "bg-purple-50 border-purple-200",
  };
  return (
    <Link
      href={href}
      className={`${colors[color] ?? colors.green} border rounded-xl p-4 hover:shadow-md transition-shadow`}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </Link>
  );
}

async function getStandings(seasonId?: number) {
  if (!seasonId) return [];
  const users = await prisma.user.findMany({ where: { isAdmin: false } });
  const results: { userId: number; teamName: string; points: number; gf: number; ga: number }[] =
    [];

  for (const user of users) {
    const matches = await prisma.match.findMany({
      where: {
        matchday: { seasonId },
        homePoints: { not: null },
        OR: [{ homeUserId: user.id }, { awayUserId: user.id }],
      },
    });

    let points = 0, gf = 0, ga = 0;
    for (const m of matches) {
      if (m.homeUserId === user.id) {
        points += m.homePoints ?? 0;
        gf += m.homeScore ?? 0;
        ga += m.awayScore ?? 0;
      } else {
        points += m.awayPoints ?? 0;
        gf += m.awayScore ?? 0;
        ga += m.homeScore ?? 0;
      }
    }
    results.push({ userId: user.id, teamName: user.teamName, points, gf, ga });
  }
  return results.sort((a, b) => b.points - a.points || b.gf - a.gf);
}
