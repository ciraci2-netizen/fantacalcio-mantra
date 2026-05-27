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
  const myPosition = standings.findIndex((s) => s.userId === session.userId) + 1;
  const myStanding = standings.find((s) => s.userId === session.userId);

  const nextMatch = currentMatchdayRow
    ? (
        await db.execute({
          sql: `SELECT m.id, m.homeUserId, m.awayUserId, m.homeScore, m.awayScore, m.homePoints,
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

  const lineupExistsRes = currentMatchdayRow
    ? await db.execute({
        sql: `SELECT COUNT(*) as c FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
        args: [session.userId, currentMatchdayRow.id],
      })
    : null;
  const lineupSubmitted = lineupExistsRes
    ? (lineupExistsRes.rows[0].c as number) > 0
    : false;

  const rosterCountRes = await db.execute({
    sql: `SELECT COUNT(*) as c FROM "Roster" WHERE userId = ?`,
    args: [session.userId],
  });
  const rosterCount = rosterCountRes.rows[0].c as number;

  const isLocked = Boolean(currentMatchdayRow?.isLocked);
  const lineupLabel = !currentMatchdayRow
    ? "—"
    : lineupSubmitted
    ? "Inviata ✓"
    : isLocked
    ? "Scaduta"
    : "Da inviare";
  const lineupColor: "green" | "blue" | "amber" | "purple" = lineupSubmitted
    ? "green"
    : currentMatchdayRow
    ? "amber"
    : "blue";
  const lineupSub = lineupSubmitted
    ? "Ben fatto!"
    : isLocked
    ? "Giornata bloccata"
    : currentMatchdayRow
    ? "Clicca per inviare"
    : "Nessuna giornata";

  const posColor: "green" | "blue" | "amber" | "purple" =
    myPosition === 0 ? "blue" : myPosition === 1 ? "green" : myPosition <= 4 ? "blue" : "amber";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Benvenuto, <span className="text-green-700">{session.teamName}</span>!
        </h1>
        {season ? (
          <p className="text-gray-500 mt-1">
            Stagione <strong>{season.name as string}</strong> — Giornata{" "}
            <strong>{season.currentMatchday as number}</strong>
          </p>
        ) : (
          <p className="text-amber-600 mt-1">
            Nessuna stagione attiva. Attendi che l&apos;admin configuri il campionato.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="👥"
          label="Rosa"
          value={`${rosterCount} / 26`}
          sub={rosterCount === 26 ? "Completa" : `${26 - rosterCount} mancanti`}
          color={rosterCount === 26 ? "green" : "amber"}
          href="/team"
        />
        <StatCard
          icon="📋"
          label={`Formazione G${season?.currentMatchday ?? "—"}`}
          value={lineupLabel}
          sub={lineupSub}
          color={lineupColor}
          href="/lineup"
        />
        <StatCard
          icon="⭐"
          label={
            lastLineup
              ? `Punteggio G${lastLineup.matchdayNumber as number}`
              : "Ultimo punteggio"
          }
          value={
            lastLineup ? ((lastLineup.totalScore as number)?.toFixed(1) ?? "—") : "—"
          }
          sub={lastLineup ? "Ultimo risultato" : "Nessun risultato"}
          color="purple"
          href="/calendar"
        />
        <StatCard
          icon="🏆"
          label="Classifica"
          value={myPosition > 0 ? `#${myPosition}` : "—"}
          sub={
            myStanding
              ? `${myStanding.points} pt · ${myStanding.wins}V ${myStanding.draws}P ${myStanding.losses}S`
              : "Nessuna partita"
          }
          color={posColor}
          href="/standings"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {nextMatch && (
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">
                Giornata {season?.currentMatchday as number}
              </h2>
              {nextMatch.homeScore !== null ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  Risultato finale
                </span>
              ) : (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  In programma
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-center flex-1 min-w-0">
                <p
                  className={`font-bold text-base truncate ${
                    (nextMatch.homeUserId as number) === session.userId
                      ? "text-green-700"
                      : "text-gray-800"
                  }`}
                >
                  {nextMatch.homeTeamName as string}
                </p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {nextMatch.homeUsername as string}
                </p>
              </div>
              <div className="text-center shrink-0 px-3">
                {nextMatch.homeScore !== null ? (
                  <div className="text-2xl font-bold text-gray-800">
                    <span>{(nextMatch.homeScore as number)?.toFixed(1)}</span>
                    <span className="text-gray-300 mx-1.5">—</span>
                    <span>{(nextMatch.awayScore as number)?.toFixed(1)}</span>
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-gray-200">VS</span>
                )}
              </div>
              <div className="text-center flex-1 min-w-0">
                <p
                  className={`font-bold text-base truncate ${
                    (nextMatch.awayUserId as number) === session.userId
                      ? "text-green-700"
                      : "text-gray-800"
                  }`}
                >
                  {nextMatch.awayTeamName as string}
                </p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {nextMatch.awayUsername as string}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700">Top 5</h2>
            <Link href="/standings" className="text-green-600 text-xs hover:underline">
              Classifica completa →
            </Link>
          </div>
          {standings.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">
              Nessuna partita giocata ancora.
            </p>
          ) : (
            <ol className="space-y-1">
              {standings.slice(0, 5).map((s, i) => (
                <li
                  key={s.userId}
                  className={`flex items-center gap-3 px-2 py-2 rounded-lg ${
                    s.userId === session.userId ? "bg-green-50" : ""
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
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
                  <span className="flex-1 font-medium text-sm truncate">{s.teamName}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {s.wins}V {s.draws}P
                  </span>
                  <span className="text-green-700 font-bold text-sm shrink-0">
                    {s.points} pt
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  href,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  color: "green" | "blue" | "amber" | "purple";
  href: string;
}) {
  const bg = {
    green: "bg-green-50 border-green-200 hover:bg-green-100",
    blue: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    amber: "bg-amber-50 border-amber-200 hover:bg-amber-100",
    purple: "bg-purple-50 border-purple-200 hover:bg-purple-100",
  }[color];
  const valueColor = {
    green: "text-green-700",
    blue: "text-blue-700",
    amber: "text-amber-700",
    purple: "text-purple-700",
  }[color];
  return (
    <Link href={href} className={`${bg} border rounded-xl p-4 hover:shadow-md transition-all block`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xs text-gray-500 truncate">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${valueColor}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5 truncate">{sub}</div>
    </Link>
  );
}

async function getStandings(seasonId?: number) {
  if (!seasonId) return [];
  const db = getDb();

  const usersRes = await db.execute(`SELECT id, teamName FROM "User" WHERE isAdmin = 0`);
  const results: {
    userId: number;
    teamName: string;
    points: number;
    wins: number;
    draws: number;
    losses: number;
    gf: number;
  }[] = [];

  for (const user of usersRes.rows) {
    const matchesRes = await db.execute({
      sql: `SELECT m.homeUserId, m.awayUserId, m.homePoints, m.awayPoints, m.homeScore, m.awayScore
            FROM "Match" m
            JOIN "Matchday" md ON md.id = m.matchdayId
            WHERE md.seasonId = ? AND m.homePoints IS NOT NULL
            AND (m.homeUserId = ? OR m.awayUserId = ?)`,
      args: [seasonId, user.id, user.id],
    });

    let points = 0, wins = 0, draws = 0, losses = 0, gf = 0;
    for (const m of matchesRes.rows) {
      const isHome = m.homeUserId === user.id;
      const myPts = ((isHome ? m.homePoints : m.awayPoints) as number) ?? 0;
      gf += ((isHome ? m.homeScore : m.awayScore) as number) ?? 0;
      points += myPts;
      if (myPts === 3) wins++;
      else if (myPts === 1) draws++;
      else losses++;
    }
    results.push({
      userId: user.id as number,
      teamName: user.teamName as string,
      points,
      wins,
      draws,
      losses,
      gf,
    });
  }
  return results.sort((a, b) => b.points - a.points || b.gf - a.gf);
}
