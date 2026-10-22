import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { fillMissingLineups } from "@/app/lib/missingLineups";

/**
 * Vercel Cron: auto-lock matchdays when their deadline has passed.
 * Also fills in lineups for managers who haven't submitted (previous lineup re-used).
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

    // 1. Formazioni d'ufficio per chi non ha consegnato: si ripropone
    //    l'ultima formazione (vedi app/lib/missingLineups.ts)
    await fillMissingLineups(db, matchdayId);

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
