"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

export async function createSeason(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const name = (formData.get("name") as string)?.trim();
  const matchdayCount = parseInt(formData.get("matchdayCount") as string) || 38;

  if (!name) return "Inserisci il nome della stagione.";

  const db = getDb();
  await db.execute(`UPDATE "Season" SET isActive = 0`);

  const seasonResult = await db.execute({
    sql: `INSERT INTO "Season" (name, isActive, currentMatchday) VALUES (?, 1, 1)`,
    args: [name],
  });
  const seasonId = Number(seasonResult.lastInsertRowid);

  for (let i = 1; i <= matchdayCount; i++) {
    await db.execute({
      sql: `INSERT INTO "Matchday" (seasonId, number) VALUES (?, ?)`,
      args: [seasonId, i],
    });
  }

  revalidatePath("/admin/schedule");
  return null;
}

export async function generateCalendar(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const seasonId = parseInt(formData.get("seasonId") as string);
  const db = getDb();

  const seasonRes = await db.execute({ sql: `SELECT id FROM "Season" WHERE id = ?`, args: [seasonId] });
  if (seasonRes.rows.length === 0) return "Stagione non trovata.";

  const matchdaysRes = await db.execute({
    sql: `SELECT id, number FROM "Matchday" WHERE seasonId = ? ORDER BY number ASC`,
    args: [seasonId],
  });
  const matchdays = matchdaysRes.rows;

  const usersRes = await db.execute(`SELECT id FROM "User" WHERE isAdmin = 0`);
  const users = usersRes.rows;
  if (users.length !== 12) return `Servono esattamente 12 partecipanti (trovati: ${users.length}).`;

  const schedule = generateRoundRobin(users.map((u) => u.id as number));

  let matchdayIdx = 0;

  for (const round of schedule) {
    if (matchdayIdx >= matchdays.length) break;
    const md = matchdays[matchdayIdx];
    await db.execute({ sql: `DELETE FROM "Match" WHERE matchdayId = ?`, args: [md.id] });
    for (const [homeId, awayId] of round) {
      await db.execute({
        sql: `INSERT INTO "Match" (matchdayId, homeUserId, awayUserId) VALUES (?, ?, ?)`,
        args: [md.id, homeId, awayId],
      });
    }
    matchdayIdx++;
  }

  for (const round of schedule) {
    if (matchdayIdx >= matchdays.length) break;
    const md = matchdays[matchdayIdx];
    await db.execute({ sql: `DELETE FROM "Match" WHERE matchdayId = ?`, args: [md.id] });
    for (const [homeId, awayId] of round) {
      await db.execute({
        sql: `INSERT INTO "Match" (matchdayId, homeUserId, awayUserId) VALUES (?, ?, ?)`,
        args: [md.id, awayId, homeId],
      });
    }
    matchdayIdx++;
  }

  for (const round of schedule) {
    if (matchdayIdx >= matchdays.length) break;
    const md = matchdays[matchdayIdx];
    await db.execute({ sql: `DELETE FROM "Match" WHERE matchdayId = ?`, args: [md.id] });
    for (const [homeId, awayId] of round) {
      await db.execute({
        sql: `INSERT INTO "Match" (matchdayId, homeUserId, awayUserId) VALUES (?, ?, ?)`,
        args: [md.id, homeId, awayId],
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

  await getDb().execute({
    sql: `UPDATE "Season" SET currentMatchday = ? WHERE id = ?`,
    args: [matchday, seasonId],
  });

  revalidatePath("/admin/schedule");
  revalidatePath("/");
  return null;
}

export async function lockAndAdvanceMatchday(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const seasonId = parseInt(formData.get("seasonId") as string);
  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const nextNumber = parseInt(formData.get("nextNumber") as string);

  const db = getDb();
  await db.execute({ sql: `UPDATE "Matchday" SET isLocked = 1 WHERE id = ?`, args: [matchdayId] });
  await db.execute({ sql: `UPDATE "Season" SET currentMatchday = ? WHERE id = ?`, args: [nextNumber, seasonId] });

  revalidatePath("/admin/votes");
  revalidatePath("/admin/schedule");
  revalidatePath("/dashboard");
  revalidatePath("/lineup");
  revalidatePath("/standings");
  revalidatePath("/calendar");
  return null;
}
