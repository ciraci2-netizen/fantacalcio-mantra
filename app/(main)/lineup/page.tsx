import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import LineupForm from "./LineupForm";

export default async function LineupPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id, currentMatchday FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nessuna stagione attiva. Attendi che l&apos;admin configuri il campionato.
      </div>
    );
  }

  const matchdayRes = await db.execute({
    sql: `SELECT id, number, isLocked FROM "Matchday" WHERE seasonId = ? AND number = ? LIMIT 1`,
    args: [season.id, season.currentMatchday],
  });
  const matchday = matchdayRes.rows[0] ?? null;

  if (!matchday) {
    return <div className="text-center py-12 text-gray-500">Giornata non trovata.</div>;
  }

  const rosterRes = await db.execute({
    sql: `SELECT p.id, p.name, p.realTeam, p.mantraRole
          FROM "Roster" r
          JOIN "Player" p ON p.id = r.playerId
          WHERE r.userId = ?
          ORDER BY p.mantraRole ASC, p.name ASC`,
    args: [session.userId],
  });

  const existingLineupRes = await db.execute({
    sql: `SELECT id, formation FROM "Lineup" WHERE userId = ? AND matchdayId = ? LIMIT 1`,
    args: [session.userId, matchday.id],
  });
  const existingLineup = existingLineupRes.rows[0] ?? null;

  let existingLineupData = null;
  if (existingLineup) {
    const slotsRes = await db.execute({
      sql: `SELECT playerId, isStarter FROM "LineupSlot" WHERE lineupId = ? ORDER BY isStarter DESC, position ASC`,
      args: [existingLineup.id],
    });
    existingLineupData = {
      formation: existingLineup.formation as string,
      starters: slotsRes.rows
        .filter((s) => Number(s.isStarter) === 1)
        .map((s) => s.playerId as number),
      reserves: slotsRes.rows
        .filter((s) => Number(s.isStarter) === 0)
        .map((s) => s.playerId as number),
    };
  }

  return (
    <LineupForm
      matchdayId={matchday.id as number}
      matchdayNumber={matchday.number as number}
      isLocked={Boolean(matchday.isLocked)}
      roster={rosterRes.rows.map((r) => ({
        id: r.id as number,
        name: r.name as string,
        realTeam: r.realTeam as string,
        mantraRole: r.mantraRole as string,
      }))}
      existingLineup={existingLineupData}
    />
  );
}
