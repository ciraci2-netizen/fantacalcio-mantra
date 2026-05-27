import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import AdminCoppeClient from "./AdminCoppeClient";

export default async function AdminCoppePage() {
  const session = await getSession();
  if (!session?.isAdmin) return <div className="text-red-500">Non autorizzato</div>;

  const db = getDb();

  const seasonRes = await db.execute(`SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const season = seasonRes.rows[0] ?? null;

  const cupsRes = season
    ? await db.execute({ sql: `SELECT id, name FROM "Cup" WHERE seasonId = ? ORDER BY id ASC`, args: [season.id] })
    : { rows: [] };

  const cups = await Promise.all(
    cupsRes.rows.map(async (cup) => {
      const roundsRes = await db.execute({ sql: `SELECT id, name, number FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`, args: [cup.id] });
      const rounds = await Promise.all(
        roundsRes.rows.map(async (round) => {
          const matchesRes = await db.execute({
            sql: `SELECT cm.id, cm.homeScore, cm.awayScore, cm.homeUserId, cm.awayUserId,
                         hu.teamName as homeTeam, au.teamName as awayTeam
                  FROM "CupMatch" cm
                  JOIN "User" hu ON hu.id = cm.homeUserId
                  JOIN "User" au ON au.id = cm.awayUserId
                  WHERE cm.cupRoundId = ?`,
            args: [round.id],
          });
          return {
            id: round.id as number,
            name: round.name as string,
            number: round.number as number,
            matches: matchesRes.rows.map((m) => ({
              id: m.id as number,
              homeScore: m.homeScore as number | null,
              awayScore: m.awayScore as number | null,
              homeTeam: m.homeTeam as string,
              awayTeam: m.awayTeam as string,
              homeUserId: m.homeUserId as number,
              awayUserId: m.awayUserId as number,
            })),
          };
        })
      );
      return { id: cup.id as number, name: cup.name as string, rounds };
    })
  );

  const usersRes = await db.execute(`SELECT id, teamName, username FROM "User" WHERE isAdmin = 0 ORDER BY teamName ASC`);
  const users = usersRes.rows.map((u) => ({ id: u.id as number, teamName: u.teamName as string, username: u.username as string }));

  return (
    <AdminCoppeClient
      cups={cups}
      users={users}
      seasonName={season ? (season.name as string) : null}
    />
  );
}
