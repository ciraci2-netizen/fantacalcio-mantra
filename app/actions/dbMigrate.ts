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
  { titolo: "Formazione", contenuto: "Ogni squadra schiera **11 titolari + 7 riserve** (totale 18 giocatori).\n\nModuli validi: **3-4-3 / 3-5-2 / 4-3-3 / 4-4-2 / 4-5-1 / 5-3-2 / 5-4-1**\n\n- 1 Portiere obbligatorio\n- Minimo 3 difensori\n- Minimo 1 attaccante\n- I ruoli Mantra sono: **Por, Dc, Dd, Ds, E, M, C, T, W, A, Pc**", sortOrder: 1 },
  { titolo: "Sostituzioni Automatiche", contenuto: "Se un titolare **non gioca** (sv / non pervenuto), viene automaticamente sostituito dalla prima riserva disponibile con il ruolo compatibile.\n\nLe sostituzioni seguono l'ordine delle riserve indicato nella formazione.\n\nUna sostituzione non avviene se comprometterebbe i requisiti minimi di modulo.", sortOrder: 2 },
  { titolo: "Punteggi Partita", contenuto: "**Vittoria: 3 punti — Pareggio: 1 punto — Sconfitta: 0 punti**\n\nIl punteggio della partita è la somma dei fantavoti dei titolari (con eventuali sostituzioni automatiche).", sortOrder: 3 },
  { titolo: "Rosa", contenuto: "Ogni squadra ha una rosa di **massimo 26 giocatori**.\n\nLe rose vengono costruite tramite asta all'inizio della stagione.\n\nI giocatori possono essere ceduti o acquistati durante i **mercati** stagionali.", sortOrder: 4 },
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

  return { success: true };
}
