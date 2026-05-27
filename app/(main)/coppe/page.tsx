import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

type CupMatch = {
  id: number;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: string;
  awayTeam: string;
  homeUserId: number;
  awayUserId: number;
};

type CupRound = {
  id: number;
  name: string;
  number: number;
  matches: CupMatch[];
};

type Cup = {
  id: number;
  name: string;
  rounds: CupRound[];
};

export default async function CoppePage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const seasonRes = await db.execute(`SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return <div className="text-center py-12 text-gray-500">Nessuna stagione attiva.</div>;
  }

  const cupsRes = await db.execute({
    sql: `SELECT id, name FROM "Cup" WHERE seasonId = ? ORDER BY id ASC`,
    args: [season.id],
  });

  if (cupsRes.rows.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">
          Coppe — <span className="text-green-700">{season.name as string}</span>
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center text-amber-700">
          <div className="text-4xl mb-3">🏆</div>
          <p className="font-medium">Nessuna coppa configurata.</p>
          <p className="text-sm mt-1">L&apos;admin può crearle da Admin → Gestisci Coppe.</p>
        </div>
      </div>
    );
  }

  const cups: Cup[] = await Promise.all(
    cupsRes.rows.map(async (cup) => {
      const roundsRes = await db.execute({
        sql: `SELECT id, name, number FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`,
        args: [cup.id],
      });

      const rounds: CupRound[] = await Promise.all(
        roundsRes.rows.map(async (round) => {
          const matchesRes = await db.execute({
            sql: `SELECT cm.id, cm.homeScore, cm.awayScore, cm.homeUserId, cm.awayUserId,
                         hu.teamName as homeTeam, au.teamName as awayTeam
                  FROM "CupMatch" cm
                  JOIN "User" hu ON hu.id = cm.homeUserId
                  JOIN "User" au ON au.id = cm.awayUserId
                  WHERE cm.cupRoundId = ?`,
            args: [round.id],
          });
          return {
            id: round.id as number,
            name: round.name as string,
            number: round.number as number,
            matches: matchesRes.rows.map((m) => ({
              id: m.id as number,
              homeScore: m.homeScore as number | null,
              awayScore: m.awayScore as number | null,
              homeTeam: m.homeTeam as string,
              awayTeam: m.awayTeam as string,
              homeUserId: m.homeUserId as number,
              awayUserId: m.awayUserId as number,
            })),
          };
        })
      );

      return { id: cup.id as number, name: cup.name as string, rounds };
    })
  );

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold text-gray-800">
        Coppe — <span className="text-green-700">{season.name as string}</span>
      </h1>

      {cups.map((cup) => (
        <div key={cup.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="bg-yellow-600 text-white px-5 py-3 font-bold text-lg flex items-center gap-2">
            🏆 {cup.name}
          </div>

          {cup.rounds.length === 0 ? (
            <div className="p-4 text-gray-400 text-sm">Nessun turno configurato.</div>
          ) : (
            <div className="overflow-x-auto">
              {/* Bracket: rounds as horizontal columns */}
              <div className="flex min-w-max p-5 gap-0">
                {cup.rounds.map((round, roundIdx) => {
                  const isLast = roundIdx === cup.rounds.length - 1;
                  return (
                    <div key={round.id} className="flex items-stretch">
                      {/* Round column */}
                      <div className="w-60">
                        <div className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4 text-center px-2 pb-2 border-b">
                          {round.name}
                        </div>
                        <div className="flex flex-col justify-around h-full gap-4">
                          {round.matches.length === 0 ? (
                            <p className="text-gray-300 text-sm text-center py-4">–</p>
                          ) : (
                            round.matches.map((m) => (
                              <MatchCard
                                key={m.id}
                                match={m}
                                currentUserId={session.userId}
                              />
                            ))
                          )}
                        </div>
                      </div>

                      {/* Connector arrow */}
                      {!isLast && (
                        <div className="w-10 flex items-center justify-center text-gray-200 text-2xl select-none shrink-0">
                          →
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MatchCard({
  match: m,
  currentUserId,
}: {
  match: CupMatch;
  currentUserId: number;
}) {
  const played = m.homeScore !== null && m.awayScore !== null;
  const homeWins = played && (m.homeScore ?? 0) > (m.awayScore ?? 0);
  const awayWins = played && (m.awayScore ?? 0) > (m.homeScore ?? 0);
  const draw = played && m.homeScore === m.awayScore;
  const isMyMatch = m.homeUserId === currentUserId || m.awayUserId === currentUserId;

  return (
    <div
      className={`rounded-xl border overflow-hidden text-sm shadow-sm ${
        isMyMatch ? "border-green-300 shadow-green-100" : "border-gray-200"
      }`}
    >
      {/* Home team */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b ${
          homeWins ? "bg-green-50" : draw ? "bg-gray-50" : played ? "bg-red-50" : "bg-white"
        }`}
      >
        <span
          className={`font-medium truncate max-w-[120px] ${
            m.homeUserId === currentUserId
              ? "text-green-700"
              : homeWins
              ? "text-green-800"
              : "text-gray-700"
          }`}
        >
          {homeWins && "🏆 "}
          {m.homeTeam}
        </span>
        <span
          className={`font-bold ml-2 shrink-0 ${
            homeWins ? "text-green-700" : played ? "text-gray-500" : "text-gray-300"
          }`}
        >
          {played ? m.homeScore?.toFixed(1) : "–"}
        </span>
      </div>

      {/* Away team */}
      <div
        className={`flex items-center justify-between px-3 py-2 ${
          awayWins ? "bg-green-50" : draw ? "bg-gray-50" : played ? "bg-red-50" : "bg-white"
        }`}
      >
        <span
          className={`font-medium truncate max-w-[120px] ${
            m.awayUserId === currentUserId
              ? "text-green-700"
              : awayWins
              ? "text-green-800"
              : "text-gray-700"
          }`}
        >
          {awayWins && "🏆 "}
          {m.awayTeam}
        </span>
        <span
          className={`font-bold ml-2 shrink-0 ${
            awayWins ? "text-green-700" : played ? "text-gray-500" : "text-gray-300"
          }`}
        >
          {played ? m.awayScore?.toFixed(1) : "–"}
        </span>
      </div>
    </div>
  );
}
