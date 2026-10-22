import type { Client } from "@libsql/client/http";

/**
 * Formazioni d'ufficio per chi non ha consegnato.
 *
 * Regola: a chi non ha inviato la formazione per una giornata viene
 * riproposta la sua ultima formazione della stagione (quella della giornata
 * precedente in cui ne aveva una). La formazione resta marcata come
 * automatica (isAutomatic = 1): e' cosi che l'app segnala, nel tabellino e
 * nello storico, che la formazione NON e' stata consegnata.
 *
 * Se nel frattempo un titolare non e' piu in rosa (ceduto/svincolato), al suo
 * posto entra la prima riserva della vecchia formazione con lo stesso ruolo.
 * Solo se non c'e' nessuna formazione precedente utilizzabile (es. prima
 * giornata) si ripiega sulla vecchia formazione generata in 4-4-2.
 *
 * Va chiamata PRIMA di bloccare la giornata, da qualunque punto la blocchi
 * (cron a scadenza, cron del sabato, blocco manuale dall'admin).
 */
export async function fillMissingLineups(
  db: Client,
  matchdayId: number
): Promise<{ copied: number[]; generated: number[]; skipped: number[] }> {
  const result = { copied: [] as number[], generated: [] as number[], skipped: [] as number[] };

  const mdRes = await db.execute({
    sql: `SELECT number, seasonId FROM "Matchday" WHERE id = ?`,
    args: [matchdayId],
  });
  if (mdRes.rows.length === 0) return result;
  const matchdayNumber = mdRes.rows[0].number as number;
  const seasonId = mdRes.rows[0].seasonId as number;

  const usersRes = await db.execute(`SELECT id FROM "User" WHERE isParticipant = 1`);

  for (const u of usersRes.rows) {
    const userId = u.id as number;

    const existing = await db.execute({
      sql: `SELECT id FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
      args: [userId, matchdayId],
    });
    if (existing.rows.length > 0) continue;

    const rosterRes = await db.execute({
      sql: `SELECT p.id, p.mantraRole FROM "Roster" r
            JOIN "Player" p ON p.id = r.playerId
            WHERE r.userId = ?`,
      args: [userId],
    });
    const roleById = new Map<number, string>(
      rosterRes.rows.map((r) => [r.id as number, r.mantraRole as string])
    );

    const copy = await buildFromPreviousLineup(db, userId, seasonId, matchdayNumber, roleById);
    if (copy) {
      await insertLineup(db, userId, matchdayId, copy.formation, copy.starters, copy.reserves);
      result.copied.push(userId);
      continue;
    }

    const generated = await generateDefaultLineup(db, userId, matchdayId);
    if (generated) {
      await insertLineup(db, userId, matchdayId, "4-4-2", generated.starters, generated.reserves);
      result.generated.push(userId);
    } else {
      result.skipped.push(userId);
    }
  }

  return result;
}

async function buildFromPreviousLineup(
  db: Client,
  userId: number,
  seasonId: number,
  matchdayNumber: number,
  roleById: Map<number, string>
): Promise<{ formation: string; starters: number[]; reserves: number[] } | null> {
  const prevRes = await db.execute({
    sql: `SELECT l.id, l.formation FROM "Lineup" l
          JOIN "Matchday" md ON md.id = l.matchdayId
          WHERE l.userId = ? AND md.seasonId = ? AND md.number < ?
          ORDER BY md.number DESC
          LIMIT 1`,
    args: [userId, seasonId, matchdayNumber],
  });
  if (prevRes.rows.length === 0) return null;
  const prevId = prevRes.rows[0].id as number;
  const formation = prevRes.rows[0].formation as string;

  const slotsRes = await db.execute({
    sql: `SELECT playerId, isStarter FROM "LineupSlot" WHERE lineupId = ?
          ORDER BY isStarter DESC, position ASC`,
    args: [prevId],
  });
  const prevStarters = slotsRes.rows.filter((r) => Number(r.isStarter) === 1).map((r) => r.playerId as number);
  // Riserve della vecchia formazione ancora in rosa, nell'ordine scelto
  const reservePool = slotsRes.rows
    .filter((r) => Number(r.isStarter) !== 1)
    .map((r) => r.playerId as number)
    .filter((id) => roleById.has(id));

  if (prevStarters.length !== 11) return null;

  // Ruolo del titolare uscito: lo prendiamo dal giocatore (anche se non e'
  // piu in rosa), cosi la riserva che lo sostituisce ha lo stesso ruolo.
  const missing = prevStarters.filter((id) => !roleById.has(id));
  let missingRoles = new Map<number, string>();
  if (missing.length > 0) {
    const rolesRes = await db.execute({
      sql: `SELECT id, mantraRole FROM "Player" WHERE id IN (${missing.map(() => "?").join(",")})`,
      args: missing,
    });
    missingRoles = new Map(rolesRes.rows.map((r) => [r.id as number, r.mantraRole as string]));
  }

  const starters: number[] = [];
  for (const id of prevStarters) {
    if (roleById.has(id)) {
      starters.push(id);
      continue;
    }
    const role = missingRoles.get(id);
    const idx = reservePool.findIndex((r) => roleById.get(r) === role);
    if (idx === -1) return null; // nessun sostituto nello stesso ruolo
    starters.push(reservePool[idx]);
    reservePool.splice(idx, 1);
  }

  return { formation, starters, reserves: reservePool };
}

/** Vecchio comportamento: 4-4-2 coi giocatori della rosa, usato solo senza formazioni precedenti. */
async function generateDefaultLineup(
  db: Client,
  userId: number,
  matchdayId: number
): Promise<{ starters: number[]; reserves: number[] } | null> {
  const rosterRes = await db.execute({
    sql: `SELECT p.id, p.mantraRole,
                 COALESCE(pv.fantavoto, 0) as fv,
                 pv.fantavoto as hasFv
          FROM "Roster" r
          JOIN "Player" p ON p.id = r.playerId
          LEFT JOIN "PlayerVote" pv ON pv.playerId = p.id AND pv.matchdayId = ?
          WHERE r.userId = ?
          ORDER BY COALESCE(pv.fantavoto, 0) DESC`,
    args: [matchdayId, userId],
  });
  if (rosterRes.rows.length < 11) return null;

  type RP = { id: number; mantraRole: string; fv: number; hasFv: boolean };
  const roster: RP[] = rosterRes.rows.map((r) => ({
    id: r.id as number,
    mantraRole: r.mantraRole as string,
    fv: r.fv as number,
    hasFv: r.hasFv !== null,
  }));

  const byVote = (a: RP, b: RP) => (b.hasFv ? 1 : 0) - (a.hasFv ? 1 : 0) || b.fv - a.fv;
  const pick = (pool: RP[], roles: string[], n: number) =>
    pool.filter((p) => roles.includes(p.mantraRole)).sort(byVote).slice(0, n);

  const gk = pick(roster, ["POR"], 1);
  const def = pick(roster.filter((p) => !gk.includes(p)), ["DC", "TER"], 4);
  const mid = pick(roster.filter((p) => !gk.includes(p) && !def.includes(p)), ["M", "OFF"], 4);
  const att = pick(
    roster.filter((p) => !gk.includes(p) && !def.includes(p) && !mid.includes(p)),
    ["ATT"],
    2
  );

  const starters = [...gk, ...def, ...mid, ...att];
  if (starters.length < 11) return null;

  const used = new Set(starters.map((p) => p.id));
  const reserves = roster.filter((p) => !used.has(p.id)).sort(byVote).slice(0, 11);

  return { starters: starters.map((p) => p.id), reserves: reserves.map((p) => p.id) };
}

async function insertLineup(
  db: Client,
  userId: number,
  matchdayId: number,
  formation: string,
  starters: number[],
  reserves: number[]
) {
  const res = await db.execute({
    sql: `INSERT INTO "Lineup" (userId, matchdayId, formation, isSubmitted, isAutomatic)
          VALUES (?, ?, ?, 1, 1)`,
    args: [userId, matchdayId, formation],
  });
  const lineupId = Number(res.lastInsertRowid);

  for (let i = 0; i < starters.length; i++) {
    await db.execute({
      sql: `INSERT INTO "LineupSlot" (lineupId, playerId, position, isStarter) VALUES (?, ?, ?, 1)`,
      args: [lineupId, starters[i], i + 1],
    });
  }
  for (let i = 0; i < reserves.length; i++) {
    await db.execute({
      sql: `INSERT INTO "LineupSlot" (lineupId, playerId, position, isStarter) VALUES (?, ?, ?, 0)`,
      args: [lineupId, reserves[i], i + 1],
    });
  }
}
