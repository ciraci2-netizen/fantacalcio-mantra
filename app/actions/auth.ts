"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/app/lib/db";
import { createSession, deleteSession } from "@/app/lib/session";

export async function login(prevState: string | null, formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) return "Inserisci username e password.";

  const result = await db.execute({
    sql: `SELECT id, username, password, teamName, isAdmin FROM "User" WHERE username = ?`,
    args: [username],
  });

  const row = result.rows[0];
  if (!row) return "Credenziali non valide.";

  const valid = await bcrypt.compare(password, row.password as string);
  if (!valid) return "Credenziali non valide.";

  await createSession({
    userId: row.id as number,
    username: row.username as string,
    teamName: row.teamName as string,
    isAdmin: Boolean(row.isAdmin),
  });

  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
