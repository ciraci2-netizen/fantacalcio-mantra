"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { normalizeMantraRole } from "@/app/lib/scoring";

export async function addPlayerToRoster(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const userId = parseInt(formData.get("userId") as string);
  const playerId = parseInt(formData.get("playerId") as string);
  const purchasePrice = parseInt(formData.get("purchasePrice") as string) || 0;

  const db = getDb();

  const countRes = await db.execute({ sql: `SELECT COUNT(*) as c FROM "Roster" WHERE userId = ?`, args: [userId] });
  if ((countRes.rows[0].c as number) >= 26) return "La rosa è già completa (26 giocatori).";

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

  const usersRes = await db.execute(`SELECT id, teamName, username FROM "User" WHERE isAdmin = 0`);
  const userByKey = new Map<string, { id: number; teamName: string }>();
  for (const u of usersRes.rows) {
    userByKey.set((u.teamName as string).toLowerCase().trim(), { id: u.id as number, teamName: u.teamName as string });
    userByKey.set((u.username as string).toLowerCase().trim(), { id: u.id as number, teamName: u.teamName as string });
  }

  const playersRes = await db.execute(`SELECT id, name FROM "Player"`);
  const playerByName = new Map<string, number>();
  for (const p of playersRes.rows) {
    playerByName.set((p.name as string).toLowerCase().trim(), p.id as number);
  }

  const rosterCountRes = await db.execute(`SELECT userId, COUNT(*) as c FROM "Roster" GROUP BY userId`);
  const rosterCount = new Map<number, number>();
  for (const r of rosterCountRes.rows) rosterCount.set(r.userId as number, r.c as number);

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
      created++;
    }

    if (takenPlayers.has(playerId)) { errors.push(`"${giocatoreRaw}" è già in una rosa.`); continue; }

    const currentCount = rosterCount.get(user.id) ?? 0;
    if (currentCount >= 26) { errors.push(`Rosa di "${user.teamName}" già completa (26 giocatori).`); continue; }

    const purchasePrice = parseInt(prezzoRaw) || 0;

    await db.execute({
      sql: `INSERT INTO "Roster" (userId, playerId, purchasePrice) VALUES (?, ?, ?)`,
      args: [user.id, playerId, purchasePrice],
    });
    takenPlayers.add(playerId);
    rosterCount.set(user.id, currentCount + 1);
    imported++;
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/roster");
  revalidatePath("/admin/players");

  const summary = `✅ Importati ${imported} giocatori in rosa${created > 0 ? ` (${created} nuovi giocatori creati)` : ""}.`;
  if (errors.length > 0) return `${summary}\n⚠️ Errori (${errors.length}):\n${errors.slice(0, 10).join("\n")}`;
  return summary;
}
