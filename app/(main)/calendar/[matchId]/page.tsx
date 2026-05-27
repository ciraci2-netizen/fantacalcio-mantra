import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";

const ROLE_COLORS: Record<string, string> = {
  Por: "bg-yellow-100 text-yellow-800",
  Dc: "bg-blue-100 text-blue-800",
  Dd: "bg-blue-100 text-blue-800",
  Ds: "bg-blue-100 text-blue-800",
  M: "bg-green-100 text-green-800",
  C: "bg-green-100 text-green-800",
  T: "bg-green-100 text-green-800",
  W: "bg-green-100 text-green-800",
  A: "bg-red-100 text-red-800",
  Pc: "bg-red-100 text-red-800",
};

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
  const matchRes = await db.execute({
    sql: `SELECT m.id, m.homeUserId, m.awayUserId,
                 m.homeScore, m.awayScore, m.homePoints, m.awayPoints,
                 hu.teamName as homeTeamName, hu.username as homeUsername,
                 au.teamName as awayTeamName, au.username as awayUsername,
                 md.number as matchdayNumber, md.id as matchdayId
          FROM "Match" m
          JOIN "User" hu ON hu.id = m.homeUserId
          JOIN "User" au ON au.id = m.awayUserId
          JOIN "Matchday" md ON md.id = m.matchdayId
          WHERE m.id = ?
          LIMIT 1`,
    args: [id],
  });

  if (matchRes.rows.length === 0) notFound();
  const match = matchRes.rows[0];

  const homeUserId = match.homeUserId as number;
  const awayUserId = match.awayUserId as number;
  const matchdayId = match.matchdayId as number;

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

  const played = match.homeScore !== null;
  const homeWon = (match.homePoints as number) === 3;
  const awayWon = (match.awayPoints as number) === 3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/calendar" className="text-green-600 hover:underline text-sm">
          ← Calendario
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-500 text-sm">Giornata {match.matchdayNumber as number}</span>
      </div>

      {/* Match scoreboard */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <p className="text-xs text-center text-gray-400 uppercase tracking-widest mb-4">
          Giornata {match.matchdayNumber as number}
        </p>
        <div className="flex items-center justify-between gap-4">
          {/* Home team */}
          <div className="flex-1 text-center min-w-0">
            <p
              className={`text-xl font-bold truncate ${
                homeUserId === session.userId ? "text-green-700" : "text-gray-800"
              }`}
            >
              {match.homeTeamName as string}
              {homeWon && <span className="ml-2 text-base">🏆</span>}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">{match.homeUsername as string}</p>
          </div>

          {/* Score */}
          <div className="shrink-0 text-center px-4">
            {played ? (
              <div className="text-3xl font-bold text-gray-800">
                <span className={homeWon ? "text-green-600" : awayWon ? "text-red-500" : "text-gray-500"}>
                  {(match.homeScore as number).toFixed(1)}
                </span>
                <span className="text-gray-300 mx-2">–</span>
                <span className={awayWon ? "text-green-600" : homeWon ? "text-red-500" : "text-gray-500"}>
                  {(match.awayScore as number).toFixed(1)}
                </span>
              </div>
            ) : (
              <span className="text-3xl font-bold text-gray-200">VS</span>
            )}
            {played ? (
              <p className="text-xs text-gray-400 mt-1">
                {homeWon ? "Vittoria casa" : awayWon ? "Vittoria ospiti" : "Pareggio"}
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">In programma</p>
            )}
          </div>

          {/* Away team */}
          <div className="flex-1 text-center min-w-0">
            <p
              className={`text-xl font-bold truncate ${
                awayUserId === session.userId ? "text-green-700" : "text-gray-800"
              }`}
            >
              {awayWon && <span className="mr-2 text-base">🏆</span>}
              {match.awayTeamName as string}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">{match.awayUsername as string}</p>
          </div>
        </div>
      </div>

      {/* Lineups side by side */}
      {(homeSlots.length > 0 || awaySlots.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LineupCard
            teamName={match.homeTeamName as string}
            slots={homeSlots}
            isCurrentUser={homeUserId === session.userId}
            score={played ? (match.homeScore as number) : null}
            won={homeWon}
          />
          <LineupCard
            teamName={match.awayTeamName as string}
            slots={awaySlots}
            isCurrentUser={awayUserId === session.userId}
            score={played ? (match.awayScore as number) : null}
            won={awayWon}
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
  won,
}: {
  teamName: string;
  slots: PlayerSlot[];
  isCurrentUser: boolean;
  score: number | null;
  won: boolean;
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
          <span className="text-xl font-bold shrink-0 ml-2">{score.toFixed(1)}</span>
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
            </p>
            <div className="space-y-1 opacity-70">
              {reserves.map((s) => (
                <SlotRow key={s.playerId} slot={s} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SlotRow({ slot }: { slot: PlayerSlot }) {
  const fv = slot.fantavoto;
  const scoreColor =
    fv === null
      ? "text-gray-400"
      : fv >= 7
      ? "text-green-600 font-bold"
      : fv >= 6
      ? "text-gray-700"
      : "text-red-500";

  return (
    <div className="flex items-center gap-2 py-1">
      <span
        className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
          ROLE_COLORS[slot.mantraRole] ?? "bg-gray-100 text-gray-700"
        }`}
      >
        {slot.mantraRole}
      </span>
      <span className="text-sm flex-1 truncate">{slot.name}</span>
      <span className={`text-sm shrink-0 tabular-nums ${scoreColor}`}>
        {fv !== null ? fv.toFixed(1) : "sv"}
      </span>
    </div>
  );
}
