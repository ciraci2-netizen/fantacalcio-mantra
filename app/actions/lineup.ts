"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

export async function saveLineup(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const formation = formData.get("formation") as string;

  const starterIds: number[] = [];
  for (let i = 1; i <= 11; i++) {
    const id = formData.get(`starter_${i}`);
    if (id) starterIds.push(parseInt(id as string));
  }

  const reserveIds: number[] = [];
  for (let i = 1; i <= 11; i++) {
    const id = formData.get(`reserve_${i}`);
    if (id) reserveIds.push(parseInt(id as string));
  }

  if (starterIds.length !== 11) return "Devi schierare esattamente 11 titolari.";
  if (new Set(starterIds).size !== 11) return "Hai inserito giocatori duplicati tra i titolari.";

  const db = getDb();

  const rosterRes = await db.execute({
    sql: `SELECT playerId FROM "Roster" WHERE userId = ?`,
    args: [session.userId],
  });
  const rosterIds = new Set(rosterRes.rows.map((r) => r.playerId as number));

  for (const id of [...starterIds, ...reserveIds]) {
    if (!rosterIds.has(id)) return "Stai schierando un giocatore non nella tua rosa.";
  }

  const matchdayRes = await db.execute({
    sql: `SELECT isLocked FROM "Matchday" WHERE id = ?`,
    args: [matchdayId],
  });
  if (matchdayRes.rows[0]?.isLocked) return "La giornata è bloccata, non puoi modificare la formazione.";

  const existingRes = await db.execute({
    sql: `SELECT id FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
    args: [session.userId, matchdayId],
  });

  let lineupId: number;

  if (existingRes.rows.length > 0) {
    lineupId = existingRes.rows[0].id as number;
    await db.execute({ sql: `DELETE FROM "LineupSlot" WHERE lineupId = ?`, args: [lineupId] });
    await db.execute({
      sql: `UPDATE "Lineup" SET formation = ?, isSubmitted = 1 WHERE id = ?`,
      args: [formation, lineupId],
    });
  } else {
    const result = await db.execute({
      sql: `INSERT INTO "Lineup" (userId, matchdayId, formation, isSubmitted) VALUES (?, ?, ?, 1)`,
      args: [session.userId, matchdayId, formation],
    });
    lineupId = Number(result.lastInsertRowid);
  }

  for (let i = 0; i < starterIds.length; i++) {
    await db.execute({
      sql: `INSERT INTO "LineupSlot" (lineupId, playerId, position, isStarter) VALUES (?, ?, ?, 1)`,
      args: [lineupId, starterIds[i], i + 1],
    });
  }

  for (let i = 0; i < reserveIds.length; i++) {
    await db.execute({
      sql: `INSERT INTO "LineupSlot" (lineupId, playerId, position, isStarter) VALUES (?, ?, ?, 0)`,
      args: [lineupId, reserveIds[i], i + 1],
    });
  }

  revalidatePath("/lineup");
  return "ok";
}
