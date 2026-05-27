import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { getDb } from "@/app/lib/db";
import VotesAdminClient from "./VotesAdminClient";

export default async function AdminVotesPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id, name, currentMatchday FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nessuna stagione attiva. Crea prima una stagione.
      </div>
    );
  }

  const matchdaysRes = await db.execute({
    sql: `SELECT id, number, votesImported, isLocked FROM "Matchday" WHERE seasonId = ? ORDER BY number ASC`,
    args: [season.id],
  });

  const currentMd = matchdaysRes.rows.find(
    (m) => m.number === season.currentMatchday
  ) ?? null;

  // Lineup submission status for the current matchday
  const usersRes = await db.execute(`SELECT id, teamName FROM "User" WHERE isAdmin = 0 ORDER BY teamName ASC`);
  let lineupSubmissions: { userId: number; teamName: string; submitted: boolean; score: number | null }[] = [];

  if (currentMd) {
    try {
      const lineupsRes = await db.execute({
        sql: `SELECT userId, totalScore, isAutomatic, substitutions FROM "Lineup" WHERE matchdayId = ? AND isSubmitted = 1`,
        args: [currentMd.id],
      });
      const lineupMap = new Map(
        lineupsRes.rows.map((l) => [l.userId as number, {
          score: l.totalScore as number | null,
          isAutomatic: Boolean(l.isAutomatic),
          substitutions: (l.substitutions as number) ?? 0,
        }])
      );
      lineupSubmissions = usersRes.rows.map((u) => ({
        userId: u.id as number,
        teamName: u.teamName as string,
        submitted: lineupMap.has(u.id as number),
        score: lineupMap.get(u.id as number)?.score ?? null,
        isAutomatic: lineupMap.get(u.id as number)?.isAutomatic ?? false,
        substitutions: lineupMap.get(u.id as number)?.substitutions ?? 0,
      }));
    } catch {
      // isAutomatic/substitutions columns not yet migrated — fallback
      const lineupsRes = await db.execute({
        sql: `SELECT userId, totalScore FROM "Lineup" WHERE matchdayId = ? AND isSubmitted = 1`,
        args: [currentMd.id],
      });
      const lineupMap = new Map(
        lineupsRes.rows.map((l) => [l.userId as number, { score: l.totalScore as number | null }])
      );
      lineupSubmissions = usersRes.rows.map((u) => ({
        userId: u.id as number,
        teamName: u.teamName as string,
        submitted: lineupMap.has(u.id as number),
        score: lineupMap.get(u.id as number)?.score ?? null,
        isAutomatic: false,
        substitutions: 0,
      }));
    }
  }

  // Giocatori con stato per la giornata corrente — PlayerStatus potrebbe non esistere
  let playerStatuses: { playerId: number; playerName: string; status: string }[] = [];
  if (currentMd) {
    try {
      const statusRes = await db.execute({
        sql: `SELECT ps.playerId, p.name as playerName, ps.status
              FROM "PlayerStatus" ps
              JOIN "Player" p ON p.id = ps.playerId
              WHERE ps.matchdayId = ?`,
        args: [currentMd.id],
      });
      playerStatuses = statusRes.rows.map((r) => ({
        playerId: r.playerId as number,
        playerName: r.playerName as string,
        status: r.status as string,
      }));
    } catch { /* tabella non ancora creata */ }
  }

  // Tutti i giocatori (per poter segnare disponibilità)
  const allPlayersRes = await db.execute(
    `SELECT id, name, realTeam, mantraRole FROM "Player" ORDER BY mantraRole ASC, name ASC`
  );

  return (
    <VotesAdminClient
      seasonId={season.id as number}
      seasonName={season.name as string}
      currentMatchday={season.currentMatchday as number}
      currentMatchdayId={currentMd ? (currentMd.id as number) : null}
      currentMatchdayTotal={matchdaysRes.rows.length}
      matchdays={matchdaysRes.rows.map((m) => ({
        id: m.id as number,
        number: m.number as number,
        votesImported: Boolean(m.votesImported),
        isLocked: Boolean(m.isLocked),
      }))}
      lineupSubmissions={lineupSubmissions}
      playerStatuses={playerStatuses}
      allPlayers={allPlayersRes.rows.map((p) => ({
        id: p.id as number,
        name: p.name as string,
        realTeam: p.realTeam as string,
        mantraRole: p.mantraRole as string,
      }))}
    />
  );
}
