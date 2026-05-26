"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function addPlayerToRoster(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const userId = parseInt(formData.get("userId") as string);
  const playerId = parseInt(formData.get("playerId") as string);
  const purchasePrice = parseInt(formData.get("purchasePrice") as string) || 0;

  // Controlla max 26 giocatori per squadra
  const count = await prisma.roster.count({ where: { userId } });
  if (count >= 26) return "La rosa è già completa (26 giocatori).";

  // Controlla che il giocatore non sia già in un'altra rosa
  const existing = await prisma.roster.findFirst({ where: { playerId } });
  if (existing) return "Questo giocatore è già nella rosa di un altro utente.";

  await prisma.roster.create({ data: { userId, playerId, purchasePrice } });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return null;
}

export async function removePlayerFromRoster(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const rosterId = parseInt(formData.get("rosterId") as string);
  await prisma.roster.delete({ where: { id: rosterId } });
  revalidatePath("/admin/users");
  return null;
}

export async function updatePurchasePrice(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const rosterId = parseInt(formData.get("rosterId") as string);
  const purchasePrice = parseInt(formData.get("purchasePrice") as string) || 0;

  await prisma.roster.update({ where: { id: rosterId }, data: { purchasePrice } });
  revalidatePath("/admin/users");
  return null;
}
