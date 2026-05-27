import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";

const ROLE_COLORS: Record<string, string> = {
  Por: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Dc: "bg-blue-100 text-blue-800 border-blue-300",
  Dd: "bg-sky-100 text-sky-800 border-sky-300",
  Ds: "bg-sky-100 text-sky-800 border-sky-300",
  M:  "bg-green-100 text-green-800 border-green-300",
  C:  "bg-emerald-100 text-emerald-800 border-emerald-300",
  T:  "bg-purple-100 text-purple-800 border-purple-300",
  W:  "bg-orange-100 text-orange-800 border-orange-300",
  A:  "bg-red-100 text-red-800 border-red-300",
  Pc: "bg-rose-100 text-rose-800 border-rose-300",
};

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = parseInt(id);
  if (isNaN(playerId)) notFound();

  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  // Player info + owner
  const playerRes = await db.execute({
    sql: `SELECT p.id, p.name, p.mantraRole, p.realTeam,
                 u.id as ownerId, u.teamName as ownerTeamName,
                 r.purchasePrice
          FROM "Player" p
          LEFT JOIN "Roster" r ON r.playerId = p.id
          LEFT JOIN "User" u ON u.id = r.userId
          WHERE p.id = ?`,
    args: [playerId],
  });
  if (playerRes.rows.length === 0) notFound();
  const player = playerRes.rows[0];

  // Votes per matchday
  const votesRes = await db.execute({
    sql: `SELECT pv.vote, pv.fantavoto, pv.gfGs, pv.ass, pv.amm, pv.esp, pv.aut, pv.gsr,
                 md.number as matchdayNumber
          FROM "PlayerVote" pv
          JOIN "Matchday" md ON md.id = pv.matchdayId
          WHERE pv.playerId = ?
          ORDER BY md.number ASC`,
    args: [playerId],
  });

  const votes = votesRes.rows.map((r) => ({
    matchdayNumber: r.matchdayNumber as number,
    vote: r.vote as number | null,
    fantavoto: r.fantavoto as number | null,
    gfGs: r.gfGs as number,
    ass: r.ass as number,
    amm: r.amm as number,
    esp: r.esp as number,
    aut: r.aut as number,
    gsr: r.gsr as number,
  }));

  const votedGames = votes.filter((v) => v.vote !== null);
  const avgVote = votedGames.length > 0
    ? votedGames.reduce((s, v) => s + (v.vote ?? 0), 0) / votedGames.length
    : null;
  const avgFv = votedGames.length > 0
    ? votedGames.reduce((s, v) => s + (v.fantavoto ?? 0), 0) / votedGames.length
    : null;
  const totalGoals = votes.reduce((s, v) => s + v.gfGs, 0);
  const totalAssists = votes.reduce((s, v) => s + v.ass, 0);
  const totalAmm = votes.reduce((s, v) => s + v.amm, 0);
  const totalEsp = votes.reduce((s, v) => s + v.esp, 0);
  const bestFv = votedGames.length > 0
    ? Math.max(...votedGames.map((v) => v.fantavoto ?? 0))
    : null;

  const roleColor = ROLE_COLORS[player.mantraRole as string] ?? "bg-gray-100 text-gray-700 border-gray-300";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Link href="/svincolati" className="text-sm text-green-600 hover:underline">
        ← Giocatori
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-start gap-4">
          <span className={`text-sm px-2.5 py-1 rounded border font-bold shrink-0 ${roleColor}`}>
            {player.mantraRole as string}
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-800 truncate">{player.name as string}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{player.realTeam as string}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {player.ownerId ? (
                <Link
                  href={`/squadre/${player.ownerId as number}`}
                  className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors"
                >
                  👥 {player.ownerTeamName as string}
                  {player.purchasePrice ? ` · ${player.purchasePrice as number} cr` : ""}
                </Link>
              ) : (
                <span className="text-xs bg-gray-50 border text-gray-400 px-2.5 py-1 rounded-full">
                  🆓 Svincolato
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      {votes.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: "Presenze", value: votedGames.length, color: "text-gray-800" },
            { label: "Media voto", value: avgVote?.toFixed(2) ?? "—", color: "text-gray-800" },
            { label: "Media FV", value: avgFv?.toFixed(2) ?? "—", color: "text-blue-600" },
            { label: "Best FV", value: bestFv?.toFixed(1) ?? "—", color: "text-green-600" },
            { label: "Gol", value: totalGoals, color: "text-green-600" },
            { label: "Assist", value: totalAssists, color: "text-blue-500" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border shadow-sm p-3 text-center">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Extra stats row */}
      {(totalAmm > 0 || totalEsp > 0) && (
        <div className="flex gap-3">
          {totalAmm > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm">
              🟨 <span className="font-semibold text-amber-700">{totalAmm}</span>{" "}
              <span className="text-amber-500">ammonizioni</span>
            </div>
          )}
          {totalEsp > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm">
              🟥 <span className="font-semibold text-red-700">{totalEsp}</span>{" "}
              <span className="text-red-500">espulsioni</span>
            </div>
          )}
        </div>
      )}

      {/* Votes table */}
      {votes.length > 0 ? (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm">Voti per giornata</h2>
            <span className="text-xs text-gray-400">{votes.length} giornate</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-400 uppercase tracking-wide bg-gray-50/50">
                  <th className="px-4 py-2.5 text-left">Gior.</th>
                  <th className="px-4 py-2.5 text-center">Voto</th>
                  <th className="px-4 py-2.5 text-center text-blue-500 font-semibold">FV</th>
                  <th className="px-4 py-2.5 text-center">⚽</th>
                  <th className="px-4 py-2.5 text-center">🅰</th>
                  <th className="px-4 py-2.5 text-center">🟨</th>
                  <th className="px-4 py-2.5 text-center">🟥</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {votes.map((v) => (
                  <tr key={v.matchdayNumber} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-500 font-medium">G{v.matchdayNumber}</td>
                    <td className="px-4 py-2.5 text-center">
                      {v.vote !== null ? (
                        <span className={`font-medium ${v.vote >= 7 ? "text-green-600" : v.vote < 6 ? "text-red-500" : "text-gray-700"}`}>
                          {v.vote.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">sv</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {v.fantavoto !== null ? (
                        <span className={`font-bold ${v.fantavoto >= 8 ? "text-green-600" : v.fantavoto >= 6 ? "text-blue-600" : "text-red-400"}`}>
                          {v.fantavoto.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {v.gfGs > 0 ? <span className="font-semibold text-green-600">{v.gfGs}</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {v.ass > 0 ? <span className="font-medium text-blue-500">{v.ass}</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {v.amm > 0 ? <span className="text-amber-500">{v.amm}</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {v.esp > 0 ? <span className="text-red-500 font-bold">{v.esp}</span> : <span className="text-gray-200">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm p-10 text-center text-gray-400">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-medium">Nessun voto importato</p>
          <p className="text-sm mt-1">I voti appariranno qui dopo l&apos;importazione giornaliera.</p>
        </div>
      )}
    </div>
  );
}
