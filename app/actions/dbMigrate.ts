"use server";

import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

export async function runMigrations() {
  const session = await getSession();
  if (!session?.isAdmin) return { error: "Non autorizzato" };

  const db = getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "Cup" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seasonId INTEGER NOT NULL,
      name TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "CupRound" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cupId INTEGER NOT NULL,
      name TEXT NOT NULL,
      number INTEGER NOT NULL DEFAULT 1
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "CupMatch" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cupRoundId INTEGER NOT NULL,
      homeUserId INTEGER NOT NULL,
      awayUserId INTEGER NOT NULL,
      homeScore REAL,
      awayScore REAL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "Market" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seasonId INTEGER NOT NULL,
      name TEXT NOT NULL,
      isOpen INTEGER DEFAULT 0,
      budget INTEGER DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "MarketOffer" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      marketId INTEGER NOT NULL,
      fromUserId INTEGER NOT NULL,
      toUserId INTEGER,
      playerId INTEGER NOT NULL,
      price INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  return { success: true };
}
