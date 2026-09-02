import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { importVotesCore, calculateScoresCore, MISMATCH_PREFIX } from "@/app/lib/voteImporter";
import { sendPushToAll } from "@/app/lib/pushNotification";
import { revalidatePath } from "next/cache";

// Minimum number of scraped players to consider data complete
const MIN_PLAYERS = 100;

/** Structured JSON logger for Vercel logs */
function log(level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, cron: "auto-import", msg, ...data });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

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
    log("warn", "No active season found — skipping");
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
    log("info", "No pending matchday to import");
    return NextResponse.json({ skipped: "No pending matchday to import" });
  }

  const matchday = matchdayRes.rows[0];
  const matchdayId = matchday.id as number;
  const matchdayNumber = matchday.number as number;
  log("info", "Starting vote import", { matchdayId, matchdayNumber });

  try {
    // 3. Import votes (scrape)
    const result = await importVotesCore(matchdayId, matchdayNumber);
    log("info", "Scrape complete", { matched: result.matched, unmatched: result.unmatched });

    if (result.matched < MIN_PLAYERS) {
      // Data probably not yet complete — undo votesImported flag and retry next time
      await db.execute({
        sql: `UPDATE "Matchday" SET votesImported = 0 WHERE id = ?`,
        args: [matchdayId],
      });
      log("warn", "Too few players matched — retrying later", { matched: result.matched, threshold: MIN_PLAYERS });
      return NextResponse.json({
        skipped: `Only ${result.matched} players matched (< ${MIN_PLAYERS}) — data not yet complete`,
      });
    }

    // 4. Calculate all scores
    await calculateScoresCore(matchdayId);
    log("info", "Scores calculated");

    // 5. Revalidate key pages
    revalidatePath("/standings");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/lineup");

    // 6. Send push notifications to all subscribers
    const { sent, failed } = await sendPushToAll(
      `⚽ Voti G${matchdayNumber} importati!`,
      `${result.matched} giocatori aggiornati. Controlla il tuo punteggio!`,
      "/standings"
    );
    log("info", "Push notifications sent", { sent, failed });

    const response = {
      success: true,
      matchday: matchdayNumber,
      matched: result.matched,
      unmatched: result.unmatched,
      pushSent: sent,
    };
    log("info", "Auto-import completed", response);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // fantapiu3 mostra ancora una giornata diversa da quella attesa: non è un
    // errore, è normale finché il sito non pubblica quella giusta — nessuna
    // scrittura è avvenuta (votesImported resta 0), il cron riproverà al
    // prossimo giro senza bisogno di alcun intervento.
    if (message.startsWith(MISMATCH_PREFIX)) {
      const detected = message.slice(MISMATCH_PREFIX.length);
      log("info", "Giornata su fantapiu3 non ancora corrispondente — riprovo più tardi", {
        matchdayNumber,
        detectedOnSite: detected,
      });
      return NextResponse.json({
        skipped: `fantapiu3 mostra la Giornata ${detected}, non la ${matchdayNumber} — riproverà più tardi`,
      });
    }

    log("error", "Auto-import failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
