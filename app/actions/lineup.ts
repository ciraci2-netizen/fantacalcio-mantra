"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { log } from "@/app/lib/logger";

const DEF_ROLES = new Set(["DC", "TER"]);
const MID_ROLES = new Set(["M", "OFF"]);
const ATT_ROLES = new Set(["ATT"]);

/** Validates that starters satisfy the minimum module requirements */
function validateFormation(
  roles: string[],
  formation: string
): string | null {
  const gkCount  = roles.filter((r) => r === "POR").length;
  const defCount = roles.filter((r) => DEF_ROLES.has(r)).length;
  const attCount = roles.filter((r) => ATT_ROLES.has(r)).length;

  if (gkCount < 1)  return "La formazione deve avere almeno 1 portiere.";
  if (gkCount > 1)  return "La formazione non può avere più di 1 portiere.";
  if (defCount < 3) return "La formazione deve avere almeno 3 difensori.";
  if (attCount < 1) return "La formazione deve avere almeno 1 attaccante.";

  // Cross-check with declared formation (e.g. "4-4-2")
  const parts = formation.split("-").map(Number);
  if (parts.length >= 3 && !parts.some(isNaN)) {
    const [declaredDef, , declaredAtt] = [parts[0], parts.slice(1, -1).reduce((a, b) => a + b, 0), parts[parts.length - 1]];
    if (defCount < declaredDef)
      return `Il modulo ${formation} richiede almeno ${declaredDef} difensori, ne hai ${defCount}.`;
    if (attCount < declaredAtt)
      return `Il modulo ${formation} richiede almeno ${declaredAtt} attaccanti, ne hai ${attCount}.`;
  }

  return null;
}

/**
 * Core save logic, shared by the player-facing action (own lineup only,
 * blocked once the matchday is locked) and the admin override (any team,
 * allowed even when locked — that's the whole point of a manual admin fix).
 */
async function saveLineupCore(opts: {
  targetUserId: number;
  matchdayId: number;
  formation: string;
  starterIds: number[];
  reserveIds: number[];
  enforceLock: boolean;
}): Promise<string> {
  const { targetUserId, matchdayId, formation, starterIds, reserveIds, enforceLock } = opts;

  if (starterIds.length !== 11) return "Devi schierare esattamente 11 titolari.";
  if (new Set(starterIds).size !== 11) return "Hai inserito giocatori duplicati tra i titolari.";

  const db = getDb();

  // Fetch roles for all starters in one query
  const playerIds = [...starterIds, ...reserveIds];
  const playerRes = await db.execute({
    sql: `SELECT id, mantraRole FROM "Player" WHERE id IN (${playerIds.map(() => "?").join(",")})`,
    args: playerIds,
  });
  const roleMap = new Map(playerRes.rows.map((r) => [r.id as number, r.mantraRole as string]));
  const starterRoles = starterIds.map((id) => roleMap.get(id) ?? "");

  const formationError = validateFormation(starterRoles, formation);
  if (formationError) return formationError;

  const rosterRes = await db.execute({
    sql: `SELECT playerId FROM "Roster" WHERE userId = ?`,
    args: [targetUserId],
  });
  const rosterIds = new Set(rosterRes.rows.map((r) => r.playerId as number));
  for (const id of [...starterIds, ...reserveIds]) {
    if (!rosterIds.has(id)) return "Stai schierando un giocatore non nella rosa di questa squadra.";
  }

  if (enforceLock) {
    const matchdayRes = await db.execute({
      sql: `SELECT isLocked FROM "Matchday" WHERE id = ?`,
      args: [matchdayId],
    });
    if (matchdayRes.rows[0]?.isLocked) return "La giornata è bloccata, non puoi modificare la formazione.";
  }

  const existingRes = await db.execute({
    sql: `SELECT id FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
    args: [targetUserId, matchdayId],
  });

  let lineupId: number;
  if (existingRes.rows.length > 0) {
    lineupId = existingRes.rows[0].id as number;
    await db.execute({ sql: `DELETE FROM "LineupSlot" WHERE lineupId = ?`, args: [lineupId] });
    await db.execute({
      sql: `UPDATE "Lineup" SET formation = ?, isSubmitted = 1, isAutomatic = 0 WHERE id = ?`,
      args: [formation, lineupId],
    });
  } else {
    const result = await db.execute({
      sql: `INSERT INTO "Lineup" (userId, matchdayId, formation, isSubmitted) VALUES (?, ?, ?, 1)`,
      args: [targetUserId, matchdayId, formation],
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

  return "ok";
}

function parseSlots(formData: FormData): { starterIds: number[]; reserveIds: number[] } {
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

  return { starterIds, reserveIds };
}

export async function saveLineup(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Non autenticato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const formation = (formData.get("formation") as string) ?? "4-4-2";
  const { starterIds, reserveIds } = parseSlots(formData);

  const outcome = await saveLineupCore({
    targetUserId: session.userId,
    matchdayId,
    formation,
    starterIds,
    reserveIds,
    enforceLock: true,
  });

  if (outcome === "ok") {
    log("lineup_save", { userId: session.userId, matchdayId, formation });
    revalidatePath("/lineup");
  }
  return outcome;
}

// ── Admin: set/edit any team's lineup, even after the deadline ───────────
// Serve per i casi in cui un utente non ha potuto accedere in tempo (niente
// account, problemi di connessione, ecc.) e l'admin deve inserire la
// formazione al posto suo. A differenza di saveLineup, ignora il lock della
// giornata ma mantiene tutte le altre validazioni (11 titolari, modulo,
// giocatori devono appartenere alla rosa della squadra selezionata).
export async function adminSaveLineup(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const targetUserId = parseInt(formData.get("userId") as string);
  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const formation = (formData.get("formation") as string) ?? "4-4-2";
  const { starterIds, reserveIds } = parseSlots(formData);

  if (!targetUserId) return "Seleziona una squadra.";

  const outcome = await saveLineupCore({
    targetUserId,
    matchdayId,
    formation,
    starterIds,
    reserveIds,
    enforceLock: false,
  });

  if (outcome === "ok") {
    log("admin_lineup_save", { adminId: session.userId, targetUserId, matchdayId, formation });
    revalidatePath("/admin/lineup");
    revalidatePath("/admin/votes");
    revalidatePath("/lineup");
  }
  return outcome;
}
