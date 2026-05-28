import webpush from "web-push";
import { getDb } from "./db";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? "admin@ipa-fantasy.com";

let _initialized = false;

function ensureInit() {
  if (_initialized || !VAPID_PUBLIC || !VAPID_PRIVATE) return;
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC, VAPID_PRIVATE);
  _initialized = true;
}

/**
 * Send a push notification to all subscribed users.
 * Silently removes expired/invalid subscriptions (410 Gone).
 */
export async function sendPushToAll(
  title: string,
  body: string,
  url = "/dashboard"
): Promise<{ sent: number; failed: number }> {
  ensureInit();
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn("[push] VAPID keys not configured — skipping push");
    return { sent: 0, failed: 0 };
  }

  const db = getDb();
  let subs: { endpoint: string; p256dh: string; auth: string }[] = [];
  try {
    const res = await db.execute(
      `SELECT endpoint, p256dh, auth FROM "PushSubscription"`
    );
    subs = res.rows.map((r) => ({
      endpoint: r.endpoint as string,
      p256dh: r.p256dh as string,
      auth: r.auth as string,
    }));
  } catch {
    return { sent: 0, failed: 0 };
  }

  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 410 || code === 404) {
          // Subscription expired → clean up
          try {
            await db.execute({
              sql: `DELETE FROM "PushSubscription" WHERE endpoint = ?`,
              args: [sub.endpoint],
            });
          } catch { /* ignore */ }
        }
      }
    })
  );

  return { sent, failed };
}

/**
 * Send a push notification to a single user.
 */
export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
  url = "/dashboard"
): Promise<void> {
  ensureInit();
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const db = getDb();
  try {
    const res = await db.execute({
      sql: `SELECT endpoint, p256dh, auth FROM "PushSubscription" WHERE userId = ?`,
      args: [userId],
    });
    const payload = JSON.stringify({ title, body, url });

    await Promise.allSettled(
      res.rows.map((r) =>
        webpush.sendNotification(
          {
            endpoint: r.endpoint as string,
            keys: { p256dh: r.p256dh as string, auth: r.auth as string },
          },
          payload
        )
      )
    );
  } catch { /* ignore */ }
}
