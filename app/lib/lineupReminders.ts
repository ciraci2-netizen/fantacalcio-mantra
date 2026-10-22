import type { Client } from "@libsql/client/http";
import { sendPushToUser } from "./pushNotification";

/**
 * Promemoria push "consegna la formazione" SOLO a chi non l'ha ancora
 * inviata per la giornata indicata. Usato dal cron giornaliero
 * (app/api/cron/lineup-reminder) e dal tasto admin "Invia promemoria ora".
 */
export async function sendLineupReminders(
  db: Client,
  matchdayId: number
): Promise<{ missingTeams: string[]; withPush: number }> {
  const mdRes = await db.execute({
    sql: `SELECT number, deadline FROM "Matchday" WHERE id = ?`,
    args: [matchdayId],
  });
  const md = mdRes.rows[0];
  if (!md) return { missingTeams: [], withPush: 0 };

  const missingRes = await db.execute({
    sql: `SELECT u.id, u.teamName FROM "User" u
          WHERE u.isParticipant = 1
            AND NOT EXISTS (SELECT 1 FROM "Lineup" l WHERE l.userId = u.id AND l.matchdayId = ?)
          ORDER BY u.teamName ASC`,
    args: [matchdayId],
  });

  const deadline = (md.deadline as string | null) ?? null;
  const when = deadline
    ? new Date(deadline).toLocaleString("it-IT", {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Berlin",
      })
    : null;
  const body = when
    ? `Non hai ancora consegnato la formazione della G${md.number}. Scadenza: ${when}.`
    : `Non hai ancora consegnato la formazione della G${md.number}.`;

  let withPush = 0;
  for (const row of missingRes.rows) {
    const userId = row.id as number;
    try {
      const subs = await db.execute({
        sql: `SELECT COUNT(*) as c FROM "PushSubscription" WHERE userId = ?`,
        args: [userId],
      });
      if (Number(subs.rows[0]?.c ?? 0) > 0) withPush++;
    } catch { /* tabella push non presente */ }
    await sendPushToUser(userId, "⏰ Formazione da consegnare", body, "/lineup");
  }

  return { missingTeams: missingRes.rows.map((r) => r.teamName as string), withPush };
}
