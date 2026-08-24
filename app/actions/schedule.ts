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
  if (users.length !== 10) return `Servono esattamente 10 partecipanti (trovati: ${users.length}).`;

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

export async function setMatchdayDeadline(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const raw = (formData.get("deadline") as string)?.trim();
  const deadline = raw || null; // empty string → null (rimuove scadenza)

  try {
    await getDb().execute({
      sql: `UPDATE "Matchday" SET deadline = ? WHERE id = ?`,
      args: [deadline, matchdayId],
    });
  } catch {
    return "Errore: esegui prima la migrazione DB per aggiungere la colonna deadline.";
  }

  revalidatePath("/admin/votes");
  revalidatePath("/lineup");
  return null;
}

export async function importCalendarCsv(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const seasonId = parseInt(formData.get("seasonId") as string);
  const csv = (formData.get("csv") as string)?.trim();
  if (!csv) return "Incolla il CSV prima di importare.";

  const db = getDb();

  // Load all teams
  const usersRes = await db.execute(`SELECT id, teamName FROM "User" WHERE isAdmin = 0`);
  const teamByName = new Map<string, number>();
  for (const u of usersRes.rows) {
    teamByName.set((u.teamName as string).toLowerCase().trim(), u.id as number);
  }

  // Load matchdays for this season
  const mdsRes = await db.execute({
    sql: `SELECT id, number FROM "Matchday" WHERE seasonId = ? ORDER BY number ASC`,
    args: [seasonId],
  });
  const matchdayById = new Map<number, number>(); // number → id
  for (const md of mdsRes.rows) {
    matchdayById.set(md.number as number, md.id as number);
  }

  // Parse CSV: skip header line if it starts with letters
  const lines = csv.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows: { giornata: number; homeId: number; awayId: number }[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    const sep = line.includes(";") ? ";" : ",";
    const parts = line.split(sep).map((p) => p.trim());
    if (parts.length < 3) continue;
    const giornata = parseInt(parts[0]);
    if (isNaN(giornata)) continue; // header row

    const homeKey = parts[1].toLowerCase();
    const awayKey = parts[2].toLowerCase();
    const homeId = teamByName.get(homeKey);
    const awayId = teamByName.get(awayKey);

    if (!homeId) { errors.push(`Squadra non trovata: "${parts[1]}"`); continue; }
    if (!awayId) { errors.push(`Squadra non trovata: "${parts[2]}"`); continue; }
    if (!matchdayById.has(giornata)) { errors.push(`Giornata ${giornata} non esiste nella stagione.`); continue; }
    rows.push({ giornata, homeId, awayId });
  }

  if (errors.length > 0) return `Errori nel CSV:\n${errors.slice(0, 5).join("\n")}`;
  if (rows.length === 0) return "Nessuna riga valida trovata nel CSV.";

  // Group by matchday and insert
  const byMatchday = new Map<number, typeof rows>();
  for (const row of rows) {
    if (!byMatchday.has(row.giornata)) byMatchday.set(row.giornata, []);
    byMatchday.get(row.giornata)!.push(row);
  }

  for (const [giornata, matches] of byMatchday) {
    const mdId = matchdayById.get(giornata)!;
    await db.execute({ sql: `DELETE FROM "Match" WHERE matchdayId = ?`, args: [mdId] });
    for (const m of matches) {
      await db.execute({
        sql: `INSERT INTO "Match" (matchdayId, homeUserId, awayUserId) VALUES (?, ?, ?)`,
        args: [mdId, m.homeId, m.awayId],
      });
    }
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/calendar");
  return `✅ Importate ${rows.length} partite in ${byMatchday.size} giornate.`;
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
