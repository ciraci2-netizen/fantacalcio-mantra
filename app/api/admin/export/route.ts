import { NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

export const dynamic = "force-dynamic";

/** Admin-only: export all league data as JSON (backup manuale) */
export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const db = getDb();

  const [seasons, users, players, rosters, matchdays, matches, lineups, votes] =
    await Promise.all([
      db.execute(`SELECT * FROM "Season"`),
      db.execute(`SELECT id, username, teamName, credits, logoUrl, isAdmin FROM "User"`),
      db.execute(`SELECT * FROM "Player"`),
      db.execute(`SELECT * FROM "Roster"`),
      db.execute(`SELECT * FROM "Matchday"`),
      db.execute(`SELECT * FROM "Match"`),
      db.execute(`SELECT id, userId, matchdayId, formation, totalScore, goalBonus, substitutions, isAutomatic FROM "Lineup"`),
      db.execute(`SELECT * FROM "PlayerVote"`),
    ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    seasons: seasons.rows,
    users: users.rows,
    players: players.rows,
    rosters: rosters.rows,
    matchdays: matchdays.rows,
    matches: matches.rows,
    lineups: lineups.rows,
    votes: votes.rows,
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ipa-backup-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
