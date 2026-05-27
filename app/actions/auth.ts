"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getDb } from "@/app/lib/db";
import { createSession, deleteSession, getSession } from "@/app/lib/session";

export async function login(prevState: string | null, formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) return "Inserisci username e password.";

  const result = await getDb().execute({
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

export async function changePassword(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword) return "Compila tutti i campi.";
  if (newPassword !== confirmPassword) return "Le nuove password non coincidono.";
  if (newPassword.length < 6) return "La password deve essere almeno 6 caratteri.";

  const userRes = await getDb().execute({
    sql: `SELECT password FROM "User" WHERE id = ?`,
    args: [session.userId],
  });
  const hash = userRes.rows[0]?.password as string;
  const valid = await bcrypt.compare(currentPassword, hash);
  if (!valid) return "La password attuale non è corretta.";

  const newHash = await bcrypt.hash(newPassword, 10);
  await getDb().execute({
    sql: `UPDATE "User" SET password = ? WHERE id = ?`,
    args: [newHash, session.userId],
  });

  return "success";
}
