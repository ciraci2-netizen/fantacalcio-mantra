"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

export async function postMessage(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const content = (formData.get("content") as string)?.trim();
  if (!content || content.length < 2) return "Messaggio troppo corto.";
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
    // Table might not exist yet
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "LeagueMessage" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seasonId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
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

export async function deleteMessage(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const msgId = Number(formData.get("messageId"));
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
