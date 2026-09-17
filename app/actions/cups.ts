"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { generateRoundRobinSchedule } from "@/app/lib/cupSchedule";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.isAdmin) throw new Error("Non autorizzato");
  return session;
}

// Giornata di campionato e/o data in cui si gioca un turno/girone - solo
// un'etichetta informativa: il punteggio resta sempre inserito a mano,
// niente calcolo automatico dalla formazione di quella giornata.
function readSchedule(formData: FormData) {
  const rawMatchday = (formData.get("matchdayNumber") as string)?.trim();
  const matchdayNumber = rawMatchday ? parseInt(rawMatchday, 10) : null;
  const rawDate = (formData.get("playDate") as string)?.trim();
  const playDate = rawDate || null;
  return {
    matchdayNumber: matchdayNumber && !isNaN(matchdayNumber) ? matchdayNumber : null,
    playDate,
  };
}

export async function createCup(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const name = formData.get("name") as string;
    const seasonRes = await db.execute(`SELECT id FROM "Season" WHERE isActive = 1 LIMIT 1`);
    const season = seasonRes.rows[0];
    if (!season) return { error: "Nessuna stagione attiva" };
    await db.execute({ sql: `INSERT INTO "Cup" (seasonId, name) VALUES (?, ?)`, args: [season.id, name] });
    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function createCupRound(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const cupId = Number(formData.get("cupId"));
    const name = formData.get("name") as string;
    const { matchdayNumber, playDate } = readSchedule(formData);
    const countRes = await db.execute({ sql: `SELECT COUNT(*) as n FROM "CupRound" WHERE cupId = ?`, args: [cupId] });
    const number = (Number(countRes.rows[0].n) + 1);
    try {
      await db.execute({
        sql: `INSERT INTO "CupRound" (cupId, name, number, matchdayNumber, playDate) VALUES (?, ?, ?, ?, ?)`,
        args: [cupId, name, number, matchdayNumber, playDate],
      });
    } catch {
      // Colonne matchdayNumber/playDate non ancora migrate: crea comunque
      // il turno senza schedulazione, non deve bloccare l'uso base.
      await db.execute({ sql: `INSERT INTO "CupRound" (cupId, name, number) VALUES (?, ?, ?)`, args: [cupId, name, number] });
    }
    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Crea un girone (fase a gruppi): un turno di tipo 'girone' con dentro
// gia' tutte le partite di andata unica fra le squadre scelte (round-robin
// completo - ogni squadra gioca contro tutte le altre una volta sola).
export async function createCupGroup(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const cupId = Number(formData.get("cupId"));
    const name = (formData.get("name") as string)?.trim();
    if (!name) return { error: "Inserisci il nome del girone." };

    const userIds = [
      ...new Set(
        formData
          .getAll("userIds")
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n > 0)
      ),
    ];
    if (userIds.length < 3) return { error: "Seleziona almeno 3 squadre per il girone." };

    const { matchdayNumber, playDate } = readSchedule(formData);
    const countRes = await db.execute({ sql: `SELECT COUNT(*) as n FROM "CupRound" WHERE cupId = ?`, args: [cupId] });
    const number = Number(countRes.rows[0].n) + 1;

    let cupRoundId: number;
    try {
      const roundRes = await db.execute({
        sql: `INSERT INTO "CupRound" (cupId, name, number, type, matchdayNumber, playDate) VALUES (?, ?, ?, 'girone', ?, ?)`,
        args: [cupId, name, number, matchdayNumber, playDate],
      });
      cupRoundId = Number(roundRes.lastInsertRowid);
    } catch {
      return {
        error:
          'Devi prima eseguire la migrazione del database: vai su Admin e premi "Esegui migrazione DB", poi riprova a creare il girone.',
      };
    }

    // Calendario all'italiana: ogni squadra incontra tutte le altre una
    // volta sola, raggruppate per turno interno del girone (roundSlot) con
    // una squadra a riposo a turno se le squadre sono dispari.
    const schedule = generateRoundRobinSchedule(userIds);
    for (const m of schedule) {
      try {
        await db.execute({
          sql: `INSERT INTO "CupMatch" (cupRoundId, homeUserId, awayUserId, roundSlot) VALUES (?, ?, ?, ?)`,
          args: [cupRoundId, m.homeUserId, m.awayUserId, m.roundSlot],
        });
      } catch {
        // Colonna roundSlot non ancora migrata: crea comunque la partita,
        // solo senza raggruppamento per turno (rifai la migrazione DB e
        // ricrea il girone per averlo).
        await db.execute({
          sql: `INSERT INTO "CupMatch" (cupRoundId, homeUserId, awayUserId) VALUES (?, ?, ?)`,
          args: [cupRoundId, m.homeUserId, m.awayUserId],
        });
      }
    }

    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Aggiorna la giornata di campionato e/o la data di un turno/girone gia'
// creato - solo etichetta informativa, non cambia come si inserisce il
// punteggio.
export async function setCupRoundSchedule(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const cupRoundId = Number(formData.get("cupRoundId"));
    const { matchdayNumber, playDate } = readSchedule(formData);
    try {
      await db.execute({
        sql: `UPDATE "CupRound" SET matchdayNumber = ?, playDate = ? WHERE id = ?`,
        args: [matchdayNumber, playDate, cupRoundId],
      });
    } catch {
      return {
        error:
          'Devi prima eseguire la migrazione del database: vai su Admin e premi "Esegui migrazione DB", poi riprova.',
      };
    }
    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Elimina un intero turno/girone (e le sue partite) - utile per correggere
// un girone creato con le squadre sbagliate senza dover cancellare tutta
// la coppa.
export async function deleteCupRound(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const cupRoundId = Number(formData.get("cupRoundId"));
    await db.execute({ sql: `DELETE FROM "CupMatch" WHERE cupRoundId = ?`, args: [cupRoundId] });
    await db.execute({ sql: `DELETE FROM "CupRound" WHERE id = ?`, args: [cupRoundId] });
    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function createCupMatch(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const cupRoundId = Number(formData.get("cupRoundId"));
    const homeUserId = Number(formData.get("homeUserId"));
    const awayUserId = Number(formData.get("awayUserId"));
    await db.execute({
      sql: `INSERT INTO "CupMatch" (cupRoundId, homeUserId, awayUserId) VALUES (?, ?, ?)`,
      args: [cupRoundId, homeUserId, awayUserId],
    });
    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function setCupMatchScore(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const matchId = Number(formData.get("matchId"));
    const homeScore = parseFloat(formData.get("homeScore") as string);
    const awayScore = parseFloat(formData.get("awayScore") as string);
    await db.execute({
      sql: `UPDATE "CupMatch" SET homeScore = ?, awayScore = ? WHERE id = ?`,
      args: [homeScore, awayScore, matchId],
    });
    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteCup(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const cupId = Number(formData.get("cupId"));
    const rounds = await db.execute({ sql: `SELECT id FROM "CupRound" WHERE cupId = ?`, args: [cupId] });
    for (const r of rounds.rows) {
      await db.execute({ sql: `DELETE FROM "CupMatch" WHERE cupRoundId = ?`, args: [r.id] });
    }
    await db.execute({ sql: `DELETE FROM "CupRound" WHERE cupId = ?`, args: [cupId] });
    await db.execute({ sql: `DELETE FROM "Cup" WHERE id = ?`, args: [cupId] });
    revalidatePath("/coppe");
    revalidatePath("/admin/coppe");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
