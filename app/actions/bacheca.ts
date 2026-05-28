"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

// ── Rate limiting (in-memory, per userId) ────────────────────────────
const rateLimitMap = new Map<number, number>(); // userId → last post timestamp ms
const RATE_LIMIT_MS = 30_000; // 30 seconds between posts

function checkRateLimit(userId: number): boolean {
  const last = rateLimitMap.get(userId) ?? 0;
  const now = Date.now();
  if (now - last < RATE_LIMIT_MS) return false;
  rateLimitMap.set(userId, now);
  return true;
}

// ── HTML sanitisation ─────────────────────────────────────────────────
function sanitize(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")   // strip HTML tags
    .replace(/&lt;/g, "<")     // decode common entities
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

// ── postMessage ───────────────────────────────────────────────────────
export async function postMessage(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  if (!checkRateLimit(session.userId)) {
    return "Attendi 30 secondi prima di postare di nuovo.";
  }

  const rawContent = formData.get("content") as string ?? "";
  const content = sanitize(rawContent);

  if (content.length < 2) return "Messaggio troppo corto.";
  if (content.length > 500) return "Messaggio troppo lungo (max 500 caratteri).";

  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  if (!seasonRes.rows[0]) return "Nessuna stagione attiva.";
  const seasonId = seasonRes.rows[0].id as number;

  try {
    await db.execute({
      sql: `INSERT INTO "LeagueMessage" (seasonId, userId, content, createdAt)
            VALUES (?, ?, ?, datetime('now'))`,
      args: [seasonId, session.userId, content],
    });
  } catch {
    // Table might not exist yet — create it and retry
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "LeagueMessage" (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        seasonId  INTEGER NOT NULL,
        userId    INTEGER NOT NULL,
        content   TEXT    NOT NULL,
        createdAt TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await db.execute({
      sql: `INSERT INTO "LeagueMessage" (seasonId, userId, content, createdAt)
            VALUES (?, ?, ?, datetime('now'))`,
      args: [seasonId, session.userId, content],
    });
  }

  revalidatePath("/bacheca");
  revalidatePath("/dashboard");
  return null;
}

// ── deleteMessage ─────────────────────────────────────────────────────
export async function deleteMessage(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const msgId = Number(formData.get("messageId"));
  if (!msgId) return "ID messaggio non valido.";

  const db = getDb();

  try {
    const msgRes = await db.execute({
      sql: `SELECT userId FROM "LeagueMessage" WHERE id = ?`,
      args: [msgId],
    });
    const msg = msgRes.rows[0];
    if (!msg) return "Messaggio non trovato.";
    if ((msg.userId as number) !== session.userId && !session.isAdmin) {
      return "Non autorizzato.";
    }
    await db.execute({ sql: `DELETE FROM "LeagueMessage" WHERE id = ?`, args: [msgId] });
    revalidatePath("/bacheca");
    revalidatePath("/dashboard");
  } catch {
    return "Errore durante l'eliminazione.";
  }
  return null;
}
