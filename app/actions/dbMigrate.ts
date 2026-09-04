"use server";

import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

const DEFAULT_BONUS_MALUS = [
  { evento: "Gol segnato", portiere: "+10", difensore: "+6", centrocampista: "+5", attaccante: "+3", sortOrder: 1 },
  { evento: "Gol segnato su rigore", portiere: "+10", difensore: "+6", centrocampista: "+5", attaccante: "+3", sortOrder: 2 },
  { evento: "Assist", portiere: "+1", difensore: "+1", centrocampista: "+1", attaccante: "+1", sortOrder: 3 },
  { evento: "Rigore parato", portiere: "+3", difensore: "—", centrocampista: "—", attaccante: "—", sortOrder: 4 },
  { evento: "Rigore sbagliato", portiere: "-3", difensore: "-3", centrocampista: "-3", attaccante: "-3", sortOrder: 5 },
  { evento: "Autogol", portiere: "-2", difensore: "-2", centrocampista: "-2", attaccante: "-2", sortOrder: 6 },
  { evento: "Ammonizione", portiere: "-0.5", difensore: "-0.5", centrocampista: "-0.5", attaccante: "-0.5", sortOrder: 7 },
  { evento: "Espulsione diretta", portiere: "-1", difensore: "-1", centrocampista: "-1", attaccante: "-1", sortOrder: 8 },
  { evento: "Gol subiti (portiere)", portiere: "-1 a gol", difensore: "—", centrocampista: "—", attaccante: "—", sortOrder: 9 },
  { evento: "Porta inviolata (portiere)", portiere: "+1", difensore: "—", centrocampista: "—", attaccante: "—", sortOrder: 10 },
];

const DEFAULT_SECTIONS = [
  { titolo: "Formazione", contenuto: "Ogni squadra schiera **11 titolari + 11 riserve** (totale 22 giocatori).\n\nModuli validi: **3-4-3 / 3-5-2 / 4-3-3 / 4-4-2 / 4-5-1 / 5-3-2 / 5-4-1**\n\n- 1 Portiere obbligatorio\n- Minimo 3 difensori\n- Minimo 1 attaccante\n- I ruoli Mantra sono: **POR, DC, TER, M, OFF, ATT**", sortOrder: 1 },
  { titolo: "Sostituzioni Automatiche", contenuto: "Se un titolare **non gioca** (sv / non pervenuto), viene automaticamente sostituito dalla prima riserva disponibile con il ruolo compatibile.\n\nLe sostituzioni seguono l'ordine delle riserve indicato nella formazione.\n\nUna sostituzione non avviene se comprometterebbe i requisiti minimi di modulo.", sortOrder: 2 },
  { titolo: "Punteggi Partita", contenuto: "**Vittoria: 3 punti — Pareggio: 1 punto — Sconfitta: 0 punti**\n\nIl punteggio della partita è la somma dei fantavoti dei titolari (con eventuali sostituzioni automatiche).", sortOrder: 3 },
  { titolo: "Rosa", contenuto: "Ogni squadra ha una rosa composta da due tipi di slot, impostabili dall'admin: **portieri** (min 3 - max 8) e **giocatori di movimento** (min 21 - max 26).\n\nLe rose vengono costruite tramite asta all'inizio della stagione.\n\nI giocatori possono essere ceduti o acquistati durante i **mercati** stagionali.", sortOrder: 4 },
];

