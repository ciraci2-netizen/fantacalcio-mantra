"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { MANTRA_ROLES } from "@/app/lib/scoring";

export async function createPlayer(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const name = (formData.get("name") as string)?.trim().toUpperCase();
  const realTeam = (formData.get("realTeam") as string)?.trim().toUpperCase();
  const mantraRole = formData.get("mantraRole") as string;
  const fantapiu3Name = (formData.get("fantapiu3Name") as string)?.trim().toUpperCase() || null;

  if (!name || !realTeam || !mantraRole) return "Compila tutti i campi obbligatori.";
  if (!MANTRA_ROLES.includes(mantraRole as never)) return "Ruolo non valido.";

  await prisma.player.create({ data: { name, realTeam, mantraRole, fantapiu3Name } });
  revalidatePath("/admin/players");
  return null;
}

export async function updatePlayer(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const id = parseInt(formData.get("id") as string);
  const name = (formData.get("name") as string)?.trim().toUpperCase();
  const realTeam = (formData.get("realTeam") as string)?.trim().toUpperCase();
  const mantraRole = formData.get("mantraRole") as string;
  const fantapiu3Name = (formData.get("fantapiu3Name") as string)?.trim().toUpperCase() || null;

  if (!name || !realTeam || !mantraRole) return "Compila tutti i campi obbligatori.";

  await prisma.player.update({ where: { id }, data: { name, realTeam, mantraRole, fantapiu3Name } });
  revalidatePath("/admin/players");
  return null;
}

export async function deletePlayer(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const id = parseInt(formData.get("id") as string);

  // Rimuovi prima dalle rose e formazioni
  await prisma.lineupSlot.deleteMany({ where: { player: { id } } });
  await prisma.roster.deleteMany({ where: { playerId: id } });
  await prisma.playerVote.deleteMany({ where: { playerId: id } });
  await prisma.player.delete({ where: { id } });

  revalidatePath("/admin/players");
  return null;
}

export async function importPlayersCSV(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const csv = formData.get("csv") as string;
  if (!csv) return "Nessun dato CSV fornito.";

  const lines = csv.split("\n").filter((l) => l.trim());
  let imported = 0;
  const errors: string[] = [];

  for (const line of lines) {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 3) {
      errors.push(`Riga non valida: ${line}`);
      continue;
    }
    const [name, realTeam, mantraRole, fantapiu3Name] = parts;
    if (!MANTRA_ROLES.includes(mantraRole as never)) {
      errors.push(`Ruolo non valido per ${name}: ${mantraRole}`);
      continue;
    }
    try {
      await prisma.player.upsert({
        where: { id: -1 },
        create: {
          name: name.toUpperCase(),
          realTeam: realTeam.toUpperCase(),
          mantraRole,
          fantapiu3Name: fantapiu3Name?.toUpperCase() || null,
        },
        update: {},
      });
      imported++;
    } catch {
      // Se il giocatore esiste già, skip
    }
  }

  revalidatePath("/admin/players");
  if (errors.length > 0) return `Importati ${imported}. Errori: ${errors.join("; ")}`;
  return null;
}
