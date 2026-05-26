"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function createSeason(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const name = (formData.get("name") as string)?.trim();
  const matchdayCount = parseInt(formData.get("matchdayCount") as string) || 38;

  if (!name) return "Inserisci il nome della stagione.";

  // Disattiva stagioni precedenti
  await prisma.season.updateMany({ data: { isActive: false } });

  const season = await prisma.season.create({ data: { name } });

  // Crea le giornate
  for (let i = 1; i <= matchdayCount; i++) {
    await prisma.matchday.create({
      data: { seasonId: season.id, number: i },
    });
  }

  revalidatePath("/admin/schedule");
  return null;
}

export async function generateCalendar(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const seasonId = parseInt(formData.get("seasonId") as string);

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { matchdays: { orderBy: { number: "asc" } } },
  });
  if (!season) return "Stagione non trovata.";

  const users = await prisma.user.findMany({ where: { isAdmin: false } });
  if (users.length !== 12) return `Servono esattamente 12 partecipanti (trovati: ${users.length}).`;

  // Genera calendario round-robin (ogni squadra affronta tutte le altre)
  // Con 12 squadre: 11 giornate per un girone completo
  const matchdays = season.matchdays;

  // Algoritmo round-robin per 12 squadre
  const schedule = generateRoundRobin(users.map((u) => u.id));

  // Ogni round = 6 partite (12/2)
  // Con 38 giornate, facciamo circa 3 giri + resto
  let matchdayIdx = 0;
  for (const round of schedule) {
    if (matchdayIdx >= matchdays.length) break;
    const md = matchdays[matchdayIdx];

    // Elimina partite esistenti per questa giornata
    await prisma.match.deleteMany({ where: { matchdayId: md.id } });

    for (const [homeId, awayId] of round) {
      await prisma.match.create({
        data: { matchdayId: md.id, homeUserId: homeId, awayUserId: awayId },
      });
    }
    matchdayIdx++;
  }

  // Se ci sono più giornate, ripetiamo il calendario con home/away invertiti
  for (const round of schedule) {
    if (matchdayIdx >= matchdays.length) break;
    const md = matchdays[matchdayIdx];

    await prisma.match.deleteMany({ where: { matchdayId: md.id } });

    for (const [homeId, awayId] of round) {
      await prisma.match.create({
        data: { matchdayId: md.id, homeUserId: awayId, awayUserId: homeId },
      });
    }
    matchdayIdx++;
  }

  // Terzo giro se servono altre giornate
  for (const round of schedule) {
    if (matchdayIdx >= matchdays.length) break;
    const md = matchdays[matchdayIdx];

    await prisma.match.deleteMany({ where: { matchdayId: md.id } });

    for (const [homeId, awayId] of round) {
      await prisma.match.create({
        data: { matchdayId: md.id, homeUserId: homeId, awayUserId: awayId },
      });
    }
    matchdayIdx++;
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/calendar");
  return null;
}

function generateRoundRobin(teams: number[]): [number, number][][] {
  const n = teams.length;
  const rounds: [number, number][][] = [];
  const t = [...teams];

  for (let round = 0; round < n - 1; round++) {
    const matches: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      matches.push([t[i], t[n - 1 - i]]);
    }
    rounds.push(matches);
    // Ruota tutti tranne il primo
    const last = t.pop()!;
    t.splice(1, 0, last);
  }

  return rounds;
}

export async function setCurrentMatchday(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const seasonId = parseInt(formData.get("seasonId") as string);
  const matchday = parseInt(formData.get("matchday") as string);

  await prisma.season.update({
    where: { id: seasonId },
    data: { currentMatchday: matchday },
  });

  revalidatePath("/admin/schedule");
  revalidatePath("/");
  return null;
}
