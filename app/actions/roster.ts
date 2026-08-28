"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { normalizeMantraRole } from "@/app/lib/scoring";
import { getRosterLimits } from "@/app/lib/leagueSettings";

export async function addPlayerToRoster(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const userId = parseInt(formData.get("userId") as string);
  const playerId = parseInt(formData.get("playerId") as string);
  const purchasePrice = parseInt(formData.get("purchasePrice") as string) || 0;

  const db = getDb();

  const playerRes = await db.execute({ sql: `SELECT mantraRole FROM "Player" WHERE id = ?`, args: [playerId] });
  const mantraRole = playerRes.rows[0]?.mantraRole as string | undefined;
  if (!mantraRole) return "Giocatore non trovato.";

  const { numPortieri, numMovimento } = await getRosterLimits(db);
  const isPor = mantraRole === "POR";
  const limit = isPor ? numPortieri : numMovimento;

  const countRes = await db.execute({
    sql: isPor
      ? `SELECT COUNT(*) as c FROM "Roster" r JOIN "Player" p ON p.id = r.playerId WHERE r.userId = ? AND p.mantraRole = 'POR'`
      : `SELECT COUNT(*) as c FROM "Roster" r JOIN "Player" p ON p.id = r.playerId WHERE r.userId = ? AND p.mantraRole != 'POR'`,
    args: [userId],
  });
  if ((countRes.rows[0].c as number) >= limit) {
    return isPor
      ? `Slot portieri già al completo (${limit}).`
      : `Slot giocatori di movimento già al completo (${limit}).`;
  }

  const existing = await db.execute({ sql: `SELECT id FROM "Roster" WHERE playerId = ?`, args: [playerId] });
  if (existing.rows.length > 0) return "Questo giocatore è già nella rosa di un altro utente.";

  await db.execute({
    sql: `INSERT INTO "Roster" (userId, playerId, purchasePrice) VALUES (?, ?, ?)`,
    args: [userId, playerId, purchasePrice],
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return null;
}

export async function removePlayerFromRoster(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const rosterId = parseInt(formData.get("rosterId") as string);
  await getDb().execute({ sql: `DELETE FROM "Roster" WHERE id = ?`, args: [rosterId] });
  revalidatePath("/admin/users");
  return null;
}

export async function updatePurchasePrice(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const rosterId = parseInt(formData.get("rosterId") as string);
  const purchasePrice = parseInt(formData.get("purchasePrice") as string) || 0;

  await getDb().execute({
    sql: `UPDATE "Roster" SET purchasePrice = ? WHERE id = ?`,
    args: [purchasePrice, rosterId],
  });
  revalidatePath("/admin/users");
  return null;
}

/**
 * Importa rose complete da CSV (righe già estratte da un file .csv o .xlsx
 * lato client — vedi RosterAdminClient).
 *
 * Colonne attese per riga, separate da "," o ";":
 *   squadra, giocatore, ruolo, squadraReale, prezzo
 *
 * - "squadra" = teamName o username dell'utente (case-insensitive)
 * - "giocatore" = nome giocatore (case-insensitive)
 * - "ruolo" (POR/DC/TER/M/OFF/ATT) e "squadraReale" sono obbligatori solo
 *   se il giocatore non esiste già nel database; altrimenti vengono ignorati
 * - "prezzo" opzionale, default 0
 *
 * La prima riga viene saltata automaticamente se è un'intestazione
 * (non inizia con un nome squadra valido riconoscibile — in pratica se
 * la seconda colonna "giocatore" è vuota o la riga ha meno di 2 campi).
 */
export async function importRosterCSV(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const csv = (formData.get("csv") as string)?.trim();
  if (!csv) return "Nessun dato da importare.";

  const db = getDb();
  const { numPortieri, numMovimento } = await getRosterLimits(db);

  const usersRes = await db.execute(`SELECT id, teamName, username FROM "User" WHERE isAdmin = 0`);
  const userByKey = new Map<string, { id: number; teamName: string }>();
  for (const u of usersRes.rows) {
    userByKey.set((u.teamName as string).toLowerCase().trim(), { id: u.id as number, teamName: u.teamName as string });
    userByKey.set((u.username as string).toLowerCase().trim(), { id: u.id as number, teamName: u.teamName as string });
  }

  const playersRes = await db.execute(`SELECT id, name, mantraRole FROM "Player"`);
  const playerByName = new Map<string, number>();
  const roleById = new Map<number, string>();
  for (const p of playersRes.rows) {
    playerByName.set((p.name as string).toLowerCase().trim(), p.id as number);
    roleById.set(p.id as number, p.mantraRole as string);
  }

  // Conteggi rosa correnti, separati per portieri e movimento
  const rosterCountRes = await db.execute(`
    SELECT r.userId,
           SUM(CASE WHEN p.mantraRole = 'POR' THEN 1 ELSE 0 END) as porCount,
           SUM(CASE WHEN p.mantraRole != 'POR' THEN 1 ELSE 0 END) as movCount
    FROM "Roster" r
    JOIN "Player" p ON p.id = r.playerId
    GROUP BY r.userId
  `);
  const porCount = new Map<number, number>();
  const movCount = new Map<number, number>();
  for (const r of rosterCountRes.rows) {
    porCount.set(r.userId as number, (r.porCount as number) ?? 0);
    movCount.set(r.userId as number, (r.movCount as number) ?? 0);
  }

  const takenRes = await db.execute(`SELECT playerId FROM "Roster"`);
  const takenPlayers = new Set<number>(takenRes.rows.map((r) => r.playerId as number));

  const lines = csv.split("\n").map((l) => l.trim()).filter(Boolean);
  let imported = 0;
  let created = 0;
  const errors: string[] = [];

  for (const line of lines) {
    const sep = line.includes(";") ? ";" : ",";
    const parts = line.split(sep).map((p) => p.trim());
    if (parts.length < 2) continue;

    const [squadraRaw, giocatoreRaw, ruoloRaw, squadraRealeRaw, prezzoRaw] = parts;
    if (!giocatoreRaw) continue; // riga header o vuota

    const userKey = squadraRaw?.toLowerCase();
    const user = userKey ? userByKey.get(userKey) : undefined;
    if (!user) { errors.push(`Squadra non trovata: "${squadraRaw}"`); continue; }

    const playerKey = giocatoreRaw.toLowerCase();
    let playerId = playerByName.get(playerKey);
    let role = playerId ? roleById.get(playerId) : undefined;

    if (!playerId) {
      const squadraReale = squadraRealeRaw?.toUpperCase();
      if (!ruoloRaw || !squadraReale) {
        errors.push(`Giocatore "${giocatoreRaw}" non trovato nel database e mancano ruolo/squadra reale per crearlo.`);
        continue;
      }
      const ruolo = normalizeMantraRole(ruoloRaw);
      if (!ruolo) {
        errors.push(`Ruolo non valido per "${giocatoreRaw}": ${ruoloRaw}`);
        continue;
      }
      const insertRes = await db.execute({
        sql: `INSERT INTO "Player" (name, realTeam, mantraRole) VALUES (?, ?, ?)`,
        args: [giocatoreRaw.toUpperCase(), squadraReale, ruolo],
      });
      playerId = Number(insertRes.lastInsertRowid);
      playerByName.set(playerKey, playerId);
      roleById.set(playerId, ruolo);
      role = ruolo;
      created++;
    }

    if (takenPlayers.has(playerId)) { errors.push(`"${giocatoreRaw}" è già in una rosa.`); continue; }

    const isPor = role === "POR";
    const limit = isPor ? numPortieri : numMovimento;
    const currentCount = (isPor ? porCount.get(user.id) : movCount.get(user.id)) ?? 0;
    if (currentCount >= limit) {
      errors.push(
        `Rosa di "${user.teamName}" già completa per ${isPor ? "portieri" : "giocatori di movimento"} (${limit}).`
      );
      continue;
    }

    const purchasePrice = parseInt(prezzoRaw) || 0;

    await db.execute({
      sql: `INSERT INTO "Roster" (userId, playerId, purchasePrice) VALUES (?, ?, ?)`,
      args: [user.id, playerId, purchasePrice],
    });
    takenPlayers.add(playerId);
    if (isPor) porCount.set(user.id, currentCount + 1);
    else movCount.set(user.id, currentCount + 1);
    imported++;
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/roster");
  revalidatePath("/admin/players");

  const summary = `✅ Importati ${imported} giocatori in rosa${created > 0 ? ` (${created} nuovi giocatori creati)` : ""}.`;
  if (errors.length > 0) return `${summary}\n⚠️ Errori (${errors.length}):\n${errors.slice(0, 10).join("\n")}`;
  return summary;
}
