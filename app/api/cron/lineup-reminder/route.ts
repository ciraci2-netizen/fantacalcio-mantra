import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { sendLineupReminders } from "@/app/lib/lineupReminders";

/**
 * Vercel Cron (una volta al giorno, vedi vercel.json): se la scadenza della
 * giornata corrente cade nelle prossime 24 ore, manda un promemoria push
 * SOLO a chi non ha ancora consegnato la formazione. Girando ogni 24 ore,
 * ogni giornata riceve un solo promemoria automatico.
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

  const res = await db.execute(
    `SELECT md.id, md.number, md.deadline
     FROM "Matchday" md
     JOIN "Season" s ON s.id = md.seasonId AND md.number = s.currentMatchday
     WHERE s.isActive = 1 AND md.isLocked = 0 AND md.deadline IS NOT NULL
     LIMIT 1`
  );
  const md = res.rows[0];
  if (!md) return NextResponse.json({ message: "Nessuna giornata aperta con scadenza" });

  const msLeft = new Date(md.deadline as string).getTime() - Date.now();
  if (!(msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ message: `G${md.number}: scadenza non nelle prossime 24 ore, nessun promemoria` });
  }

  const { missingTeams, withPush } = await sendLineupReminders(db, md.id as number);
  console.log(`[cron/lineup-reminder] G${md.number}: ${missingTeams.length} senza formazione, ${withPush} con notifiche attive`);
  return NextResponse.json({ matchday: md.number, missingTeams, withPush });
}
