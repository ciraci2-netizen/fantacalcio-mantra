export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import Link from "next/link";

export const metadata: Metadata = { title: "Storico formazioni" };
import HistoryPitchToggle from "./HistoryPitchToggle";

export default async function LineupHistoryPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const lineupsRes = await db.execute({
    sql: `SELECT l.id, l.formation, l.totalScore, md.number as matchdayNumber
          FROM "Lineup" l
          JOIN "Matchday" md ON md.id = l.matchdayId
          WHERE l.userId = ? AND l.totalScore IS NOT NULL
          ORDER BY md.number DESC`,
    args: [session.userId],
  });

  const lineupMeta = lineupsRes.rows.map((r) => ({
    id: r.id as number,
    formation: r.formation as string,
    totalScore: r.totalScore as number,
    matchdayNumber: r.matchdayNumber as number,
  }));

  if (lineupMeta.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Storico Formazioni</h1>
          <Link href="/lineup" className="text-green-600 text-sm hover:underline">
            ← Formazione attuale
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500">Nessuna formazione giocata ancora.</p>
        </div>
      </div>
    );
  }

  // All slots + votes for all this user's completed lineups
  const slotsRes = await db.execute({
    sql: `SELECT ls.lineupId, ls.isStarter, ls.position,
                 p.id as playerId, p.name, p.mantraRole,
                 pv.fantavoto
          FROM "LineupSlot" ls
          JOIN "Player" p ON p.id = ls.playerId
          JOIN "Lineup" l ON l.id = ls.lineupId
          LEFT JOIN "PlayerVote" pv ON pv.playerId = ls.playerId AND pv.matchdayId = l.matchdayId
          WHERE l.userId = ? AND l.totalScore IS NOT NULL
          ORDER BY ls.lineupId DESC, ls.isStarter DESC, ls.position ASC`,
    args: [session.userId],
  });

  type Slot = {
    lineupId: number;
    isStarter: boolean;
    position: number;
    playerId: number;
    name: string;
    mantraRole: string;
    fantavoto: number | null;
  };

  const slotsByLineup = new Map<number, Slot[]>();
  for (const row of slotsRes.rows) {
    const lineupId = row.lineupId as number;
    if (!slotsByLineup.has(lineupId)) slotsByLineup.set(lineupId, []);
    slotsByLineup.get(lineupId)!.push({
      lineupId,
      isStarter: Boolean(row.isStarter),
      position: row.position as number,
      playerId: row.playerId as number,
      name: row.name as string,
      mantraRole: row.mantraRole as string,
      fantavoto: row.fantavoto as number | null,
    });
  }

  const avgScore =
    lineupMeta.reduce((sum, l) => sum + l.totalScore, 0) / lineupMeta.length;
  const bestLineup = lineupMeta.reduce((best, l) =>
    l.totalScore > best.totalScore ? l : best
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Storico Formazioni</h1>
        <Link href="/lineup" className="text-green-600 text-sm hover:underline">
          ← Formazione attuale
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{lineupMeta.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Giornate giocate</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{avgScore.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Media punti</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">
            {bestLineup.totalScore.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Miglior giornata (G{bestLineup.matchdayNumber})
          </div>
        </div>
      </div>

      {/* Lineup list */}
      <div className="space-y-4">
        {lineupMeta.map((lineup) => {
          const slots = slotsByLineup.get(lineup.id) ?? [];
          const starters = slots.filter((s) => s.isStarter);
          const reserves = slots.filter((s) => !s.isStarter);

          return (
            <HistoryPitchToggle
              key={lineup.id}
              lineupId={lineup.id}
              matchdayNumber={lineup.matchdayNumber}
              formation={lineup.formation}
              totalScore={lineup.totalScore}
              starters={starters}
              reserves={reserves}
            />
          );
        })}
      </div>
    </div>
  );
}
