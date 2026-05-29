import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { checkRateLimit } from "@/app/lib/rateLimit";

/**
 * GET /api/score-preview?matchdayId=X
 *
 * Returns the live estimated score for the current user's submitted lineup
 * for the given matchday, based on already-imported player votes.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: max 30 score-preview requests per user per minute (it's polled every few seconds)
  if (!checkRateLimit(`score-preview:${session.userId}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const matchdayId = Number(req.nextUrl.searchParams.get("matchdayId"));
  if (!matchdayId) return NextResponse.json({ error: "Missing matchdayId" }, { status: 400 });

  const db = getDb();

  // Find submitted lineup for this user + matchday
  const lineupRes = await db.execute({
    sql: `SELECT id FROM "Lineup" WHERE userId = ? AND matchdayId = ? AND isSubmitted = 1 LIMIT 1`,
    args: [session.userId, matchdayId],
  });

  if (lineupRes.rows.length === 0) {
    return NextResponse.json({ estimated: null, reason: "no_lineup" });
  }

  const lineupId = lineupRes.rows[0].id as number;

  // Load starters + reserves with votes
  const slotsRes = await db.execute({
    sql: `SELECT ls.position, ls.isStarter, pv.fantavoto, COALESCE(pv.gfGs, 0) as goals
          FROM "LineupSlot" ls
          LEFT JOIN "PlayerVote" pv ON pv.playerId = ls.playerId AND pv.matchdayId = ?
          WHERE ls.lineupId = ?
          ORDER BY ls.isStarter DESC, ls.position ASC`,
    args: [matchdayId, lineupId],
  });

  const starters = slotsRes.rows
    .filter((r) => Number(r.isStarter) === 1)
    .sort((a, b) => (a.position as number) - (b.position as number));
  const reserves = slotsRes.rows
    .filter((r) => Number(r.isStarter) === 0)
    .sort((a, b) => (a.position as number) - (b.position as number));

  // Count how many starters have votes
  const votedStarters = starters.filter((s) => s.fantavoto !== null).length;
  const totalStarters = starters.length;

  // Compute estimated score (same logic as calculateAllScores)
  // Default max substitutions = 3 (could read from LeagueSettings)
  let maxSubs = 3;
  try {
    const settRes = await db.execute({
      sql: `SELECT maxSubstitutions FROM "LeagueSettings"
            WHERE seasonId = (SELECT seasonId FROM "Matchday" WHERE id = ? LIMIT 1)`,
      args: [matchdayId],
    });
    if (settRes.rows[0]?.maxSubstitutions) {
      maxSubs = settRes.rows[0].maxSubstitutions as number;
    }
  } catch { /* settings table not available */ }

  let base = 0;
  let subsUsed = 0;
  let totalGoals = 0;
  const usedReserveIdxs = new Set<number>();

  for (const starter of starters) {
    const goals = starter.goals as number;
    if (goals > 0) totalGoals += goals;

    if (starter.fantavoto !== null) {
      base += starter.fantavoto as number;
    } else if (subsUsed < maxSubs) {
      const rIdx = reserves.findIndex(
        (_, i) => !usedReserveIdxs.has(i) && reserves[i].fantavoto !== null
      );
      if (rIdx !== -1) {
        usedReserveIdxs.add(rIdx);
        base += reserves[rIdx].fantavoto as number;
        subsUsed++;
      }
    }
  }

  // Simple goal bonus: +3 per goal if >0
  const goalBonus = totalGoals > 0 ? totalGoals * 3 : 0;
  const estimated = Math.round((base + goalBonus) * 100) / 100;

  return NextResponse.json({
    estimated,
    votedStarters,
    totalStarters,
    subsUsed,
    isComplete: votedStarters === totalStarters,
  });
}
