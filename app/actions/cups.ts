"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { generateRoundRobinSchedule } from "@/app/lib/cupSchedule";
import { calculateDefenseModifier } from "@/app/lib/scoring";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.isAdmin) throw new Error("Non autorizzato");
  return session;
}

// Giornata di campionato e/o data in cui si gioca un turno/girone - solo
// un'etichetta informativa: il punteggio resta modificabile a mano in
// qualsiasi momento (vedi setCupMatchScore), e puo' anche essere calcolato
// in automatico a partire da questa giornata (vedi calculateCupMatchScore).
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

// Giornata di campionato e/o data per un singolo turno interno (Turno 1, 2,
// ...) di un girone - impostata a mano dall'admin, indipendente per ogni
// turno interno. Solo un'etichetta informativa, come le altre.
export async function setSlotSchedule(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const cupRoundId = Number(formData.get("cupRoundId"));
    const slot = Number(formData.get("slot"));
    const { matchdayNumber, playDate } = readSchedule(formData);
    try {
      await db.execute({
        sql: `INSERT INTO "CupRoundSlot" (cupRoundId, slot, matchdayNumber, playDate) VALUES (?, ?, ?, ?)
              ON CONFLICT(cupRoundId, slot) DO UPDATE SET matchdayNumber = excluded.matchdayNumber, playDate = excluded.playDate`,
        args: [cupRoundId, slot, matchdayNumber, playDate],
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

// Calcola in automatico il risultato di una partita di coppa a partire dal
// fantavoto che le due squadre hanno gia' fatto in quella giornata di
// campionato (stessa formazione e voti gia' calcolati come al solito -
// serve che la giornata sia gia stata importata/calcolata) - con lo stesso
// modificatore difensivo del campionato se e' attivo, ma SENZA bonus
// fattore campo: in coppa nessuna delle due squadre e' "di casa". La
// giornata da usare e' quella del turno interno del girone (CupRoundSlot),
// o in mancanza quella dell'intero turno/girone (CupRound.matchdayNumber)
// per i turni a eliminazione diretta. Il risultato calcolato resta comunque
// modificabile a mano dopo con setCupMatchScore, se serve correggerlo.
export async function calculateCupMatchScore(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const matchId = Number(formData.get("matchId"));

    const matchRes = await db.execute({
      sql: `SELECT cm.cupRoundId, cm.roundSlot, cm.homeUserId, cm.awayUserId, cr.cupId
            FROM "CupMatch" cm JOIN "CupRound" cr ON cr.id = cm.cupRoundId
            WHERE cm.id = ?`,
      args: [matchId],
    });
    if (matchRes.rows.length === 0) return { error: "Partita non trovata." };
    const row = matchRes.rows[0];
    const cupRoundId = row.cupRoundId as number;
    const roundSlot = row.roundSlot as number | null;
    const homeUserId = row.homeUserId as number;
    const awayUserId = row.awayUserId as number;
    const cupId = row.cupId as number;

    // Giornata da usare: prima prova quella del singolo turno interno
    // (girone), altrimenti quella dell'intero turno (eliminazione diretta).
    let matchdayNumber: number | null = null;
    if (roundSlot !== null) {
      try {
        const slotRes = await db.execute({
          sql: `SELECT matchdayNumber FROM "CupRoundSlot" WHERE cupRoundId = ? AND slot = ?`,
          args: [cupRoundId, roundSlot],
        });
        matchdayNumber = (slotRes.rows[0]?.matchdayNumber as number | null | undefined) ?? null;
      } catch { /* tabella non ancora migrata: prova comunque il turno intero sotto */ }
    }
    if (matchdayNumber === null) {
      try {
        const roundRes = await db.execute({ sql: `SELECT matchdayNumber FROM "CupRound" WHERE id = ?`, args: [cupRoundId] });
        matchdayNumber = (roundRes.rows[0]?.matchdayNumber as number | null | undefined) ?? null;
      } catch { /* colonna non ancora migrata */ }
    }
    if (matchdayNumber === null) {
      return { error: "Imposta prima la giornata di campionato (sotto il turno, o sull'intero turno/girone), poi riprova." };
    }

    const cupRes = await db.execute({ sql: `SELECT seasonId FROM "Cup" WHERE id = ?`, args: [cupId] });
    if (cupRes.rows.length === 0) return { error: "Coppa non trovata." };
    const seasonId = cupRes.rows[0].seasonId as number;

    const mdRes = await db.execute({
      sql: `SELECT id FROM "Matchday" WHERE number = ? AND seasonId = ?`,
      args: [matchdayNumber, seasonId],
    });
    if (mdRes.rows.length === 0) return { error: `Non trovo la Giornata ${matchdayNumber} in questa stagione.` };
    const matchdayId = mdRes.rows[0].id as number;

    const homeLineupRes = await db.execute({
      sql: `SELECT id, totalScore FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
      args: [homeUserId, matchdayId],
    });
    const awayLineupRes = await db.execute({
      sql: `SELECT id, totalScore FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
      args: [awayUserId, matchdayId],
    });
    const homeTotal = homeLineupRes.rows[0]?.totalScore as number | null | undefined;
    const awayTotal = awayLineupRes.rows[0]?.totalScore as number | null | undefined;

    if (homeTotal === null || homeTotal === undefined || awayTotal === null || awayTotal === undefined) {
      return {
        error: `Non risultano voti calcolati per la Giornata ${matchdayNumber}: importa i voti e calcola quella giornata come al solito, poi riprova.`,
      };
    }

    let defenseModifierEnabled = false;
    try {
      const settingsRes = await db.execute({
        sql: `SELECT defenseModifierEnabled FROM "LeagueSettings" WHERE seasonId = ?`,
        args: [seasonId],
      });
      if (settingsRes.rows.length > 0) defenseModifierEnabled = Boolean(settingsRes.rows[0].defenseModifierEnabled);
    } catch { /* colonna non ancora migrata */ }

    let homeDefenseMalus = 0;
    let awayDefenseMalus = 0;
    if (defenseModifierEnabled) {
      const starterVotes = async (lineupId: number) => {
        const slotsRes = await db.execute({
          sql: `SELECT ls.position, p.mantraRole, pv.vote
                FROM "LineupSlot" ls
                JOIN "Player" p ON p.id = ls.playerId
                LEFT JOIN "PlayerVote" pv ON pv.playerId = ls.playerId AND pv.matchdayId = ?
                WHERE ls.lineupId = ? AND ls.isStarter = 1
                ORDER BY ls.position ASC`,
          args: [matchdayId, lineupId],
        });
        return slotsRes.rows.map((s) => ({ mantraRole: s.mantraRole as string, vote: s.vote as number | null }));
      };
      const homeStarters = await starterVotes(homeLineupRes.rows[0].id as number);
      const awayStarters = await starterVotes(awayLineupRes.rows[0].id as number);
      homeDefenseMalus = calculateDefenseModifier(homeStarters).malus;
      awayDefenseMalus = calculateDefenseModifier(awayStarters).malus;
    }

    // Nessun fattore campo: in coppa non c'e' una squadra "di casa".
    const homeScore = Math.round((homeTotal + awayDefenseMalus) * 100) / 100;
    const awayScore = Math.round((awayTotal + homeDefenseMalus) * 100) / 100;

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
