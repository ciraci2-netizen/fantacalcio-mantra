"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function createUser(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const teamName = (formData.get("teamName") as string)?.trim();

  if (!username || !password || !teamName) return "Compila tutti i campi.";

  const count = await prisma.user.count({ where: { isAdmin: false } });
  if (count >= 12) return "Hai già 12 partecipanti.";

  const existing = await prisma.user.findFirst({ where: { username } });
  if (existing) return "Username già in uso.";

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { username, password: hashed, teamName } });

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
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  revalidatePath("/admin/users");
  return null;
}

export async function deleteUser(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const userId = parseInt(formData.get("userId") as string);

  await prisma.lineupSlot.deleteMany({ where: { lineup: { userId } } });
  await prisma.lineup.deleteMany({ where: { userId } });
  await prisma.roster.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });

  revalidatePath("/admin/users");
  return null;
}
