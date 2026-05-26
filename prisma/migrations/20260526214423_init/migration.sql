-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "realTeam" TEXT NOT NULL,
    "mantraRole" TEXT NOT NULL,
    "fantapiu3Name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Roster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "purchasePrice" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Roster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Roster_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Season" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "currentMatchday" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Matchday" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "seasonId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "votesImported" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Matchday_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerVote" (
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
    CONSTRAINT "PlayerVote_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayerVote_matchdayId_fkey" FOREIGN KEY ("matchdayId") REFERENCES "Matchday" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lineup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "matchdayId" INTEGER NOT NULL,
    "formation" TEXT NOT NULL DEFAULT '4-4-2',
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "totalScore" REAL,
    CONSTRAINT "Lineup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lineup_matchdayId_fkey" FOREIGN KEY ("matchdayId") REFERENCES "Matchday" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LineupSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lineupId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "isStarter" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "LineupSlot_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LineupSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchdayId" INTEGER NOT NULL,
    "homeUserId" INTEGER NOT NULL,
    "awayUserId" INTEGER NOT NULL,
    "homeScore" REAL,
    "awayScore" REAL,
    "homePoints" INTEGER,
    "awayPoints" INTEGER,
    CONSTRAINT "Match_matchdayId_fkey" FOREIGN KEY ("matchdayId") REFERENCES "Matchday" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_homeUserId_fkey" FOREIGN KEY ("homeUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_awayUserId_fkey" FOREIGN KEY ("awayUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Roster_userId_playerId_key" ON "Roster"("userId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_name_key" ON "Season"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Matchday_seasonId_number_key" ON "Matchday"("seasonId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerVote_playerId_matchdayId_key" ON "PlayerVote"("playerId", "matchdayId");

-- CreateIndex
CREATE UNIQUE INDEX "Lineup_userId_matchdayId_key" ON "Lineup"("userId", "matchdayId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_matchdayId_homeUserId_key" ON "Match"("matchdayId", "homeUserId");
