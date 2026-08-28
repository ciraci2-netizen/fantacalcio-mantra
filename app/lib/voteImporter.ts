/**
 * Core vote import + score calculation logic.
 * Used by both the admin server actions and the auto-import cron.
 * No authentication here — callers must verify auth themselves.
 */

import { revalidatePath } from "next/cache";
import { getDb } from "./db";
import { scrapeVotes } from "./scraper";
import {
  calculateFantavoto,
  calculateGoalBonus,
  convertScoreToGoals,
  DEFAULT_GOAL_THRESHOLDS,
  DEFAULT_SCORE_CONVERSION,
  type GoalThreshold,
  type ScoreConversion,
} from "./scoring";

export interface ImportResult {
  matched: number;
  unmatched: number;
  matchdayNumber: number;
}

// ── Import scraped votes for a matchday ────────────────────────────────────
export async function importVotesCore(
  matchdayId: number,
  matchdayNumber: number
): Promise<ImportResult> {
  const scraped = await scrapeVotes(matchdayNumber);
  if (scraped.length === 0) {
    throw new Error("Nessun voto trovato sul sito. Riprova più tardi.");
  }

  const db = getDb();
  const playersRes = await db.execute(
    `SELECT id, name, fantapiu3Name, mantraRole FROM "Player"`
  );
  const players = playersRes.rows;

  let matched = 0;
  let unmatched = 0;

  for (const vote of scraped) {
    const player = players.find(
      (p) =>
        (p.fantapiu3Name && p.fantapiu3Name === vote.name) ||
        p.name === vote.name
    );

    if (!player) {
      unmatched++;
      continue;
    }

    const fantavoto = calculateFantavoto(
      {
        vote: vote.vote,
        fantavoto: vote.fantavoto,
        gfGs: vote.gfGs,
        gsr: vote.gsr,
        amm: vote.amm,
        esp: vote.esp,
        rpRs: vote.rpRs,
        aut: vote.aut,
        ass: vote.ass,
        adf: vote.adf,
      },
      player.mantraRole as string
    );

    await db.execute({
      sql: `INSERT OR REPLACE INTO "PlayerVote"
            (playerId, matchdayId, vote, fantavoto, gfGs, gsr, amm, esp, rpRs, aut, ass, adf)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        player.id,
        matchdayId,
        vote.vote,
        fantavoto,
        vote.gfGs,
        vote.gsr,
        vote.amm,
        vote.esp,
        vote.rpRs,
        vote.aut,
        vote.ass,
        vote.adf,
      ],
    });
    matched++;
  }

  await db.execute({
    sql: `UPDATE "Matchday" SET votesImported = 1 WHERE id = ?`,
    args: [matchdayId],
  });

  return { matched, unmatched, matchdayNumber };
}

// ── Auto-generate best lineup for users who didn't submit ─────────────────
async function autoGenerateLineup(
  userId: number,
  matchdayId: number,
  db: ReturnType<typeof getDb>
) {
  const existing = await db.execute({
    sql: `SELECT id FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
    args: [userId, matchdayId],
  });
  if (existing.rows.length > 0) return;

  const rosterRes = await db.execute({
    sql: `SELECT p.id, p.mantraRole, COALESCE(pv.fantavoto, 0) as fv, pv.fantavoto as hasFv
          FROM "Roster" r
          JOIN "Player" p ON p.id = r.playerId
          LEFT JOIN "PlayerVote" pv ON pv.playerId = p.id AND pv.matchdayId = ?
          WHERE r.userId = ?
          ORDER BY COALESCE(pv.fantavoto, 0) DESC`,
    args: [matchdayId, userId],
  });

  if (rosterRes.rows.length === 0) return;

  type RP = { id: number; mantraRole: string; fv: number; hasFv: boolean };
  const roster: RP[] = rosterRes.rows.map((r) => ({
    id: r.id as number,
    mantraRole: r.mantraRole as string,
    fv: r.fv as number,
    hasFv: r.hasFv !== null,
  }));

  const pick = (pool: RP[], roles: string[], n: number): RP[] => {
    const sorted = pool
      .filter((p) => roles.includes(p.mantraRole))
      .sort((a, b) => (b.hasFv ? 1 : 0) - (a.hasFv ? 1 : 0) || b.fv - a.fv);
    return sorted.slice(0, n);
  };

  const gk = pick(roster, ["POR"], 1);
  const def = pick(roster.filter((p) => !gk.includes(p)), ["DC", "TER"], 4);
  const mid = pick(
    roster.filter((p) => !gk.includes(p) && !def.includes(p)),
    ["M", "OFF"],
    4
  );
  const att = pick(
    roster.filter((p) => !gk.includes(p) && !def.includes(p) && !mid.includes(p)),
    ["ATT"],
    2
  );

  const starters = [...gk, ...def, ...mid, ...att];
  if (starters.length < 11) return;

  const usedIds = new Set(starters.map((p) => p.id));
  const reserves = roster
    .filter((p) => !usedIds.has(p.id))
    .sort((a, b) => (b.hasFv ? 1 : 0) - (a.hasFv ? 1 : 0) || b.fv - a.fv)
    .slice(0, 11);

  const lineupRes = await db.execute({
    sql: `INSERT INTO "Lineup" (userId, matchdayId, formation, isSubmitted, isAutomatic) VALUES (?, ?, '4-4-2', 1, 1)`,
    args: [userId, matchdayId],
  });
  const lineupId = Number(lineupRes.lastInsertRowid);

  for (let i = 0; i < starters.length; i++) {
    await db.execute({
      sql: `INSERT INTO "LineupSlot" (lineupId, playerId, position, isStarter) VALUES (?, ?, ?, 1)`,
      args: [lineupId, starters[i].id, i + 1],
    });
  }
  for (let i = 0; i < reserves.length; i++) {
    await db.execute({
      sql: `INSERT INTO "LineupSlot" (lineupId, playerId, position, isStarter) VALUES (?, ?, ?, 0)`,
      args: [lineupId, reserves[i].id, i + 1],
    });
  }
}

// ── Calculate scores for all lineups in a matchday ────────────────────────
export async function calculateScoresCore(matchdayId: number): Promise<void> {
  const db = getDb();

  const mdRes = await db.execute({
    sql: `SELECT seasonId FROM "Matchday" WHERE id = ?`,
    args: [matchdayId],
  });
  if (mdRes.rows.length === 0) throw new Error("Giornata non trovata.");
  const seasonId = mdRes.rows[0].seasonId as number;

  let maxSubstitutions = 3;
  let goalThresholds: GoalThreshold[] = DEFAULT_GOAL_THRESHOLDS;
  let homeAdvantage = 0;
  let scoreConversion: ScoreConversion = DEFAULT_SCORE_CONVERSION;

  try {
    const settingsRes = await db.execute({
      sql: `SELECT maxSubstitutions, goalThresholds, homeAdvantage, scoreConversion FROM "LeagueSettings" WHERE seasonId = ?`,
      args: [seasonId],
    });
    if (settingsRes.rows.length > 0) {
      maxSubstitutions = settingsRes.rows[0].maxSubstitutions as number;
      homeAdvantage = (settingsRes.rows[0].homeAdvantage as number) ?? 0;
      try {
        goalThresholds = JSON.parse(settingsRes.rows[0].goalThresholds as string);
      } catch { /* usa default */ }
      try {
        if (settingsRes.rows[0].scoreConversion) {
          scoreConversion = JSON.parse(settingsRes.rows[0].scoreConversion as string);
        }
      } catch { /* usa default */ }
    }
  } catch { /* table not yet migrated */ }

  // Auto-generate for non-submitters
  const allUsersRes = await db.execute(`SELECT id FROM "User" WHERE isParticipant = 1`);
  for (const user of allUsersRes.rows) {
    await autoGenerateLineup(user.id as number, matchdayId, db);
  }

  // Score each lineup
  const lineupsRes = await db.execute({
    sql: `SELECT id FROM "Lineup" WHERE matchdayId = ? AND isSubmitted = 1`,
    args: [matchdayId],
  });

  for (const lineup of lineupsRes.rows) {
    const lineupId = lineup.id as number;
    const slotsRes = await db.execute({
      sql: `SELECT ls.position, ls.isStarter, p.mantraRole,
                   pv.fantavoto, COALESCE(pv.gfGs, 0) as goals
            FROM "LineupSlot" ls
            JOIN "Player" p ON p.id = ls.playerId
            LEFT JOIN "PlayerVote" pv ON pv.playerId = ls.playerId AND pv.matchdayId = ?
            WHERE ls.lineupId = ?`,
      args: [matchdayId, lineupId],
    });

    const starterRows = slotsRes.rows
      .filter((s) => Number(s.isStarter) === 1)
      .sort((a, b) => (a.position as number) - (b.position as number));
    const reserveRows = slotsRes.rows
      .filter((s) => Number(s.isStarter) === 0)
      .sort((a, b) => (a.position as number) - (b.position as number));

    let base = 0;
    let subsUsed = 0;
    let totalGoals = 0;
    const usedReserveIdxs = new Set<number>();

    for (const starter of starterRows) {
      const gfGs = starter.goals as number;
      if (gfGs > 0) totalGoals += gfGs;

      if (starter.fantavoto !== null) {
        base += starter.fantavoto as number;
      } else if (subsUsed < maxSubstitutions) {
        const rIdx = reserveRows.findIndex(
          (_, i) => !usedReserveIdxs.has(i) && reserveRows[i].fantavoto !== null
        );
        if (rIdx !== -1) {
          usedReserveIdxs.add(rIdx);
          base += reserveRows[rIdx].fantavoto as number;
          subsUsed++;
        }
      }
    }

    const goalBonus = calculateGoalBonus(totalGoals, goalThresholds);
    const total = Math.round((base + goalBonus) * 100) / 100;

    await db.execute({
      sql: `UPDATE "Lineup" SET totalScore = ?, goalBonus = ?, substitutions = ? WHERE id = ?`,
      args: [total, goalBonus, subsUsed, lineupId],
    });
  }

  // Compute match results
  const matchesRes = await db.execute({
    sql: `SELECT id, homeUserId, awayUserId FROM "Match" WHERE matchdayId = ?`,
    args: [matchdayId],
  });

  for (const match of matchesRes.rows) {
    const homeRes = await db.execute({
      sql: `SELECT totalScore FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
      args: [match.homeUserId, matchdayId],
    });
    const awayRes = await db.execute({
      sql: `SELECT totalScore FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
      args: [match.awayUserId, matchdayId],
    });

    const homeScore = (homeRes.rows[0]?.totalScore as number) ?? 0;
    const awayScore = (awayRes.rows[0]?.totalScore as number) ?? 0;

    // Convert scores to goals (Mantra system) — null when conversion disabled
    const homeGoals = scoreConversion.enabled ? convertScoreToGoals(homeScore, scoreConversion) : null;
    const awayGoals = scoreConversion.enabled ? convertScoreToGoals(awayScore, scoreConversion) : null;

    let homePoints = 1;
    let awayPoints = 1;

    if (scoreConversion.enabled && homeGoals !== null && awayGoals !== null) {
      // Win/loss based on goals, with home advantage applied before conversion
      const effectiveHomeGoals = convertScoreToGoals(homeScore + homeAdvantage, scoreConversion);
      if (effectiveHomeGoals > awayGoals) { homePoints = 3; awayPoints = 0; }
      else if (awayGoals > effectiveHomeGoals) { homePoints = 0; awayPoints = 3; }
    } else {
      // Classic: compare raw scores with home advantage
      const effectiveHome = homeScore + homeAdvantage;
      if (effectiveHome > awayScore) { homePoints = 3; awayPoints = 0; }
      else if (awayScore > effectiveHome) { homePoints = 0; awayPoints = 3; }
    }

    await db.execute({
      sql: `UPDATE "Match" SET homeScore = ?, awayScore = ?, homePoints = ?, awayPoints = ?, homeGoals = ?, awayGoals = ? WHERE id = ?`,
      args: [homeScore, awayScore, homePoints, awayPoints, homeGoals, awayGoals, match.id],
    });
  }

  revalidatePath("/standings");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}
