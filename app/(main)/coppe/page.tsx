import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

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
        <h1 className="text-2xl font-bold text-gray-800">Coppe — <span className="text-green-700">{season.name as string}</span></h1>
        <div className="text-center py-12 text-gray-400">Nessuna coppa configurata per questa stagione.</div>
      </div>
    );
  }

  const cups = await Promise.all(
    cupsRes.rows.map(async (cup) => {
      const roundsRes = await db.execute({
        sql: `SELECT id, name, number FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`,
        args: [cup.id],
      });

      const rounds = await Promise.all(
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
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">
        Coppe — <span className="text-green-700">{season.name as string}</span>
      </h1>

      {cups.map((cup) => (
        <div key={cup.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="bg-yellow-600 text-white px-4 py-3 font-bold text-lg">🏆 {cup.name}</div>

          {cup.rounds.length === 0 ? (
            <div className="p-4 text-gray-400 text-sm">Nessun turno configurato.</div>
          ) : (
            <div className="divide-y">
              {cup.rounds.map((round) => (
                <div key={round.id} className="p-4">
                  <h3 className="font-semibold text-gray-700 mb-3">{round.name}</h3>
                  <div className="space-y-2">
                    {round.matches.length === 0 ? (
                      <p className="text-gray-400 text-sm">Nessuna partita.</p>
                    ) : (
                      round.matches.map((m) => {
                        const isMyMatch = m.homeUserId === session.userId || m.awayUserId === session.userId;
                        const played = m.homeScore !== null;
                        let winner = "";
                        if (played) {
                          winner = (m.homeScore ?? 0) > (m.awayScore ?? 0) ? m.homeTeam : (m.awayScore ?? 0) > (m.homeScore ?? 0) ? m.awayTeam : "Pareggio";
                        }
                        return (
                          <div key={m.id} className={`flex items-center gap-2 p-2 rounded-lg ${isMyMatch ? "bg-green-50" : "bg-gray-50"}`}>
                            <span className={`flex-1 text-right font-medium text-sm ${m.homeUserId === session.userId ? "text-green-700" : ""}`}>
                              {m.homeTeam}
                            </span>
                            {played ? (
                              <div className="flex items-center gap-1 min-w-[90px] justify-center">
                                <span className={`font-bold ${(m.homeScore ?? 0) > (m.awayScore ?? 0) ? "text-green-600" : "text-gray-500"}`}>{m.homeScore?.toFixed(1)}</span>
                                <span className="text-gray-300">—</span>
                                <span className={`font-bold ${(m.awayScore ?? 0) > (m.homeScore ?? 0) ? "text-green-600" : "text-gray-500"}`}>{m.awayScore?.toFixed(1)}</span>
                              </div>
                            ) : (
                              <span className="text-gray-300 min-w-[90px] text-center font-bold text-sm">VS</span>
                            )}
                            <span className={`flex-1 font-medium text-sm ${m.awayUserId === session.userId ? "text-green-700" : ""}`}>
                              {m.awayTeam}
                            </span>
                            {played && winner && (
                              <span className="text-xs text-yellow-600 font-medium ml-2">🏆 {winner}</span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
