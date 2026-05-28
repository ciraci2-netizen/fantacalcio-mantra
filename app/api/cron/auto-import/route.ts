import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { importVotesCore, calculateScoresCore } from "@/app/lib/voteImporter";
import { sendPushToAll } from "@/app/lib/pushNotification";
import { revalidatePath } from "next/cache";

// Minimum number of scraped players to consider data complete
const MIN_PLAYERS = 100;

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET (same as other cron endpoints)
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // 1. Find active season
  const seasonRes = await db.execute(
    `SELECT id, currentMatchday FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  if (!seasonRes.rows[0]) {
    return NextResponse.json({ skipped: "No active season" });
  }
  const season = seasonRes.rows[0];

  // 2. Find the most recent locked matchday with no votes yet
  const matchdayRes = await db.execute({
    sql: `SELECT id, number FROM "Matchday"
          WHERE seasonId = ? AND isLocked = 1 AND votesImported = 0
          ORDER BY number DESC LIMIT 1`,
    args: [season.id],
  });

  if (!matchdayRes.rows[0]) {
    return NextResponse.json({ skipped: "No pending matchday to import" });
  }

  const matchday = matchdayRes.rows[0];
  const matchdayId = matchday.id as number;
  const matchdayNumber = matchday.number as number;

  try {
    // 3. Import votes (scrape)
    const result = await importVotesCore(matchdayId, matchdayNumber);

    if (result.matched < MIN_PLAYERS) {
      // Data probably not yet complete — undo votesImported flag and retry next time
      await db.execute({
        sql: `UPDATE "Matchday" SET votesImported = 0 WHERE id = ?`,
        args: [matchdayId],
      });
      return NextResponse.json({
        skipped: `Only ${result.matched} players matched (< ${MIN_PLAYERS}) — data not yet complete`,
      });
    }

    // 4. Calculate all scores
    await calculateScoresCore(matchdayId);

    // 5. Revalidate key pages
    revalidatePath("/standings");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/lineup");

    // 6. Send push notifications to all subscribers
    const { sent } = await sendPushToAll(
      `⚽ Voti G${matchdayNumber} importati!`,
      `${result.matched} giocatori aggiornati. Controlla il tuo punteggio!`,
      "/standings"
    );

    return NextResponse.json({
      success: true,
      matchday: matchdayNumber,
      matched: result.matched,
      unmatched: result.unmatched,
      pushSent: sent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[auto-import]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
