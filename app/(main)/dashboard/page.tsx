import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id, name, currentMatchday FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;

  const currentMatchdayRow = season
    ? (
        await db.execute({
          sql: `SELECT id, number, isLocked FROM "Matchday" WHERE seasonId = ? AND number = ? LIMIT 1`,
          args: [season.id, season.currentMatchday],
        })
      ).rows[0] ?? null
    : null;

  const standings = await getStandings(season?.id as number | undefined);

  const nextMatch = currentMatchdayRow
    ? (
        await db.execute({
          sql: `SELECT m.id, m.homeScore, m.awayScore, m.homePoints,
                       hu.teamName as homeTeamName, hu.username as homeUsername,
                       au.teamName as awayTeamName, au.username as awayUsername
                FROM "Match" m
                JOIN "User" hu ON hu.id = m.homeUserId
                JOIN "User" au ON au.id = m.awayUserId
                WHERE m.matchdayId = ? AND (m.homeUserId = ? OR m.awayUserId = ?)
                LIMIT 1`,
          args: [currentMatchdayRow.id, session.userId, session.userId],
        })
      ).rows[0] ?? null
    : null;

  const lastLineupRes = await db.execute({
    sql: `SELECT l.totalScore, md.number as matchdayNumber
          FROM "Lineup" l
          JOIN "Matchday" md ON md.id = l.matchdayId
          WHERE l.userId = ? AND l.totalScore IS NOT NULL
          ORDER BY l.matchdayId DESC
          LIMIT 1`,
    args: [session.userId],
  });
  const lastLineup = lastLineupRes.rows[0] ?? null;

  const rosterCountRes = await db.execute({
    sql: `SELECT COUNT(*) as c FROM "Roster" WHERE userId = ?`,
    args: [session.userId],
  });
  const rosterCount = rosterCountRes.rows[0].c as number;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Benvenuto, <span className="text-green-700">{session.teamName}</span>!
        </h1>
        {season ? (
          <p className="text-gray-500 mt-1">
            Stagione <strong>{season.name as string}</strong> — Giornata corrente:{" "}
            <strong>{season.currentMatchday as number}</strong>
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
          value={currentMatchdayRow?.isLocked ? "Bloccata" : "Invia entro la giornata"}
          color="blue"
          href="/lineup"
        />
        {lastLineup && (
          <StatCard
            icon="⭐"
            label={`Punteggio G${lastLineup.matchdayNumber as number}`}
            value={(lastLineup.totalScore as number)?.toFixed(1) ?? "-"}
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
              Prossima partita — Giornata {season?.currentMatchday as number}
            </h2>
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="font-bold text-lg">{nextMatch.homeTeamName as string}</p>
                <p className="text-gray-400 text-sm">{nextMatch.homeUsername as string}</p>
              </div>
              <div className="text-2xl font-bold text-gray-300 px-4">VS</div>
              <div className="text-center flex-1">
                <p className="font-bold text-lg">{nextMatch.awayTeamName as string}</p>
                <p className="text-gray-400 text-sm">{nextMatch.awayUsername as string}</p>
              </div>
            </div>
            {nextMatch.homeScore !== null && (
              <div className="text-center mt-3 text-2xl font-bold text-green-700">
                {(nextMatch.homeScore as number)?.toFixed(1)} — {(nextMatch.awayScore as number)?.toFixed(1)}
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
  const db = getDb();

  const usersRes = await db.execute(`SELECT id, teamName FROM "User" WHERE isAdmin = 0`);
  const results: { userId: number; teamName: string; points: number; gf: number; ga: number }[] = [];

  for (const user of usersRes.rows) {
    const matchesRes = await db.execute({
      sql: `SELECT m.homeUserId, m.awayUserId, m.homePoints, m.awayPoints, m.homeScore, m.awayScore
            FROM "Match" m
            JOIN "Matchday" md ON md.id = m.matchdayId
            WHERE md.seasonId = ? AND m.homePoints IS NOT NULL
            AND (m.homeUserId = ? OR m.awayUserId = ?)`,
      args: [seasonId, user.id, user.id],
    });

    let points = 0, gf = 0, ga = 0;
    for (const m of matchesRes.rows) {
      if (m.homeUserId === user.id) {
        points += (m.homePoints as number) ?? 0;
        gf += (m.homeScore as number) ?? 0;
        ga += (m.awayScore as number) ?? 0;
      } else {
        points += (m.awayPoints as number) ?? 0;
        gf += (m.awayScore as number) ?? 0;
        ga += (m.homeScore as number) ?? 0;
      }
    }
    results.push({ userId: user.id as number, teamName: user.teamName as string, points, gf, ga });
  }
  return results.sort((a, b) => b.points - a.points || b.gf - a.gf);
}
