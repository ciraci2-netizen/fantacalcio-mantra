import type { Metadata } from "next";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { computeGroupStandings } from "@/app/lib/cupStandings";

export const metadata: Metadata = { title: "Coppe" };

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
  type: "eliminazione" | "girone";
  matchdayNumber: number | null;
  playDate: string | null;
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
      // "type" e' una colonna aggiunta dopo (fase a gironi) - se il DB non e'
      // ancora migrato, ricadiamo su un turno "eliminazione" per tutti.
      let roundsRes;
      try {
        roundsRes = await db.execute({
          sql: `SELECT id, name, number, type, matchdayNumber, playDate FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`,
          args: [cup.id],
        });
      } catch {
        roundsRes = await db.execute({
          sql: `SELECT id, name, number FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`,
          args: [cup.id],
        });
      }

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
            type: ((round.type as string | undefined) ?? "eliminazione") as "eliminazione" | "girone",
            matchdayNumber: (round.matchdayNumber as number | null | undefined) ?? null,
            playDate: (round.playDate as string | null | undefined) ?? null,
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

      {cups.map((cup) => {
        const groupRounds = cup.rounds.filter((r) => r.type === "girone");
        const knockoutRounds = cup.rounds.filter((r) => r.type !== "girone");

        return (
          <div key={cup.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="bg-yellow-600 text-white px-5 py-3 font-bold text-lg flex items-center gap-2">
              {"\ud83c\udfc6"} {cup.name}
            </div>

            {cup.rounds.length === 0 ? (
              <div className="p-4 text-gray-400 text-sm">Nessun turno configurato.</div>
            ) : (
              <>
                {/* Gironi: classifica per ognuno */}
                {groupRounds.length > 0 && (
                  <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5 border-b">
                    {groupRounds.map((round) => (
                      <GroupStandings key={round.id} round={round} currentUserId={session.userId} />
                    ))}
                  </div>
                )}

                {/* Turni a eliminazione diretta: bracket a colonne */}
                {knockoutRounds.length > 0 && (
                  <div className="overflow-x-auto">
                    <div className="flex min-w-max p-5 gap-0">
                      {knockoutRounds.map((round, roundIdx) => {
                        const isLast = roundIdx === knockoutRounds.length - 1;
                        return (
                          <div key={round.id} className="flex items-stretch">
                            {/* Round column */}
                            <div className="w-60">
                              <div className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4 text-center px-2 pb-2 border-b">
                                {round.name}
                                {formatSchedule(round) && (
                                  <div className="text-[10px] font-normal normal-case text-gray-400 mt-1">
                                    {formatSchedule(round)}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col justify-around h-full gap-4">
                                {round.matches.length === 0 ? (
                                  <p className="text-gray-300 text-sm text-center py-4">{"\u2013"}</p>
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
                                {"\u2192"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Etichetta "quando si gioca" per un turno/girone: giornata di campionato
// e/o data, solo informativa (nessun calcolo automatico dal punteggio).
function formatSchedule(round: CupRound): string | null {
  const parts: string[] = [];
  if (round.matchdayNumber !== null) parts.push(`Giornata ${round.matchdayNumber}`);
  if (round.playDate) {
    const d = new Date(round.playDate);
    if (!isNaN(d.getTime())) {
      parts.push(d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }));
    }
  }
  return parts.length > 0 ? parts.join(" " + String.fromCharCode(183) + " ") : null;
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

function GroupStandings({
  round,
  currentUserId,
}: {
  round: CupRound;
  currentUserId: number;
}) {
  const standings = computeGroupStandings(round.matches);
  const qualifyCount = Math.min(4, standings.length);

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 border-b">
        <h3 className="font-semibold text-gray-700 text-sm">{round.name}</h3>
        {formatSchedule(round) && (
          <p className="text-xs text-gray-400 mt-0.5">{formatSchedule(round)}</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide">
              <th className="text-left font-medium px-3 py-2">#</th>
              <th className="text-left font-medium px-3 py-2">Squadra</th>
              <th className="text-center font-medium px-2 py-2">PG</th>
              <th className="text-center font-medium px-2 py-2">V</th>
              <th className="text-center font-medium px-2 py-2">N</th>
              <th className="text-center font-medium px-2 py-2">P</th>
              <th className="text-center font-medium px-2 py-2">DR</th>
              <th className="text-center font-medium px-3 py-2">Pt</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const qualified = i < qualifyCount;
              const isMe = s.userId === currentUserId;
              return (
                <tr
                  key={s.userId}
                  className={`border-t ${qualified ? "bg-green-50" : ""} ${isMe ? "font-semibold" : ""}`}
                >
                  <td className={`px-3 py-2 ${qualified ? "text-green-700" : "text-gray-400"}`}>{i + 1}</td>
                  <td className={`px-3 py-2 truncate max-w-[160px] ${isMe ? "text-green-700" : "text-gray-700"}`}>
                    {s.teamName}
                  </td>
                  <td className="text-center px-2 py-2 text-gray-500">{s.played}</td>
                  <td className="text-center px-2 py-2 text-gray-500">{s.wins}</td>
                  <td className="text-center px-2 py-2 text-gray-500">{s.draws}</td>
                  <td className="text-center px-2 py-2 text-gray-500">{s.losses}</td>
                  <td className="text-center px-2 py-2 text-gray-500 tabular-nums">
                    {s.diff > 0 ? `+${s.diff.toFixed(1)}` : s.diff.toFixed(1)}
                  </td>
                  <td className="text-center px-3 py-2 font-bold text-gray-800">{s.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {qualifyCount > 0 && (
        <div className="px-4 py-2 border-t bg-green-50/60 text-xs text-green-700">
          {"\u2713"} Le prime {qualifyCount} passano il turno
        </div>
      )}
    </div>
  );
}
