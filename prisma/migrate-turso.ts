import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";

const client = createClient({
  url: "libsql://fantacalcio-ciraci2-netizen.aws-eu-west-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4MzQzMzEsImlkIjoiMDE5ZTY2NjMtYWQwMS03N2U4LWE2NTQtYmY5ZjI0M2Q5MjdmIiwicmlkIjoiZDkzMmU3Y2EtZGViYy00ODA4LTliYmEtZjBhNzE0MGNiYzNkIn0.Yx15odaMWuNXFyMiV1zxj5P0GqjBh_6I7hrIC2DrRLc-DE3DmKRTTPznJqTRa85sMq_YrPt4lDnac5guvSNOCg",
});

const sql = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "realTeam" TEXT NOT NULL,
    "mantraRole" TEXT NOT NULL,
    "fantapiu3Name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Season" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "currentMatchday" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true
  )`,
  `CREATE TABLE IF NOT EXISTS "Roster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "purchasePrice" INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY ("userId") REFERENCES "User" ("id"),
    FOREIGN KEY ("playerId") REFERENCES "Player" ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "Matchday" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "seasonId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "votesImported" BOOLEAN NOT NULL DEFAULT false,
    FOREIGN KEY ("seasonId") REFERENCES "Season" ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "PlayerVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" INTEGER NOT NULL,
    "matchdayId" INTEGER NOT NULL,
    "vote" REAL,
    "fantavoto" REAL,
    "gfGs" INTEGER NOT NULL DEFAULT 0,
    "gsr" INTEGER NOT NULL DEFAULT 0,
    "amm" INTEGER NOT NULL DEFAULT 0,
    "esp" INTEGER NOT NULL DEFAULT 0,
    "rpRs" INTEGER NOT NULL DEFAULT 0,
    "aut" INTEGER NOT NULL DEFAULT 0,
    "ass" INTEGER NOT NULL DEFAULT 0,
    "adf" INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY ("playerId") REFERENCES "Player" ("id"),
    FOREIGN KEY ("matchdayId") REFERENCES "Matchday" ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "Lineup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "matchdayId" INTEGER NOT NULL,
    "formation" TEXT NOT NULL DEFAULT '4-4-2',
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "totalScore" REAL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id"),
    FOREIGN KEY ("matchdayId") REFERENCES "Matchday" ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "LineupSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lineupId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "isStarter" BOOLEAN NOT NULL DEFAULT true,
    FOREIGN KEY ("lineupId") REFERENCES "Lineup" ("id"),
    FOREIGN KEY ("playerId") REFERENCES "Player" ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchdayId" INTEGER NOT NULL,
    "homeUserId" INTEGER NOT NULL,
    "awayUserId" INTEGER NOT NULL,
    "homeScore" REAL,
    "awayScore" REAL,
    "homePoints" INTEGER,
    "awayPoints" INTEGER,
    FOREIGN KEY ("matchdayId") REFERENCES "Matchday" ("id"),
    FOREIGN KEY ("homeUserId") REFERENCES "User" ("id"),
    FOREIGN KEY ("awayUserId") REFERENCES "User" ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Roster_userId_playerId_key" ON "Roster"("userId", "playerId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Season_name_key" ON "Season"("name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Matchday_seasonId_number_key" ON "Matchday"("seasonId", "number")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PlayerVote_playerId_matchdayId_key" ON "PlayerVote"("playerId", "matchdayId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Lineup_userId_matchdayId_key" ON "Lineup"("userId", "matchdayId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Match_matchdayId_homeUserId_key" ON "Match"("matchdayId", "homeUserId")`,
];

async function main() {
  console.log("Connessione al database Turso...");

  for (const stmt of sql) {
    await client.execute(stmt);
  }
  console.log("✅ Tabelle create!");

  // Crea admin
  const existing = await client.execute(
    `SELECT id FROM "User" WHERE username = 'admin'`
  );
  if (existing.rows.length === 0) {
    const hashed = await bcrypt.hash("admin123", 10);
    await client.execute({
      sql: `INSERT INTO "User" (username, password, teamName, isAdmin) VALUES (?, ?, ?, ?)`,
      args: ["admin", hashed, "Admin", true],
    });
    console.log("✅ Utente admin creato! Username: admin / Password: admin123");
  } else {
    console.log("Admin già esistente.");
  }

  console.log("🎉 Database pronto!");
}

main().catch(console.error).finally(() => client.close());
