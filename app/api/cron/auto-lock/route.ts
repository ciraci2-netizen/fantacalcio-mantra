import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Vercel Cron: auto-lock matchdays when their deadline has passed.
 * Also auto-generates lineups for managers who haven't submitted.
 *
 * vercel.json schedule: every hour at :05 past  →  "5 * * * *"
 *
 * Auth: Vercel sends Authorization: Bearer $CRON_SECRET automatically.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expected && authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date().toISOString();

  // Find matchdays whose deadline has passed but are not yet locked
  const toLockRes = await db.execute({
    sql: `SELECT md.id, md.number, md.seasonId, s.currentMatchday
          FROM "Matchday" md
          JOIN "Season" s ON s.id = md.seasonId
          WHERE s.isActive = 1
            AND md.isLocked = 0
            AND md.deadline IS NOT NULL
            AND md.deadline <= ?`,
    args: [now],
  });

  if (toLockRes.rows.length === 0) {
    return NextResponse.json({ message: "Nothing to lock", checked: now });
  }

  const locked: number[] = [];

  for (const row of toLockRes.rows) {
    const matchdayId = row.id as number;
    const matchdayNumber = row.number as number;
    const seasonId = row.seasonId as number;

    // 1. Auto-generate lineups for non-submitters
    const allUsersRes = await db.execute(
      `SELECT id FROM "User" WHERE isParticipant = 1`
    );

    for (const user of allUsersRes.rows) {
      const userId = user.id as number;

      // Skip if already submitted
      const existing = await db.execute({
        sql: `SELECT id FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
        args: [userId, matchdayId],
      });
      if (existing.rows.length > 0) continue;

      // Get roster with votes for this matchday
      const rosterRes = await db.execute({
        sql: `SELECT p.id, p.mantraRole,
                     COALESCE(pv.fantavoto, 0) as fv,
                     pv.fantavoto as hasFv
              FROM "Roster" r
              JOIN "Player" p ON p.id = r.playerId
              LEFT JOIN "PlayerVote" pv ON pv.playerId = p.id AND pv.matchdayId = ?
              WHERE r.userId = ?
              ORDER BY COALESCE(pv.fantavoto, 0) DESC`,
        args: [matchdayId, userId],
      });

      if (rosterRes.rows.length < 11) continue;

      type RP = { id: number; mantraRole: string; fv: number; hasFv: boolean };
      const roster: RP[] = rosterRes.rows.map((r) => ({
        id: r.id as number,
        mantraRole: r.mantraRole as string,
        fv: r.fv as number,
        hasFv: r.hasFv !== null,
      }));

      const defRoles = ["DC", "TER"];
      const midRoles = ["M", "OFF"];
      const attRoles = ["ATT"];

      const pick = (pool: RP[], roles: string[], n: number): RP[] => {
        const sorted = pool
          .filter((p) => roles.includes(p.mantraRole))
          .sort((a, b) => (b.hasFv ? 1 : 0) - (a.hasFv ? 1 : 0) || b.fv - a.fv);
        return sorted.slice(0, n);
      };

      const gk = pick(roster, ["POR"], 1);
      const def = pick(
        roster.filter((p) => !gk.includes(p)),
        defRoles,
        4
      );
      const mid = pick(
        roster.filter((p) => !gk.includes(p) && !def.includes(p)),
        midRoles,
        4
      );
      const att = pick(
        roster.filter((p) => !gk.includes(p) && !def.includes(p) && !mid.includes(p)),
        attRoles,
        2
      );

      const starters = [...gk, ...def, ...mid, ...att];
      if (starters.length < 11) continue;

      const usedIds = new Set(starters.map((p) => p.id));
      const reserves = roster
        .filter((p) => !usedIds.has(p.id))
        .sort((a, b) => (b.hasFv ? 1 : 0) - (a.hasFv ? 1 : 0) || b.fv - a.fv)
        .slice(0, 11);

      const lineupRes = await db.execute({
        sql: `INSERT INTO "Lineup" (userId, matchdayId, formation, isSubmitted, isAutomatic)
              VALUES (?, ?, '4-4-2', 1, 1)`,
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

    // 2. Lock the matchday
    await db.execute({
      sql: `UPDATE "Matchday" SET isLocked = 1 WHERE id = ?`,
      args: [matchdayId],
    });

    // 3. Advance season currentMatchday if this is the current one
    const nextRes = await db.execute({
      sql: `SELECT id FROM "Matchday" WHERE seasonId = ? AND number = ? LIMIT 1`,
      args: [seasonId, matchdayNumber + 1],
    });
    if (nextRes.rows.length > 0) {
      await db.execute({
        sql: `UPDATE "Season" SET currentMatchday = ? WHERE id = ?`,
        args: [matchdayNumber + 1, seasonId],
      });
    }

    locked.push(matchdayNumber);
    console.log(`[cron/auto-lock] Locked G${matchdayNumber} (season ${seasonId})`);
  }

  // Invalidate pages
  revalidatePath("/lineup");
  revalidatePath("/dashboard");
  revalidatePath("/standings");
  revalidatePath("/calendar");
  revalidatePath("/admin/votes");

  return NextResponse.json({
    success: true,
    locked: locked.map((n) => `G${n}`),
    message: `Locked ${locked.length} matchday(s)`,
  });
}
