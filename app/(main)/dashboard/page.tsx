import type { Metadata } from "next";
import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import Link from "next/link";
import PushSubscribeButton from "@/app/components/PushSubscribeButton";
import DeadlineChip from "@/app/components/DeadlineChip";

export const metadata: Metadata = { title: "Dashboard" };

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
          sql: `SELECT id, number, isLocked, deadline FROM "Matchday" WHERE seasonId = ? AND number = ? LIMIT 1`,
          args: [season.id, season.currentMatchday],
        })
      ).rows[0] ?? null
    : null;

  let deadline: string | null = null;
  try { deadline = (currentMatchdayRow?.deadline as string | null) ?? null; } catch { /* col not yet migrated */ }

  const standings = await getStandings(season?.id as number | undefined);
  const myPosition = standings.findIndex((s) => s.userId === session.userId) + 1;
  const myStanding = standings.find((s) => s.userId === session.userId);

  const nextMatch = currentMatchdayRow
    ? (
        await db.execute({
          sql: `SELECT m.id, m.homeUserId, m.awayUserId, m.homeScore, m.awayScore, m.homePoints,
                       m.homeGoals, m.awayGoals,
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
          ORDER BY l.matchdayId DESC LIMIT 1`,
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

  // Logo
  let logoUrl: string | null = null;
  try {
    const lr = await db.execute({
      sql: `SELECT logoUrl FROM "User" WHERE id = ?`,
      args: [session.userId],
    });
    logoUrl = (lr.rows[0]?.logoUrl as string | null) ?? null;
  } catch { /* not migrated */ }

  // ── NEW: Score trend (last 8 matchdays) ────────────────────────────────
  const scoreTrendRes = await db.execute({
    sql: `SELECT l.totalScore, md.number as matchdayNumber
          FROM "Lineup" l
          JOIN "Matchday" md ON md.id = l.matchdayId
          WHERE l.userId = ? AND l.totalScore IS NOT NULL
          ORDER BY l.matchdayId DESC LIMIT 8`,
    args: [session.userId],
  });
  const scoreTrend = scoreTrendRes.rows
    .reverse()
    .map((r) => ({
      matchday: r.matchdayNumber as number,
      score: r.totalScore as number,
    }));

  // ── NEW: Top 3 players from my roster (last played matchday) ──────────
  let topPlayers: { name: string; mantraRole: string; fantavoto: number }[] = [];
  let topPlayersMatchday = 0;
  try {
    const lastPlayedRes = await db.execute({
      sql: `SELECT md.id, md.number FROM "Matchday" md
            WHERE md.seasonId = ? AND md.votesImported = 1
            ORDER BY md.number DESC LIMIT 1`,
      args: [season?.id ?? 0],
    });
    if (lastPlayedRes.rows[0]) {
      const lpMd = lastPlayedRes.rows[0];
      topPlayersMatchday = lpMd.number as number;
      const topRes = await db.execute({
        sql: `SELECT p.name, p.mantraRole, pv.fantavoto
              FROM "Roster" r
              JOIN "Player" p ON p.id = r.playerId
              JOIN "PlayerVote" pv ON pv.playerId = p.id AND pv.matchdayId = ?
              WHERE r.userId = ? AND pv.fantavoto IS NOT NULL
              ORDER BY pv.fantavoto DESC LIMIT 3`,
        args: [lpMd.id, session.userId],
      });
      topPlayers = topRes.rows.map((r) => ({
        name: r.name as string,
        mantraRole: r.mantraRole as string,
        fantavoto: r.fantavoto as number,
      }));
    }
  } catch { /* ignore */ }

  // ── NEW: Bacheca preview (last 3 messages) ─────────────────────────────
  let bachecaMessages: { teamName: string; content: string; createdAt: string }[] = [];
  try {
    if (season) {
      const bachecaRes = await db.execute({
        sql: `SELECT u.teamName, lm.content, lm.createdAt
              FROM "LeagueMessage" lm
              JOIN "User" u ON u.id = lm.userId
              WHERE lm.seasonId = ?
              ORDER BY lm.createdAt DESC LIMIT 3`,
        args: [season.id],
      });
      bachecaMessages = bachecaRes.rows.map((r) => ({
        teamName: r.teamName as string,
        content: r.content as string,
        createdAt: r.createdAt as string,
      }));
    }
  } catch { /* table might not exist yet */ }

  // Recent results (last 2 matchdays)
  const recentMatchesRes = season
    ? await db.execute({
        sql: `SELECT m.id, m.homeScore, m.awayScore, m.homePoints, m.awayPoints,
                     m.homeGoals, m.awayGoals,
                     hu.teamName as homeTeam, au.teamName as awayTeam,
                     hu.id as homeUserId, au.id as awayUserId,
                     md.number as matchdayNumber
              FROM "Match" m
              JOIN "Matchday" md ON md.id = m.matchdayId
              JOIN "User" hu ON hu.id = m.homeUserId
              JOIN "User" au ON au.id = m.awayUserId
              WHERE md.seasonId = ? AND m.homeScore IS NOT NULL
              ORDER BY md.number DESC, m.id DESC LIMIT 20`,
        args: [season.id],
      })
    : null;

  const recentByMatchday = new Map<number, Record<string, unknown>[]>();
  if (recentMatchesRes) {
    for (const row of recentMatchesRes.rows) {
      const n = row.matchdayNumber as number;
      if (!recentByMatchday.has(n)) recentByMatchday.set(n, []);
      recentByMatchday.get(n)!.push(row);
    }
  }
  const recentMatchdays = [...recentByMatchday.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, 2);

  const isLocked = Boolean(currentMatchdayRow?.isLocked);
  const initials = session.teamName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-5">
      {/* ── HERO BANNER ─────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-slate-900/90 via-blue-900/90 to-blue-800/90 rounded-2xl overflow-hidden shadow-xl">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative px-5 sm:px-8 py-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Identity */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white/20 overflow-hidden bg-blue-700 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-2xl shrink-0">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={session.teamName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div>
                <p className="text-blue-300 text-xs font-medium uppercase tracking-widest mb-0.5">
                  Fantasy Football PL
                </p>
                <h1 className="text-white text-xl sm:text-2xl font-bold leading-tight">
                  {session.teamName}
                </h1>
                <p className="text-blue-300 text-sm mt-0.5">@{session.username}</p>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-3 sm:ml-auto flex-wrap">
              <QuickAction
                href="/lineup"
                emoji="📋"
                label="Formazione"
                alert={!lineupSubmitted && !isLocked && !!currentMatchdayRow}
              />
              <QuickAction href="/calendar" emoji="📅" label="Risultati" />
              <QuickAction href="/mercato" emoji="🔄" label="Mercato" />
              <QuickAction href="/svincolati" emoji="🆓" label="Svincolati" />
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-4 gap-2">
            <HeroStat
              value={season ? `#${myPosition > 0 ? myPosition : "—"}` : "—"}
              label="Posizione"
              highlight
            />
            <HeroStat
              value={myStanding ? `${myStanding.points}` : "0"}
              label="Punti lega"
            />
            <HeroStat
              value={
                myStanding
                  ? `${myStanding.wins}V ${myStanding.draws}P ${myStanding.losses}S`
                  : "—"
              }
              label="Record"
            />
            <HeroStat
              value={
                lastLineup
                  ? `${(lastLineup.totalScore as number).toFixed(1)}`
                  : "—"
              }
              label={
                lastLineup
                  ? `Punteggio G${lastLineup.matchdayNumber as number}`
                  : "Ultimo pt"
              }
            />
          </div>
        </div>

        {season && (
          <div className="absolute top-4 right-4 bg-white/10 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/10">
            {season.name as string} · G{season.currentMatchday as number}
          </div>
        )}
      </div>

      {/* ── DEADLINE CHIP ───────────────────────────────────── */}
      {currentMatchdayRow && (
        <DeadlineChip
          deadline={deadline}
          isLocked={isLocked}
          lineupSubmitted={lineupSubmitted}
        />
      )}

      {/* ── GRID: partita + classifica ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Prossima/ultima partita */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {nextMatch?.homeScore !== null ? "Risultato" : "Prossima partita"}
              </p>
              <h2 className="font-semibold text-gray-800 mt-0.5">
                Giornata {season ? (season.currentMatchday as number) : "—"}
              </h2>
            </div>
            {nextMatch?.homeScore !== null ? (
              <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                Risultato finale
              </span>
            ) : currentMatchdayRow ? (
              <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                In programma
              </span>
            ) : null}
          </div>

          {nextMatch ? (
            <Link
              href={`/calendar/${nextMatch.id as number}`}
              className="block px-5 py-5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 text-right min-w-0">
                  <p
                    className={`font-bold text-base truncate ${
                      (nextMatch.homeUserId as number) === session.userId
                        ? "text-blue-700"
                        : "text-gray-800"
                    }`}
                  >
                    {nextMatch.homeTeamName as string}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {nextMatch.homeUsername as string}
                  </p>
                </div>
                <div className="shrink-0 text-center w-28">
                  {nextMatch.homeScore !== null ? (
                    <div className="bg-slate-800 rounded-xl px-4 py-2 inline-flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xl font-bold tabular-nums ${
                            (nextMatch.homePoints as number) === 3
                              ? "text-green-400"
                              : (nextMatch.homePoints as number) === 0
                              ? "text-red-400"
                              : "text-gray-300"
                          }`}
                        >
                          {nextMatch.homeGoals !== null
                            ? (nextMatch.homeGoals as number)
                            : (nextMatch.homeScore as number).toFixed(1)}
                        </span>
                        <span className="text-gray-500 text-sm">–</span>
                        <span
                          className={`text-xl font-bold tabular-nums ${
                            (nextMatch.homePoints as number) === 0
                              ? "text-green-400"
                              : (nextMatch.homePoints as number) === 3
                              ? "text-red-400"
                              : "text-gray-300"
                          }`}
                        >
                          {nextMatch.awayGoals !== null
                            ? (nextMatch.awayGoals as number)
                            : (nextMatch.awayScore as number).toFixed(1)}
                        </span>
                      </div>
                      {nextMatch.homeGoals !== null && (
                        <span className="text-[10px] text-gray-500 tabular-nums">
                          {(nextMatch.homeScore as number).toFixed(1)}–{(nextMatch.awayScore as number).toFixed(1)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-100 rounded-xl px-4 py-2 inline-block">
                      <span className="text-lg font-bold text-gray-300">VS</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p
                    className={`font-bold text-base truncate ${
                      (nextMatch.awayUserId as number) === session.userId
                        ? "text-blue-700"
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
            </Link>
          ) : (
            <div className="px-5 py-10 text-center text-gray-400">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-sm">
                {season ? "Nessuna partita assegnata" : "Nessuna stagione attiva"}
              </p>
            </div>
          )}

          {currentMatchdayRow && (
            <div
              className={`px-5 py-3 border-t flex items-center justify-between text-sm ${
                lineupSubmitted
                  ? "bg-green-50"
                  : isLocked
                  ? "bg-red-50"
                  : "bg-amber-50"
              }`}
            >
              <span
                className={`font-medium ${
                  lineupSubmitted
                    ? "text-green-700"
                    : isLocked
                    ? "text-red-600"
                    : "text-amber-700"
                }`}
              >
                {lineupSubmitted
                  ? "✓ Formazione inviata"
                  : isLocked
                  ? "🔒 Scadenza raggiunta"
                  : "⚠ Formazione da inviare"}
              </span>
              {!lineupSubmitted && !isLocked && (
                <Link
                  href="/lineup"
                  className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  Schiera ora →
                </Link>
              )}
              {lineupSubmitted && (
                <Link href="/lineup" className="text-xs text-green-600 hover:underline">
                  Modifica →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Top 5 standings */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Stagione
              </p>
              <h2 className="font-semibold text-gray-800 mt-0.5">Classifica</h2>
            </div>
            <Link href="/standings" className="text-xs font-semibold text-blue-600 hover:underline">
              Vedi tutto →
            </Link>
          </div>

          {standings.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400">
              <p className="text-3xl mb-2">🏆</p>
              <p className="text-sm">Nessuna partita giocata ancora.</p>
            </div>
          ) : (
            <div className="divide-y">
              {standings.slice(0, 5).map((s, i) => (
                <div
                  key={s.userId}
                  className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                    s.userId === session.userId
                      ? "bg-blue-50 border-l-4 border-blue-500"
                      : "border-l-4 border-transparent hover:bg-gray-50"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0
                        ? "bg-yellow-400 text-yellow-900"
                        : i === 1
                        ? "bg-gray-200 text-gray-700"
                        : i === 2
                        ? "bg-amber-600 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`flex-1 font-medium text-sm truncate ${
                      s.userId === session.userId ? "text-blue-700" : "text-gray-800"
                    }`}
                  >
                    {s.teamName}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {s.wins}V {s.draws}P
                  </span>
                  <span className="font-bold text-sm text-blue-600 shrink-0 w-12 text-right">
                    {s.points} pt
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── NEW WIDGETS GRID ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Score trend sparkline */}
        {scoreTrend.length >= 2 && (
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Il tuo andamento
            </p>
            <p className="font-semibold text-gray-800 mb-3">Punti per giornata</p>
            <ScoreSparkline data={scoreTrend} />
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>G{scoreTrend[0]?.matchday}</span>
              <span>
                Media{" "}
                <strong className="text-gray-600">
                  {(
                    scoreTrend.reduce((s, d) => s + d.score, 0) / scoreTrend.length
                  ).toFixed(1)}
                </strong>
              </span>
              <span>G{scoreTrend[scoreTrend.length - 1]?.matchday}</span>
            </div>
          </div>
        )}

        {/* Top scorer from my roster */}
        {topPlayers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              I tuoi migliori
            </p>
            <p className="font-semibold text-gray-800 mb-3">
              Top giocatori — G{topPlayersMatchday}
            </p>
            <div className="space-y-2.5">
              {topPlayers.map((p, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      idx === 0
                        ? "bg-yellow-100 text-yellow-700"
                        : idx === 1
                        ? "bg-gray-100 text-gray-600"
                        : "bg-orange-50 text-orange-600"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                    {p.name}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">
                    {p.mantraRole}
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums shrink-0 ${
                      p.fantavoto >= 8
                        ? "text-green-600"
                        : p.fantavoto >= 6
                        ? "text-blue-600"
                        : "text-red-500"
                    }`}
                  >
                    {p.fantavoto.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bacheca preview */}
        <div className="bg-white rounded-2xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Messaggi
              </p>
              <p className="font-semibold text-gray-800">Bacheca di lega</p>
            </div>
            <Link href="/bacheca" className="text-xs font-semibold text-blue-600 hover:underline">
              Vedi tutto →
            </Link>
          </div>

          {bachecaMessages.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-2xl mb-1">💬</p>
              <p className="text-gray-400 text-xs">Nessun messaggio ancora</p>
              <Link
                href="/bacheca"
                className="inline-block mt-2 text-xs text-green-600 hover:underline"
              >
                Scrivi il primo →
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {bachecaMessages.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {m.teamName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">
                      {m.teamName}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-snug mt-0.5">
                      {m.content}
                    </p>
                  </div>
                </div>
              ))}
              <Link
                href="/bacheca"
                className="block text-center text-xs text-green-600 hover:underline pt-1"
              >
                + rispondi nella bacheca
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── RECENT RESULTS ────────────────────────────────────── */}
      {recentMatchdays.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Attività
              </p>
              <h2 className="font-semibold text-gray-800 mt-0.5">Risultati recenti</h2>
            </div>
            <Link
              href="/calendar"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Calendario completo →
            </Link>
          </div>
          <div className="divide-y">
            {recentMatchdays.map(([mdNumber, matches]) => (
              <div key={mdNumber} className="px-5 py-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Giornata {mdNumber}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {matches.map((m) => {
                    const isMyMatch =
                      (m.homeUserId as number) === session.userId ||
                      (m.awayUserId as number) === session.userId;
                    const homeWins = (m.homePoints as number) === 3;
                    const awayWins = (m.awayPoints as number) === 3;
                    return (
                      <Link
                        key={m.id as number}
                        href={`/calendar/${m.id as number}`}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-colors border ${
                          isMyMatch
                            ? "border-blue-200 bg-blue-50/50 hover:bg-blue-100/50"
                            : "border-gray-100 hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`flex-1 text-right truncate font-semibold ${
                            homeWins ? "text-gray-800" : "text-gray-400"
                          }`}
                        >
                          {m.homeTeam as string}
                        </span>
                        <span className="shrink-0 font-bold text-gray-600 tabular-nums bg-gray-100 px-2 py-0.5 rounded-md text-center">
                          {m.homeGoals !== null
                            ? `${m.homeGoals as number}–${m.awayGoals as number}`
                            : `${(m.homeScore as number).toFixed(1)}–${(m.awayScore as number).toFixed(1)}`}
                        </span>
                        <span
                          className={`flex-1 truncate font-semibold ${
                            awayWins ? "text-gray-800" : "text-gray-400"
                          }`}
                        >
                          {m.awayTeam as string}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Notifiche push ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-gray-800 text-sm">Notifiche push</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Ricevi una notifica quando i voti vengono importati
          </p>
        </div>
        <PushSubscribeButton />
      </div>
    </div>
  );
}

/* ── Sparkline SVG ───────────────────────────────────────────────────────── */
function ScoreSparkline({ data }: { data: { matchday: number; score: number }[] }) {
  if (data.length < 2) return null;

  const W = 200;
  const H = 48;
  const PAD = 4;

  const scores = data.map((d) => d.score);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const range = maxS - minS || 1;

  const points = data
    .map((d, i) => {
      const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((d.score - minS) / range) * (H - PAD * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const last = data[data.length - 1];
  const lastX = PAD + ((W - PAD * 2));
  const lastY = H - PAD - ((last.score - minS) / range) * (H - PAD * 2);

  const trend = data.length >= 2 && data[data.length - 1].score >= data[data.length - 2].score;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      {/* Area fill */}
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trend ? "#16a34a" : "#3b82f6"} stopOpacity="0.15" />
          <stop offset="100%" stopColor={trend ? "#16a34a" : "#3b82f6"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`${PAD},${H} ${points} ${W - PAD},${H}`}
        fill="url(#spark-grad)"
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={trend ? "#16a34a" : "#3b82f6"}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Last point dot */}
      <circle
        cx={lastX}
        cy={lastY}
        r="3"
        fill={trend ? "#16a34a" : "#3b82f6"}
      />
      {/* Last score label */}
      <text
        x={lastX - 2}
        y={lastY - 6}
        textAnchor="end"
        fontSize="9"
        fill={trend ? "#16a34a" : "#3b82f6"}
        fontWeight="bold"
      >
        {last.score.toFixed(1)}
      </text>
    </svg>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */
function QuickAction({
  href,
  emoji,
  label,
  alert = false,
}: {
  href: string;
  emoji: string;
  label: string;
  alert?: boolean;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5 group">
      <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-xl sm:text-2xl hover:bg-white/20 transition-colors backdrop-blur-sm">
        {emoji}
        {alert && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-blue-900 animate-pulse" />
        )}
      </div>
      <span className="text-white/70 text-xs font-medium text-center leading-tight">
        {label}
      </span>
    </Link>
  );
}

function HeroStat({
  value,
  label,
  highlight = false,
}: {
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={`text-xl sm:text-2xl font-bold leading-none ${
          highlight ? "text-yellow-400" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="text-blue-300 text-xs mt-1 leading-tight">{label}</p>
    </div>
  );
}

async function getStandings(seasonId?: number) {
  if (!seasonId) return [];
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT
            u.id, u.teamName,
            COALESCE(SUM(CASE WHEN m.homeUserId = u.id THEN m.homePoints ELSE m.awayPoints END), 0) as points,
            COALESCE(SUM(CASE WHEN (m.homeUserId = u.id AND m.homePoints = 3) OR (m.awayUserId = u.id AND m.awayPoints = 3) THEN 1 ELSE 0 END), 0) as wins,
            COALESCE(SUM(CASE WHEN (m.homeUserId = u.id AND m.homePoints = 1) OR (m.awayUserId = u.id AND m.awayPoints = 1) THEN 1 ELSE 0 END), 0) as draws,
            COALESCE(SUM(CASE WHEN (m.homeUserId = u.id AND m.homePoints = 0) OR (m.awayUserId = u.id AND m.awayPoints = 0) THEN 1 ELSE 0 END), 0) as losses,
            COALESCE(ROUND(SUM(CASE WHEN m.homeUserId = u.id THEN m.homeScore ELSE m.awayScore END), 1), 0) as gf
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
    points: r.points as number,
    wins: r.wins as number,
    draws: r.draws as number,
    losses: r.losses as number,
    gf: r.gf as number,
  }));
}