export async function runMigrations() {
  const session = await getSession();
  if (!session?.isAdmin) return { error: "Non autorizzato" };

  const db = getDb();

  await db.execute(`CREATE TABLE IF NOT EXISTS "Cup" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seasonId INTEGER NOT NULL,
    name TEXT NOT NULL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS "CupRound" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cupId INTEGER NOT NULL,
    name TEXT NOT NULL,
    number INTEGER NOT NULL DEFAULT 1
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS "CupMatch" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cupRoundId INTEGER NOT NULL,
    homeUserId INTEGER NOT NULL,
    awayUserId INTEGER NOT NULL,
    homeScore REAL,
    awayScore REAL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS "Market" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seasonId INTEGER NOT NULL,
    name TEXT NOT NULL,
    isOpen INTEGER DEFAULT 0,
    budget INTEGER DEFAULT 0
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS "MarketOffer" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marketId INTEGER NOT NULL,
    fromUserId INTEGER NOT NULL,
    toUserId INTEGER,
    playerId INTEGER NOT NULL,
    price INTEGER DEFAULT 0,
    note TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    createdAt TEXT DEFAULT (datetime('now'))
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS "BonusMalusRule" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento TEXT NOT NULL,
    portiere TEXT DEFAULT '—',
    difensore TEXT DEFAULT '—',
    centrocampista TEXT DEFAULT '—',
    attaccante TEXT DEFAULT '—',
    sortOrder INTEGER DEFAULT 0
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS "RegolamentoSection" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titolo TEXT NOT NULL,
    contenuto TEXT NOT NULL,
    sortOrder INTEGER DEFAULT 0
  )`);

  const existing = await db.execute(`SELECT COUNT(*) as n FROM "BonusMalusRule"`);
  if (Number(existing.rows[0].n) === 0) {
    for (const row of DEFAULT_BONUS_MALUS) {
      await db.execute({
        sql: `INSERT INTO "BonusMalusRule" (evento, portiere, difensore, centrocampista, attaccante, sortOrder) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [row.evento, row.portiere, row.difensore, row.centrocampista, row.attaccante, row.sortOrder],
      });
    }
  }

  const existingSections = await db.execute(`SELECT COUNT(*) as n FROM "RegolamentoSection"`);
  if (Number(existingSections.rows[0].n) === 0) {
    for (const s of DEFAULT_SECTIONS) {
      await db.execute({
        sql: `INSERT INTO "RegolamentoSection" (titolo, contenuto, sortOrder) VALUES (?, ?, ?)`,
        args: [s.titolo, s.contenuto, s.sortOrder],
      });
    }
  }

  // === Nuove tabelle e colonne (batch 2) ===

  // Colonna credits su User (SQLite ignora se già esiste tramite try/catch)
  try {
    await db.execute(`ALTER TABLE "User" ADD COLUMN "credits" INTEGER NOT NULL DEFAULT 500`);
  } catch { /* colonna già presente */ }

  // Colonne su Lineup per auto-lineup, goalBonus, sostituzioni
  try { await db.execute(`ALTER TABLE "Lineup" ADD COLUMN "isAutomatic" INTEGER NOT NULL DEFAULT 0`); } catch { /* già presente */ }
  try { await db.execute(`ALTER TABLE "Lineup" ADD COLUMN "goalBonus" REAL`); } catch { /* già presente */ }
  try { await db.execute(`ALTER TABLE "Lineup" ADD COLUMN "substitutions" INTEGER NOT NULL DEFAULT 0`); } catch { /* già presente */ }

  // Tabella PlayerStatus
  await db.execute(`CREATE TABLE IF NOT EXISTS "PlayerStatus" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playerId INTEGER NOT NULL,
    matchdayId INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'ok',
    FOREIGN KEY (playerId) REFERENCES "Player"(id),
    FOREIGN KEY (matchdayId) REFERENCES "Matchday"(id),
    UNIQUE(playerId, matchdayId)
  )`);

  // Colonna logoUrl su User
  try { await db.execute(`ALTER TABLE "User" ADD COLUMN "logoUrl" TEXT`); } catch { /* già presente */ }

  // Tabella LeagueSettings (una riga per stagione)
  await db.execute(`CREATE TABLE IF NOT EXISTS "LeagueSettings" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seasonId INTEGER NOT NULL UNIQUE,
    initialCredits INTEGER NOT NULL DEFAULT 500,
    maxSubstitutions INTEGER NOT NULL DEFAULT 3,
    goalThresholds TEXT NOT NULL DEFAULT '[{"m":0,"b":-6},{"m":1,"b":-4},{"m":2,"b":-2},{"m":3,"b":0},{"m":4,"b":3},{"m":5,"b":5},{"m":6,"b":9}]',
    FOREIGN KEY (seasonId) REFERENCES "Season"(id)
  )`);

  // Colonna deadline su Matchday (ISO datetime string, es. "2025-11-15T10:30")
  try { await db.execute(`ALTER TABLE "Matchday" ADD COLUMN "deadline" TEXT`); } catch { /* già presente */ }

  // Fattore campo
  try { await db.execute(`ALTER TABLE "LeagueSettings" ADD COLUMN "homeAdvantage" REAL NOT NULL DEFAULT 0`); } catch { /* già presente */ }

  // Conversione punteggio → gol
  try { await db.execute(`ALTER TABLE "LeagueSettings" ADD COLUMN "scoreConversion" TEXT`); } catch { /* già presente */ }

  // Slot rosa configurabili: portieri (3-8) e giocatori di movimento (21-26)
  try { await db.execute(`ALTER TABLE "LeagueSettings" ADD COLUMN "numPortieri" INTEGER NOT NULL DEFAULT 3`); } catch { /* già presente */ }
  try { await db.execute(`ALTER TABLE "LeagueSettings" ADD COLUMN "numMovimento" INTEGER NOT NULL DEFAULT 23`); } catch { /* già presente */ }

  // Gol per partita (colonne su Match)
  try { await db.execute(`ALTER TABLE "Match" ADD COLUMN "homeGoals" INTEGER`); } catch { /* già presente */ }
  try { await db.execute(`ALTER TABLE "Match" ADD COLUMN "awayGoals" INTEGER`); } catch { /* già presente */ }

  // isParticipant: distingue "squadra reale in gara" da isAdmin (permesso).
  // Permette a un account di essere ALLO STESSO TEMPO admin e presidente di
  // una squadra. Default true per tutti; false solo per l'account admin
  // "tecnico" originale (username 'admin', senza squadra reale).
  try { await db.execute(`ALTER TABLE "User" ADD COLUMN "isParticipant" INTEGER NOT NULL DEFAULT 1`); } catch { /* già presente */ }
  try {
    await db.execute(`UPDATE "User" SET isParticipant = 0 WHERE username = 'admin'`);
  } catch { /* colonna non ancora presente al primo giro, riprovare eseguendo di nuovo */ }

  // === Asta a buste sugli svincolati ===
  // Un round alla volta per stagione: l'admin imposta inizio/fine, ogni
  // partecipante fa un'offerta segreta per giocatore (invisibile agli altri
  // finché il round non si chiude), alla chiusura vince l'offerta più alta
  // (a parità, la più vecchia — cioè chi ha offerto per primo).
  await db.execute(`CREATE TABLE IF NOT EXISTS "AuctionRound" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seasonId INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'Asta svincolati',
    startDate TEXT,
    endDate TEXT NOT NULL,
    resolvedAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (seasonId) REFERENCES "Season"(id)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS "SealedBid" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roundId INTEGER NOT NULL,
    playerId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (roundId) REFERENCES "AuctionRound"(id),
    FOREIGN KEY (playerId) REFERENCES "Player"(id),
    FOREIGN KEY (userId) REFERENCES "User"(id),
    UNIQUE(roundId, playerId, userId)
  )`);

  // Motivo esatto per cui un giocatore che aveva ricevuto offerte e' rimasto
  // svincolato dopo la chiusura di un round (vedi resolveRound in
  // app/lib/auction.ts) - senza questo, passato il momento della chiusura
  // non c'era piu modo di distinguere "fondi insufficienti" da "slot rosa
  // pieni" per un round gia risolto.
  await db.execute(`CREATE TABLE IF NOT EXISTS "AuctionUnsold" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roundId INTEGER NOT NULL,
    playerId INTEGER NOT NULL,
    reason TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (roundId) REFERENCES "AuctionRound"(id),
    FOREIGN KEY (playerId) REFERENCES "Player"(id)
  )`);

  // === Modificatore difensivo (portiere + 3 migliori difensori titolari) ===
  // Interruttore per stagione, in LeagueSettings.
  try { await db.execute(`ALTER TABLE "LeagueSettings" ADD COLUMN "defenseModifierEnabled" INTEGER NOT NULL DEFAULT 0`); } catch { /* già presente */ }

  // Dettaglio applicato per partita (media difesa + malus inflitto
  // all'avversario da ciascuna delle due squadre), per trasparenza nel
  // tabellino. NULL quando il modificatore non è attivo o non è scattato.
  try { await db.execute(`ALTER TABLE "Match" ADD COLUMN "homeDefenseAvg" REAL`); } catch { /* già presente */ }
  try { await db.execute(`ALTER TABLE "Match" ADD COLUMN "homeDefenseMalus" REAL`); } catch { /* già presente */ }
  try { await db.execute(`ALTER TABLE "Match" ADD COLUMN "awayDefenseAvg" REAL`); } catch { /* già presente */ }
  try { await db.execute(`ALTER TABLE "Match" ADD COLUMN "awayDefenseMalus" REAL`); } catch { /* già presente */ }

  // Distacco minimo (fantapunti) per considerare una partita vinta invece di
  // pareggiata: 0 = disabilitato (vince chi ha il punteggio piu alto, anche
  // di poco, come oggi).
  try { await db.execute(`ALTER TABLE "LeagueSettings" ADD COLUMN "minWinMargin" REAL NOT NULL DEFAULT 0`); } catch { /* gia presente */ }

  // Svincolo contestuale all'offerta nell'asta a buste: se lo slot di ruolo
  // e pieno, l'utente puo indicare gia in fase di offerta quale proprio
  // giocatore svincolare per fare posto. Lo svincolo scatta da solo, e solo
  // se l'offerta vince (vedi resolveRound in app/lib/auction.ts).
  try { await db.execute(`ALTER TABLE "SealedBid" ADD COLUMN "releasePlayerId" INTEGER`); } catch { /* gia presente */ }

  return { success: true };
}

// Vecchio ruolo Mantra → nuovo ruolo semplificato
const ROLE_MIGRATION_MAP: Record<string, string> = {
  Por: "POR",
  Dc: "DC",
  Dd: "TER",
  Ds: "TER",
  M: "M",
  C: "OFF",
  T: "OFF",
  W: "OFF",
  E: "OFF",
  A: "ATT",
  Pc: "ATT",
};

const NEW_ROLES = new Set(["POR", "DC", "TER", "M", "OFF", "ATT"]);

/** Converte i ruoli dei giocatori dal vecchio formato Mantra (Por/Dc/Dd/Ds/…) al nuovo (POR/DC/TER/M/OFF/ATT). Sicuro da eseguire più volte. */
export async function migratePlayerRoles() {
  const session = await getSession();
  if (!session?.isAdmin) return { error: "Non autorizzato" };

  const db = getDb();
  const res = await db.execute(`SELECT id, name, mantraRole FROM "Player"`);

  let updated = 0;
  let skipped = 0;
  const unknown: string[] = [];

  for (const row of res.rows) {
    const id = row.id as number;
    const name = row.name as string;
    const oldRole = row.mantraRole as string;

    if (NEW_ROLES.has(oldRole)) { skipped++; continue; }

    const newRole = ROLE_MIGRATION_MAP[oldRole];
    if (!newRole) { unknown.push(`${name} ("${oldRole}")`); continue; }

    await db.execute({ sql: `UPDATE "Player" SET mantraRole = ? WHERE id = ?`, args: [newRole, id] });
    updated++;
  }

  return { success: true, updated, skipped, unknown };
}
