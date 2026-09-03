import { getDb } from "./db";

let migrated = false;

/**
 * Runs essential schema migrations idempotently.
 * Safe to call on every request - runs only once per server process.
 */
export async function autoMigrate(): Promise<void> {
  if (migrated) return;
  migrated = true;

  const db = getDb();

  const migrations = [
    // Column additions (will fail silently if column already exists)
    `ALTER TABLE "User" ADD COLUMN logoUrl TEXT`,
    `ALTER TABLE "Matchday" ADD COLUMN deadline TEXT`,
    `ALTER TABLE "Matchday" ADD COLUMN votesImported INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Match" ADD COLUMN homePoints INTEGER`,
    `ALTER TABLE "Match" ADD COLUMN awayPoints INTEGER`,
    `ALTER TABLE "Match" ADD COLUMN homeGoals INTEGER`,
    `ALTER TABLE "Match" ADD COLUMN awayGoals INTEGER`,
    `ALTER TABLE "LeagueSettings" ADD COLUMN homeAdvantage REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE "LeagueSettings" ADD COLUMN scoreConversion TEXT`,
    `ALTER TABLE "LeagueSettings" ADD COLUMN numPortieri INTEGER NOT NULL DEFAULT 3`,
    `ALTER TABLE "LeagueSettings" ADD COLUMN numMovimento INTEGER NOT NULL DEFAULT 23`,
    `ALTER TABLE "User" ADD COLUMN isParticipant INTEGER NOT NULL DEFAULT 1`,

    // Table creations (idempotent via IF NOT EXISTS)
    `CREATE TABLE IF NOT EXISTS "LeagueMessage" (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      seasonId  INTEGER NOT NULL,
      userId    INTEGER NOT NULL,
      content   TEXT    NOT NULL,
      createdAt TEXT    NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS "PlayerStatus" (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      playerId    INTEGER NOT NULL,
      matchdayId  INTEGER NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'ok',
      UNIQUE(playerId, matchdayId)
    )`,
    // NB: lo schema di Market/MarketOffer qui sotto deve restare allineato
    // con app/actions/market.ts (Market.name/budget, MarketOffer.playerId/
    // price/note). Una versione precedente di questo file creava queste due
    // tabelle con colonne diverse (copiate per errore dal modello scambi
    // giocatore-per-giocatore di TradeOffer), incompatibili con le action:
    // "Crea mercato" e "Metti in vendita" fallivano sempre con "no such
    // column". Il blocco di riparazione piu sotto sistema anche i database
    // dove queste tabelle erano gia state create con lo schema sbagliato.
    `CREATE TABLE IF NOT EXISTS "Market" (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      seasonId  INTEGER NOT NULL,
      name      TEXT    NOT NULL DEFAULT 'Mercato',
      isOpen    INTEGER NOT NULL DEFAULT 1,
      budget    INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT    NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS "MarketOffer" (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      marketId   INTEGER NOT NULL,
      fromUserId INTEGER NOT NULL,
      toUserId   INTEGER,
      playerId   INTEGER NOT NULL,
      price      INTEGER NOT NULL DEFAULT 0,
      note       TEXT    NOT NULL DEFAULT '',
      status     TEXT    NOT NULL DEFAULT 'pending',
      createdAt  TEXT    NOT NULL DEFAULT (datetime('now'))
    )`,
    // Asta a buste sugli svincolati: in precedenza create solo dal pulsante
    // manuale "Esegui migrazioni" (app/actions/dbMigrate.ts) - se non e mai
    // stato premuto, /admin/asta va in errore perche la tabella non esiste.
    // Portate anche qui cosi si creano da sole al primo caricamento.
    `CREATE TABLE IF NOT EXISTS "AuctionRound" (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      seasonId   INTEGER NOT NULL,
      name       TEXT    NOT NULL DEFAULT 'Asta svincolati',
      startDate  TEXT,
      endDate    TEXT    NOT NULL,
      resolvedAt TEXT,
      createdAt  TEXT    NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS "SealedBid" (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      roundId          INTEGER NOT NULL,
      playerId         INTEGER NOT NULL,
      userId           INTEGER NOT NULL,
      amount           INTEGER NOT NULL,
      releasePlayerId  INTEGER,
      status           TEXT    NOT NULL DEFAULT 'pending',
      createdAt        TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(roundId, playerId, userId)
    )`,
    `CREATE TABLE IF NOT EXISTS "Cup" (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      seasonId INTEGER NOT NULL,
      name     TEXT    NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "CupRound" (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      cupId INTEGER NOT NULL,
      name  TEXT    NOT NULL,
      \`order\` INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS "CupMatch" (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      cupRoundId  INTEGER NOT NULL,
      homeUserId  INTEGER NOT NULL,
      awayUserId  INTEGER NOT NULL,
      homeScore   REAL,
      awayScore   REAL,
      homePoints  INTEGER,
      awayPoints  INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS "LeagueSettings" (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      seasonId INTEGER NOT NULL UNIQUE,
      settings TEXT    NOT NULL DEFAULT '{}'
    )`,
    `CREATE TABLE IF NOT EXISTS "PushSubscription" (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      userId    INTEGER NOT NULL,
      endpoint  TEXT    NOT NULL UNIQUE,
      p256dh    TEXT    NOT NULL,
      auth      TEXT    NOT NULL,
      createdAt TEXT    NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS "TradeOffer" (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      seasonId          INTEGER NOT NULL,
      fromUserId        INTEGER NOT NULL,
      toUserId          INTEGER NOT NULL,
      offeredPlayerId   INTEGER NOT NULL,
      requestedPlayerId INTEGER NOT NULL,
      note              TEXT    NOT NULL DEFAULT '',
      status            TEXT    NOT NULL DEFAULT 'pending',
      createdAt         TEXT    NOT NULL DEFAULT (datetime('now'))
    )`,
  ];

  for (const sql of migrations) {
    try {
      await db.execute(sql);
    } catch {
      // Silently ignore: column already exists or table already exists
    }
  }

  // --- Riparazione Market/MarketOffer con lo schema vecchio/sbagliato ---
  // CREATE TABLE IF NOT EXISTS sopra non tocca una tabella che esiste gia
  // (anche se con le colonne sbagliate), quindi qui sistemiamo i database
  // dove il bug descritto sopra ha gia creato le tabelle nella forma errata.

  // Market: mancano solo colonne "in piu" (name, budget), senza vincoli che
  // impediscano righe esistenti - un semplice ALTER ADD COLUMN basta ed e
  // sicuro anche se le colonne ci sono gia (fallisce e viene ignorato).
  try { await db.execute(`ALTER TABLE "Market" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Mercato'`); } catch { /* gia presente */ }
  try { await db.execute(`ALTER TABLE "Market" ADD COLUMN "budget" INTEGER NOT NULL DEFAULT 0`); } catch { /* gia presente */ }

  // SealedBid.releasePlayerId: colonna aggiunta dopo, stesso discorso del
  // Market qui sopra - solo una colonna in piu, ALTER ADD COLUMN basta.
  try { await db.execute(`ALTER TABLE "SealedBid" ADD COLUMN "releasePlayerId" INTEGER`); } catch { /* gia presente */ }

  // MarketOffer: la versione vecchia ha toUserId/offeredPlayerId/
  // requestedPlayerId NOT NULL senza default, quindi non basta aggiungere le
  // colonne mancanti (playerId/price/note) - le INSERT del codice attuale
  // fallirebbero comunque per quei vincoli. Va ricostruita. Lo facciamo solo
  // se serve davvero (rilevando l'assenza della colonna "playerId"), e senza
  // cancellare eventuali righe: la tabella vecchia viene rinominata invece
  // di essere eliminata (in pratica sara sempre vuota, perche con lo schema
  // sbagliato ogni "Metti in vendita" falliva gia prima di arrivare
  // all'INSERT, ma meglio non fidarsi e conservarla comunque).
  try {
    await db.execute(`SELECT playerId FROM "MarketOffer" LIMIT 1`);
  } catch {
    try { await db.execute(`ALTER TABLE "MarketOffer" RENAME TO "MarketOffer_legacy"`); } catch { /* tabella non esisteva ancora */ }
    try {
      await db.execute(`CREATE TABLE IF NOT EXISTS "MarketOffer" (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        marketId   INTEGER NOT NULL,
        fromUserId INTEGER NOT NULL,
        toUserId   INTEGER,
        playerId   INTEGER NOT NULL,
        price      INTEGER NOT NULL DEFAULT 0,
        note       TEXT    NOT NULL DEFAULT '',
        status     TEXT    NOT NULL DEFAULT 'pending',
        createdAt  TEXT    NOT NULL DEFAULT (datetime('now'))
      )`);
    } catch { /* qualcosa e gia andato storto: non blocchiamo la richiesta */ }
  }
}
