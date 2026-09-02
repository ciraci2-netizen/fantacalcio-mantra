import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import TeamLogo from "@/app/components/TeamLogo";
import Confetti from "@/app/components/Confetti";
import { roleBadgeClass } from "@/app/lib/roles";
import { computeAutoSubstitutions } from "@/app/lib/scoring";

const HARD_MAX_SUBSTITUTIONS = 5;

// Usa la stessa logica di sostituzione automatica di calculateScoresCore
// (app/lib/voteImporter.ts) - vedi computeAutoSubstitutions in
// app/lib/scoring.ts, unica fonte di verita condivisa dai due file. Qui
// serve solo per capire QUALI riserve sono effettivamente entrate in
// campo, per evidenziarle nel tabellino.
function computeSubbedInIds(slots: PlayerSlot[], maxSubstitutions: number): Set<number> {
  const starters = slots.filter((s) => s.isStarter);
  const reserves = slots.filter((s) => !s.isStarter);
  const subbedInIds = new Set<number>();

  const reserveForStarter = computeAutoSubstitutions(starters, reserves, maxSubstitutions);
  reserveForStarter.forEach((rIdx) => {
    if (rIdx !== null) subbedInIds.add(reserves[rIdx].playerId);
  });

  return subbedInIds;
}

type PlayerSlot = {
  playerId: number;
  name: string;
  mantraRole: string;
  fantavoto: number | null;
  isStarter: boolean;
};

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const id = parseInt(matchId);
  if (isNaN(id)) notFound();

  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  // Get match with both team names and matchday info
  let matchRes;
  try {
    matchRes = await db.execute({
      sql: `SELECT m.id, m.homeUserId, m.awayUserId,
                   m.homeScore, m.awayScore, m.homePoints, m.awayPoints,
                   m.homeGoals, m.awayGoals,
                   m.homeDefenseAvg, m.homeDefenseMalus, m.awayDefenseAvg, m.awayDefenseMalus,
                   hu.teamName as homeTeamName, hu.username as homeUsername,
                   au.teamName as awayTeamName, au.username as awayUsername,
                   md.number as matchdayNumber, md.id as matchdayId, md.seasonId as seasonId
            FROM "Match" m
            JOIN "User" hu ON hu.id = m.homeUserId
            JOIN "User" au ON au.id = m.awayUserId
            JOIN "Matchday" md ON md.id = m.matchdayId
            WHERE m.id = ?
            LIMIT 1`,
      args: [id],
    });
  } catch {
    // Colonne del modificatore difensivo non ancora migrate
    matchRes = await db.execute({
      sql: `SELECT m.id, m.homeUserId, m.awayUserId,
                   m.homeScore, m.awayScore, m.homePoints, m.awayPoints,
                   m.homeGoals, m.awayGoals,
                   hu.teamName as homeTeamName, hu.username as homeUsername,
                   au.teamName as awayTeamName, au.username as awayUsername,
                   md.number as matchdayNumber, md.id as matchdayId, md.seasonId as seasonId
            FROM "Match" m
            JOIN "User" hu ON hu.id = m.homeUserId
            JOIN "User" au ON au.id = m.awayUserId
            JOIN "Matchday" md ON md.id = m.matchdayId
            WHERE m.id = ?
            LIMIT 1`,
      args: [id],
    });
  }

  // Load logos
  const logoMap: Record<number, string | null> = {};
  try {
    const logoRes = await db.execute(`SELECT id, logoUrl FROM "User" WHERE isParticipant = 1`);
    for (const row of logoRes.rows) {
      logoMap[row.id as number] = (row.logoUrl as string | null) ?? null;
    }
  } catch { /* not yet migrated */ }

  if (matchRes.rows.length === 0) notFound();
  const match = matchRes.rows[0];

  const homeUserId = match.homeUserId as number;
  const awayUserId = match.awayUserId as number;
  const matchdayId = match.matchdayId as number;

  // Vantaggio campo configurato per la stagione (mostrato nel tabellino sotto,
  // se diverso da zero) - vedi calculateScoresCore in app/lib/voteImporter.ts,
  // dove viene sommato al punteggio della squadra di casa prima del confronto.
  let homeAdvantage = 0;
  let maxSubstitutions = 3;
  try {
    const seasonId = match.seasonId as number | undefined;
    if (seasonId) {
      const settingsRes = await db.execute({
        sql: `SELECT homeAdvantage, maxSubstitutions FROM "LeagueSettings" WHERE seasonId = ?`,
        args: [seasonId],
      });
      homeAdvantage = (settingsRes.rows[0]?.homeAdvantage as number) ?? 0;
      const rawMaxSubs = settingsRes.rows[0]?.maxSubstitutions as number | undefined;
      if (rawMaxSubs !== undefined) {
        maxSubstitutions = Math.min(rawMaxSubs, HARD_MAX_SUBSTITUTIONS);
      }
    }
  } catch { /* tabella impostazioni non ancora migrata */ }

  // Head-to-head history (past matches between same two teams)
  const h2hRes = await db.execute({
    sql: `SELECT m.id, m.homeUserId, m.homeScore, m.awayScore, m.homePoints,
                 m.homeGoals, m.awayGoals, md.number as matchdayNumber
          FROM "Match" m
          JOIN "Matchday" md ON md.id = m.matchdayId
          WHERE m.id != ?
            AND ((m.homeUserId = ? AND m.awayUserId = ?) OR (m.homeUserId = ? AND m.awayUserId = ?))
            AND m.homeScore IS NOT NULL
          ORDER BY md.number DESC
          LIMIT 5`,
    args: [id, homeUserId, awayUserId, awayUserId, homeUserId],
  });
  type H2HRow = { id: number; homeUserId: number; homeScore: number; awayScore: number; homePoints: number; homeGoals: number | null; awayGoals: number | null; matchdayNumber: number };
  const h2h: H2HRow[] = h2hRes.rows.map((r) => ({
    id: r.id as number,
    homeUserId: r.homeUserId as number,
    homeScore: r.homeScore as number,
    awayScore: r.awayScore as number,
    homePoints: r.homePoints as number,
    homeGoals: r.homeGoals !== undefined ? (r.homeGoals as number | null) : null,
    awayGoals: r.awayGoals !== undefined ? (r.awayGoals as number | null) : null,
    matchdayNumber: r.matchdayNumber as number,
  }));

  // Get both lineups with player slots + votes in one query
  const slotsRes = await db.execute({
    sql: `SELECT ls.lineupId, l.userId,
                 ls.isStarter, ls.position,
                 p.id as playerId, p.name, p.mantraRole,
                 pv.fantavoto
          FROM "LineupSlot" ls
          JOIN "Lineup" l ON l.id = ls.lineupId
          JOIN "Player" p ON p.id = ls.playerId
          LEFT JOIN "PlayerVote" pv ON pv.playerId = ls.playerId AND pv.matchdayId = ?
          WHERE l.matchdayId = ? AND l.userId IN (?, ?)
          ORDER BY l.userId ASC, ls.isStarter DESC, ls.position ASC`,
    args: [matchdayId, matchdayId, homeUserId, awayUserId],
  });

  const homeSlots: PlayerSlot[] = [];
  const awaySlots: PlayerSlot[] = [];

  for (const row of slotsRes.rows) {
    const slot: PlayerSlot = {
      playerId: row.playerId as number,
      name: row.name as string,
      mantraRole: row.mantraRole as string,
      fantavoto: row.fantavoto as number | null,
      isStarter: Boolean(row.isStarter),
    };
    if ((row.userId as number) === homeUserId) homeSlots.push(slot);
    else awaySlots.push(slot);
  }

  // Riserve entrate effettivamente in campo (sostituzione automatica di un
  // titolare senza voto), da evidenziare nel tabellino.
  const homeSubbedInIds = computeSubbedInIds(homeSlots, maxSubstitutions);
  const awaySubbedInIds = computeSubbedInIds(awaySlots, maxSubstitutions);

  const played = match.homeScore !== null;
  const homeWon = (match.homePoints as number) === 3;
  const awayWon = (match.awayPoints as number) === 3;

  // Confetti if current user won
  const iWon =
    played &&
    ((homeUserId === session.userId && homeWon) ||
      (awayUserId === session.userId && awayWon));

  return (
    <div className="space-y-6">
      {iWon && <Confetti />}
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/calendar" className="text-green-600 hover:underline text-sm">
          ← Calendario
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-500 text-sm">Giornata {match.matchdayNumber as number}</span>
      </div>

      {/* Match scoreboard */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className={`px-6 py-5 ${played ? (homeWon || awayWon ? "bg-blue-600" : "bg-slate-600") : "bg-gray-700"}`}>
          <p className="text-xs text-center text-blue-200 uppercase tracking-widest mb-4 font-medium">
            Giornata {match.matchdayNumber as number}
          </p>
          <div className="flex items-center justify-between gap-2">
            {/* Home team */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <TeamLogo logoUrl={logoMap[homeUserId] ?? null} teamName={match.homeTeamName as string} size="lg" />
              <p className={`text-base font-bold text-center truncate w-full ${homeUserId === session.userId ? "text-yellow-300" : "text-white"}`}>
                {match.homeTeamName as string}
              </p>
              <p className="text-blue-200 text-xs">{match.homeUsername as string}</p>
            </div>

            {/* Score */}
            <div className="shrink-0 text-center px-2 sm:px-6">
              {played ? (
                <>
                  <div className="text-4xl font-bold text-white tracking-tight tabular-nums">
                    <span className={homeWon ? "text-white" : "text-blue-300"}>
                      {match.homeGoals !== null
                        ? (match.homeGoals as number)
                        : (match.homeScore as number).toFixed(1)}
                    </span>
                    <span className="text-blue-300 mx-2 text-2xl">–</span>
                    <span className={awayWon ? "text-white" : "text-blue-300"}>
                      {match.awayGoals !== null
                        ? (match.awayGoals as number)
                        : (match.awayScore as number).toFixed(1)}
                    </span>
                  </div>
                  {match.homeGoals !== null && (
                    <p className="text-xs text-blue-300 mt-1 tabular-nums">
                      {(match.homeScore as number).toFixed(1)} – {(match.awayScore as number).toFixed(1)} pt
                    </p>
                  )}
                  <p className="text-xs text-blue-200 mt-1">
                    {homeWon ? "Vittoria casa" : awayWon ? "Vittoria ospiti" : "Pareggio"}
                  </p>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold text-blue-300">VS</span>
                  <p className="text-xs text-blue-200 mt-1.5">In programma</p>
                </>
              )}
            </div>

            {/* Away team */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <TeamLogo logoUrl={logoMap[awayUserId] ?? null} teamName={match.awayTeamName as string} size="lg" />
              <p className={`text-base font-bold text-center truncate w-full ${awayUserId === session.userId ? "text-yellow-300" : "text-white"}`}>
                {match.awayTeamName as string}
              </p>
              <p className="text-blue-200 text-xs">{match.awayUsername as string}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modificatore difensivo */}
      {played && (match.homeDefenseMalus != null || match.awayDefenseMalus != null) && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-3 border-b bg-cyan-50 flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <span className="font-semibold text-gray-700 text-sm">Modificatore difensivo</span>
          </div>
          <div className="p-4 space-y-2 text-sm">
            {match.homeDefenseMalus != null && (
              <p className="text-gray-600">
                Difesa <strong>{match.homeTeamName as string}</strong>: media{" "}
                <strong>{(match.homeDefenseAvg as number).toFixed(2)}</strong> →{" "}
                <span className="text-red-600 font-semibold">
                  {match.homeDefenseMalus as number} a {match.awayTeamName as string}
                </span>
              </p>
            )}
            {match.awayDefenseMalus != null && (
              <p className="text-gray-600">
                Difesa <strong>{match.awayTeamName as string}</strong>: media{" "}
                <strong>{(match.awayDefenseAvg as number).toFixed(2)}</strong> →{" "}
                <span className="text-red-600 font-semibold">
                  {match.awayDefenseMalus as number} a {match.homeTeamName as string}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Vantaggio campo */}
      {played && homeAdvantage !== 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-3 border-b bg-amber-50 flex items-center gap-2">
            <span className="font-semibold text-gray-700 text-sm">Vantaggio campo</span>
          </div>
          <div className="p-4 text-sm text-gray-600">
            <strong>{match.homeTeamName as string}</strong> gioca in casa:{" "}
            <span className={`font-semibold ${homeAdvantage > 0 ? "text-green-600" : "text-red-600"}`}>
              {homeAdvantage > 0 ? "+" : ""}
              {homeAdvantage} pt
            </span>{" "}
            applicati al punteggio prima del confronto con {match.awayTeamName as string}.
          </div>
        </div>
      )}

      {/* Head-to-head history */}
      {h2h.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
            <span className="text-base">⚔️</span>
            <span className="font-semibold text-gray-700 text-sm">Precedenti</span>
            <span className="text-xs text-gray-400 ml-1">
              {match.homeTeamName as string} vs {match.awayTeamName as string}
            </span>
          </div>
          <div className="divide-y">
            {h2h.map((row) => {
              // Determine which side is home for this past match
              const pastHomeIsCurrentHome = row.homeUserId === homeUserId;
              const displayHomeScore = pastHomeIsCurrentHome ? (row.homeGoals ?? row.homeScore) : (row.awayGoals ?? row.awayScore);
              const displayAwayScore = pastHomeIsCurrentHome ? (row.awayGoals ?? row.awayScore) : (row.homeGoals ?? row.homeScore);
              const homeWonPast = pastHomeIsCurrentHome ? row.homePoints === 3 : row.homePoints === 0;
              const awayWonPast = pastHomeIsCurrentHome ? row.homePoints === 0 : row.homePoints === 3;
              const drawPast = row.homePoints === 1;
              return (
                <Link key={row.id} href={`/calendar/${row.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors text-sm">
                  <span className="text-xs text-gray-400 w-6 shrink-0">G{row.matchdayNumber}</span>
                  <span className={`flex-1 text-right font-semibold truncate ${homeWonPast ? "text-green-700" : drawPast ? "text-gray-500" : "text-gray-400"}`}>
                    {match.homeTeamName as string}
                  </span>
                  <span className="font-bold tabular-nums px-2 shrink-0 text-gray-700">
                    {row.homeGoals !== null
                      ? `${displayHomeScore}–${displayAwayScore}`
                      : `${(pastHomeIsCurrentHome ? row.homeScore : row.awayScore).toFixed(1)}–${(pastHomeIsCurrentHome ? row.awayScore : row.homeScore).toFixed(1)}`}
                  </span>
                  <span className={`flex-1 font-semibold truncate ${awayWonPast ? "text-green-700" : drawPast ? "text-gray-500" : "text-gray-400"}`}>
                    {match.awayTeamName as string}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Lineups side by side */}
      {(homeSlots.length > 0 || awaySlots.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LineupCard
            teamName={match.homeTeamName as string}
            slots={homeSlots}
            isCurrentUser={homeUserId === session.userId}
            score={played ? (match.homeScore as number) : null}
            goals={match.homeGoals !== null ? (match.homeGoals as number) : null}
            won={homeWon}
            subbedInIds={homeSubbedInIds}
          />
          <LineupCard
            teamName={match.awayTeamName as string}
            slots={awaySlots}
            isCurrentUser={awayUserId === session.userId}
            score={played ? (match.awayScore as number) : null}
            goals={match.awayGoals !== null ? (match.awayGoals as number) : null}
            won={awayWon}
            subbedInIds={awaySubbedInIds}
          />
        </div>
      )}

      {homeSlots.length === 0 && awaySlots.length === 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-gray-400">
          <div className="text-3xl mb-2">📋</div>
          <p>Nessuna formazione inviata per questa partita.</p>
        </div>
      )}
    </div>
  );
}

function LineupCard({
  teamName,
  slots,
  isCurrentUser,
  score,
  goals,
  won,
  subbedInIds,
}: {
  teamName: string;
  slots: PlayerSlot[];
  isCurrentUser: boolean;
  score: number | null;
  goals: number | null;
  won: boolean;
  subbedInIds: Set<number>;
}) {
  const starters = slots.filter((s) => s.isStarter);
  const reserves = slots.filter((s) => !s.isStarter);

  const headerBg = won
    ? "bg-green-700"
    : score !== null
    ? "bg-gray-700"
    : "bg-gray-600";

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className={`${headerBg} text-white px-4 py-3 flex items-center justify-between`}>
        <span className={`font-semibold truncate ${isCurrentUser ? "text-green-200" : ""}`}>
          {teamName}
          {isCurrentUser && <span className="ml-1.5 text-xs opacity-70">(tu)</span>}
        </span>
        {score !== null && (
          <div className="text-right shrink-0 ml-2">
            {goals !== null && (
              <div className="text-xl font-bold tabular-nums">{goals} gol</div>
            )}
            <div className={`tabular-nums ${goals !== null ? "text-sm opacity-75" : "text-xl font-bold"}`}>
              {score.toFixed(1)} pt
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        {starters.length > 0 ? (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Titolari ({starters.length})
            </p>
            <div className="space-y-1">
              {starters.map((s) => (
                <SlotRow key={s.playerId} slot={s} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">Formazione non inviata</p>
        )}

        {reserves.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Riserve ({reserves.length})
              {subbedInIds.size > 0 && (
                <span className="ml-1.5 text-green-600 normal-case tracking-normal font-medium">
                  - {subbedInIds.size} entrat{subbedInIds.size === 1 ? "a" : "e"} in campo
                </span>
              )}
            </p>
            <div className="space-y-1">
              {reserves.map((s) => (
                <SlotRow key={s.playerId} slot={s} subbedIn={subbedInIds.has(s.playerId)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SlotRow({ slot, subbedIn = false }: { slot: PlayerSlot; subbedIn?: boolean }) {
  const fv = slot.fantavoto;
  const fvColor =
    fv === null ? "text-gray-400" :
    fv >= 8 ? "text-green-600 font-bold" :
    fv >= 6 ? "text-blue-600 font-semibold" :
    "text-red-500";

  // Riserva entrata effettivamente in campo (sostituzione automatica di un
  // titolare senza voto): evidenziata e non affievolita come le altre
  // riserve rimaste in panchina.
  const rowClass = subbedIn
    ? "flex items-center gap-2 py-1.5 pl-1.5 -ml-1.5 border-l-2 border-green-500 bg-green-50 rounded-r"
    : !slot.isStarter
    ? "flex items-center gap-2 py-1.5 opacity-60"
    : "flex items-center gap-2 py-1.5";

  return (
    <div className={rowClass}>
      <span
        className={`text-xs px-1.5 py-0.5 rounded font-bold shrink-0 ${
          roleBadgeClass(slot.mantraRole) ?? "bg-gray-100 text-gray-700"
        }`}
      >
        {slot.mantraRole}
      </span>
      {subbedIn && (
        <span
          title="Entrato dalla panchina"
          className="text-[10px] font-bold text-white bg-green-600 rounded px-1 py-0.5 shrink-0 leading-none"
        >
          IN
        </span>
      )}
      <Link
        href={`/giocatore/${slot.playerId}`}
        className={`text-sm flex-1 truncate hover:text-blue-600 hover:underline transition-colors ${
          subbedIn ? "text-green-800 font-medium" : "text-gray-700"
        }`}
      >
        {slot.name}
      </Link>
      <span className={`text-sm shrink-0 tabular-nums ${fvColor}`}>
        {fv !== null ? fv.toFixed(1) : <span className="text-gray-300 text-xs">sv</span>}
      </span>
    </div>
  );
}
