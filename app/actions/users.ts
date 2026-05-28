"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

export async function createUser(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const teamName = (formData.get("teamName") as string)?.trim();

  if (!username || !password || !teamName) return "Compila tutti i campi.";

  const db = getDb();
  const countRes = await db.execute(`SELECT COUNT(*) as c FROM "User" WHERE isAdmin = 0`);
  if ((countRes.rows[0].c as number) >= 12) return "Hai già 12 partecipanti.";

  const existing = await db.execute({ sql: `SELECT id FROM "User" WHERE username = ?`, args: [username] });
  if (existing.rows.length > 0) return "Username già in uso.";

  const hashed = await bcrypt.hash(password, 10);
  await db.execute({ sql: `INSERT INTO "User" (username, password, teamName, isAdmin) VALUES (?, ?, ?, 0)`, args: [username, hashed, teamName] });

  revalidatePath("/admin/users");
  return null;
}

export async function updateUserPassword(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const userId = parseInt(formData.get("userId") as string);
  const password = formData.get("password") as string;
  if (!password || password.length < 4) return "Password troppo corta (min 4 caratteri).";

  const hashed = await bcrypt.hash(password, 10);
  await getDb().execute({ sql: `UPDATE "User" SET password = ? WHERE id = ?`, args: [hashed, userId] });

  revalidatePath("/admin/users");
  return "ok";
}

export async function deleteUser(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const userId = parseInt(formData.get("userId") as string);
  const db = getDb();

  // Trova i lineupId dell'utente
  const lineups = await db.execute({ sql: `SELECT id FROM "Lineup" WHERE userId = ?`, args: [userId] });
  for (const l of lineups.rows) {
    await db.execute({ sql: `DELETE FROM "LineupSlot" WHERE lineupId = ?`, args: [l.id] });
  }
  await db.execute({ sql: `DELETE FROM "Lineup" WHERE userId = ?`, args: [userId] });
  await db.execute({ sql: `DELETE FROM "Roster" WHERE userId = ?`, args: [userId] });
  await db.execute({ sql: `DELETE FROM "User" WHERE id = ?`, args: [userId] });

  revalidatePath("/admin/users");
  return null;
}
