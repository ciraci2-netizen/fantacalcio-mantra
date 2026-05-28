import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";

// POST /api/push/subscribe — save a push subscription
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const body = await req.json();
    const { endpoint, keys } = body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 });
    }

    const db = getDb();
    await db.execute({
      sql: `INSERT OR REPLACE INTO "PushSubscription" (userId, endpoint, p256dh, auth, createdAt)
            VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [session.userId, endpoint, keys.p256dh, keys.auth],
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/subscribe]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/push/subscribe — remove a push subscription
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const { endpoint } = await req.json() as { endpoint: string };
    if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

    const db = getDb();
    await db.execute({
      sql: `DELETE FROM "PushSubscription" WHERE userId = ? AND endpoint = ?`,
      args: [session.userId, endpoint],
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/unsubscribe]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
