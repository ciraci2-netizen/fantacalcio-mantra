import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Vercel Cron: auto-lock current matchday every Saturday at 11:00 UTC.
 * vercel.json: { "crons": [{ "path": "/api/cron/lock-matchday", "schedule": "0 11 * * 6" }] }
 *
 * Vercel automatically sends Authorization: Bearer $CRON_SECRET on cron invocations.
 * Set CRON_SECRET in Vercel env vars (any random string).
 */
export async function GET(req: NextRequest) {
  // Verify caller is Vercel Cron (or an authorized admin trigger)
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : null;

  if (expected && authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Find active season
  const seasonRes = await db.execute(
    `SELECT id, name, currentMatchday FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  if (seasonRes.rows.length === 0) {
    return NextResponse.json({ message: "No active season found" });
  }
  const season = seasonRes.rows[0];

  // Find current matchday
  const matchdayRes = await db.execute({
    sql: `SELECT id, number, isLocked FROM "Matchday" WHERE seasonId = ? AND number = ? LIMIT 1`,
    args: [season.id, season.currentMatchday],
  });
  if (matchdayRes.rows.length === 0) {
    return NextResponse.json({ message: "Current matchday not found" });
  }
  const matchday = matchdayRes.rows[0];

  if (Number(matchday.isLocked) === 1) {
    return NextResponse.json({
      message: `Matchday ${matchday.number} is already locked — nothing to do`,
    });
  }

  const currentNumber = matchday.number as number;
  const nextNumber = currentNumber + 1;

  // Lock current matchday
  await db.execute({
    sql: `UPDATE "Matchday" SET isLocked = 1 WHERE id = ?`,
    args: [matchday.id],
  });

  // Advance to next matchday only if it exists
  const nextMatchdayRes = await db.execute({
    sql: `SELECT id FROM "Matchday" WHERE seasonId = ? AND number = ? LIMIT 1`,
    args: [season.id, nextNumber],
  });

  let advanced = false;
  if (nextMatchdayRes.rows.length > 0) {
    await db.execute({
      sql: `UPDATE "Season" SET currentMatchday = ? WHERE id = ?`,
      args: [nextNumber, season.id],
    });
    advanced = true;
  }

  // Invalidate relevant pages
  revalidatePath("/dashboard");
  revalidatePath("/lineup");
  revalidatePath("/standings");
  revalidatePath("/calendar");
  revalidatePath("/admin/votes");
  revalidatePath("/admin/schedule");
  revalidatePath("/public/standings");
  revalidatePath("/public/calendar");

  const msg = advanced
    ? `✅ Locked G${currentNumber}, advanced to G${nextNumber}`
    : `✅ Locked G${currentNumber} (last matchday of the season)`;

  console.log(`[cron/lock-matchday] ${msg}`);
  return NextResponse.json({ success: true, message: msg });
}
