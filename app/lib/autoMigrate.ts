import { getDb } from "./db";

let migrated = false;

/**
 * Runs essential schema migrations idempotently.
 * Safe to call on every request — runs only once per server process.
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
    `CREATE TABLE IF NOT EXISTS "Market" (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      seasonId  INTEGER NOT NULL,
      isOpen    INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT    NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS "MarketOffer" (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      marketId          INTEGER NOT NULL,
      fromUserId        INTEGER NOT NULL,
      toUserId          INTEGER NOT NULL,
      offeredPlayerId   INTEGER NOT NULL,
      requestedPlayerId INTEGER NOT NULL,
      credits           INTEGER NOT NULL DEFAULT 0,
      status            TEXT    NOT NULL DEFAULT 'pending',
      createdAt         TEXT    NOT NULL DEFAULT (datetime('now'))
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
}
