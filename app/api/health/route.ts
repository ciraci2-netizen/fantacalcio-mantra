import { NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { log } from "@/app/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  try {
    const db = getDb();
    await db.execute("SELECT 1 as ok");
    const ms = Date.now() - start;
    log("health_check", { status: "ok", ms });
    return NextResponse.json({ status: "ok", db: "connected", ms, ts: new Date().toISOString() });
  } catch (err) {
    log("health_check", { status: "error", error: String(err) }, "error");
    return NextResponse.json(
      { status: "error", db: "unreachable", error: String(err), ts: new Date().toISOString() },
      { status: 503 }
    );
  }
}
