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

  const usersRes = await db.execute(`SELECT id FROM "User" WHERE isParticipant = 1`);
  const users = usersRes.rows;
  if (users.length !== 10) return `Servono esattamente 10 partecipanti (trovati: ${users.length}).`;

  const teamIds = users.map((u) => u.id as number);
  const schedule = generateRoundRobin(teamIds);

  // Chi-gioca-chi ad ogni turno viene preso ciclicamente dallo schedule
  // (9 turni), ripetuto quante volte serve per coprire tutte le giornate
  // della stagione. Il lato casa/trasferta invece NON segue piu' un cambio
  // fisso ogni 9 giornate (quello produceva squadre con 9 partite in casa
  // di fila e poi 9 in trasferta di fila): viene deciso giornata per
  // giornata da un algoritmo goloso che tiene traccia, per ogni squadra,
  // dell'ultimo lato giocato e di quante volte di fila - evitando piu' di
  // 2 partite consecutive dello stesso lato e bilanciando nel tempo il
  // totale casa/trasferta.
  //
  // Le giornate che hanno gia un risultato inserito (homeScore valorizzato
  // su almeno una partita) vengono SALTATE: si lascia il turno cosi com'e,
  // niente DELETE/INSERT - pero' il loro risultato reale viene comunque
  // usato per aggiornare lo stato "ultimo lato/streak" di ogni squadra,
  // cosi l'alternanza resta coerente anche subito dopo una giornata gia
  // giocata. Cosi il bottone si puo premere in sicurezza anche a stagione
  // iniziata, per rigenerare/bilanciare solo le giornate ancora da giocare,
  // senza rischiare di cancellare risultati gia giocati.
  type TeamState = { lastSide: "home" | "away" | null; streak: number; homeCount: number; awayCount: number };
  const state = new Map<number, TeamState>();
  for (const id of teamIds) state.set(id, { lastSide: null, streak: 0, homeCount: 0, awayCount: 0 });

  function recordSide(teamId: number, side: "home" | "away") {
    const s = state.get(teamId);
    if (!s) return;
    s.streak = s.lastSide === side ? s.streak + 1 : 1;
    s.lastSide = side;
    if (side === "home") s.homeCount += 1;
    else s.awayCount += 1;
  }

  function chooseSides(p: number, q: number): [number, number] {
    const sp = state.get(p)!;
    const sq = state.get(q)!;
    const pCanHome = !(sp.lastSide === "home" && sp.streak >= 2);
    const pCanAway = !(sp.lastSide === "away" && sp.streak >= 2);
    const qCanHome = !(sq.lastSide === "home" && sq.streak >= 2);
    const qCanAway = !(sq.lastSide === "away" && sq.streak >= 2);

    const optionA = pCanHome && qCanAway; // p in casa, q in trasferta
    const optionB = qCanHome && pCanAway; // q in casa, p in trasferta

    let home: number, away: number;
    if (optionA && optionB) {
      // entrambe valide: da' la casa a chi ne ha fatte meno finora
      if (sp.homeCount <= sq.homeCount) { home = p; away = q; } else { home = q; away = p; }
    } else if (optionA) {
      home = p; away = q;
    } else if (optionB) {
      home = q; away = p;
    } else {
      // nessuna delle due rispetta il limite (caso raro): meglio del male,
      // da' comunque la casa a chi ha giocato meno in casa finora
      if (sp.homeCount <= sq.homeCount) { home = p; away = q; } else { home = q; away = p; }
    }

    recordSide(home, "home");
    recordSide(away, "away");
    return [home, away];
  }

  let updated = 0;
  let skipped = 0;

  for (let idx = 0; idx < matchdays.length; idx++) {
    const md = matchdays[idx];
    const round = schedule[idx % schedule.length];

    const playedRes = await db.execute({
      sql: `SELECT homeUserId, awayUserId FROM "Match" WHERE matchdayId = ? AND homeScore IS NOT NULL`,
      args: [md.id],
    });

    if (playedRes.rows.length > 0) {
      for (const r of playedRes.rows) {
        recordSide(r.homeUserId as number, "home");
        recordSide(r.awayUserId as number, "away");
      }
      skipped++;
      continue;
    }

    await db.execute({ sql: `DELETE FROM "Match" WHERE matchdayId = ?`, args: [md.id] });
    for (const [p, q] of round) {
      const [h, a] = chooseSides(p, q);
      await db.execute({
        sql: `INSERT INTO "Match" (matchdayId, homeUserId, awayUserId) VALUES (?, ?, ?)`,
        args: [md.id, h, a],
      });
    }
    updated++;
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/calendar");
  if (skipped > 0) {
    return `OK: generate/aggiornate ${updated} giornate. ${skipped} gia con un risultato inserito sono state lasciate intatte.`;
  }
  return `OK: generate/aggiornate ${updated} giornate.`;
}

export async function repeatCalendarFromFirstLeg(prevState: string | null, formData: FormData) {
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
  if (matchdays.length < 9) return "Servono almeno 9 giornate per usare questa funzione.";

  // Legge le partite delle prime 9 giornate (chi gioca chi, chi e' in casa)
  // cosi' come sono state inserite (a mano, da CSV, o dalla generazione
  // automatica) - devono gia' esistere prima di usare questo bottone.
  const firstNine: { homeUserId: number; awayUserId: number }[][] = [];
  for (let i = 0; i < 9; i++) {
    const md = matchdays[i];
    const res = await db.execute({
      sql: `SELECT homeUserId, awayUserId FROM "Match" WHERE matchdayId = ?`,
      args: [md.id],
    });
    if (res.rows.length === 0) {
      return `Manca il calendario della giornata ${md.number}: inseriscilo prima (a mano, da CSV o con la generazione automatica) e riprova.`;
    }
    firstNine.push(
      res.rows.map((r) => ({ homeUserId: r.homeUserId as number, awayUserId: r.awayUserId as number }))
    );
  }

  // Ripete le prime 9 giornate per tutte quelle successive, ciclicamente,
  // invertendo ogni volta casa/trasferta rispetto alle prime 9. Le giornate
  // che hanno gia' un risultato inserito vengono lasciate intatte.
  let updated = 0;
  let skipped = 0;
  for (let idx = 9; idx < matchdays.length; idx++) {
    const md = matchdays[idx];
    const roundInCycle = idx % 9;

    const playedRes = await db.execute({
      sql: `SELECT 1 FROM "Match" WHERE matchdayId = ? AND homeScore IS NOT NULL LIMIT 1`,
      args: [md.id],
    });
    if (playedRes.rows.length > 0) {
      skipped++;
      continue;
    }

    await db.execute({ sql: `DELETE FROM "Match" WHERE matchdayId = ?`, args: [md.id] });
    for (const m of firstNine[roundInCycle]) {
      await db.execute({
        sql: `INSERT INTO "Match" (matchdayId, homeUserId, awayUserId) VALUES (?, ?, ?)`,
        args: [md.id, m.awayUserId, m.homeUserId],
      });
    }
    updated++;
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/calendar");
  if (skipped > 0) {
    return `OK: ripetute/aggiornate ${updated} giornate a campi invertiti rispetto alle prime 9. ${skipped} gia con un risultato inserito sono state lasciate intatte.`;
  }
  return `OK: ripetute/aggiornate ${updated} giornate a campi invertiti rispetto alle prime 9.`;
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
  const usersRes = await db.execute(`SELECT id, teamName FROM "User" WHERE isParticipant = 1`);
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
