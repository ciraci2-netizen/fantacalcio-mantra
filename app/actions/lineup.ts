"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function saveLineup(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const formation = formData.get("formation") as string;

  // Leggi i titolari (11 slot, position 1-11)
  const starterIds: number[] = [];
  for (let i = 1; i <= 11; i++) {
    const id = formData.get(`starter_${i}`);
    if (id) starterIds.push(parseInt(id as string));
  }

  // Leggi le riserve (fino a 7 slot, position 1-7)
  const reserveIds: number[] = [];
  for (let i = 1; i <= 7; i++) {
    const id = formData.get(`reserve_${i}`);
    if (id) reserveIds.push(parseInt(id as string));
  }

  if (starterIds.length !== 11) return "Devi schierare esattamente 11 titolari.";
  if (new Set(starterIds).size !== 11) return "Hai inserito giocatori duplicati tra i titolari.";

  // Verifica che tutti i giocatori siano nella rosa dell'utente
  const roster = await prisma.roster.findMany({
    where: { userId: session.userId },
    select: { playerId: true },
  });
  const rosterIds = new Set(roster.map((r) => r.playerId));

  for (const id of [...starterIds, ...reserveIds]) {
    if (!rosterIds.has(id)) return "Stai schierando un giocatore non nella tua rosa.";
  }

  // Verifica che la giornata non sia bloccata
  const matchday = await prisma.matchday.findUnique({ where: { id: matchdayId } });
  if (matchday?.isLocked) return "La giornata è bloccata, non puoi modificare la formazione.";

  // Crea o aggiorna il lineup
  const existing = await prisma.lineup.findUnique({
    where: { userId_matchdayId: { userId: session.userId, matchdayId } },
  });

  let lineupId: number;

  if (existing) {
    await prisma.lineupSlot.deleteMany({ where: { lineupId: existing.id } });
    await prisma.lineup.update({
      where: { id: existing.id },
      data: { formation, isSubmitted: true },
    });
    lineupId = existing.id;
  } else {
    const lineup = await prisma.lineup.create({
      data: { userId: session.userId, matchdayId, formation, isSubmitted: true },
    });
    lineupId = lineup.id;
  }

  // Crea i slot titolari
  for (let i = 0; i < starterIds.length; i++) {
    await prisma.lineupSlot.create({
      data: { lineupId, playerId: starterIds[i], position: i + 1, isStarter: true },
    });
  }

  // Crea i slot riserve
  for (let i = 0; i < reserveIds.length; i++) {
    await prisma.lineupSlot.create({
      data: { lineupId, playerId: reserveIds[i], position: i + 1, isStarter: false },
    });
  }

  revalidatePath("/lineup");
  return null;
}
