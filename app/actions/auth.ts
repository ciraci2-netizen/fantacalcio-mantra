"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { createSession, deleteSession } from "@/app/lib/session";

export async function login(prevState: string | null, formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) return "Inserisci username e password.";

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return "Credenziali non valide.";

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return "Credenziali non valide.";

  await createSession({
    userId: user.id,
    username: user.username,
    teamName: user.teamName,
    isAdmin: user.isAdmin,
  });

  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
