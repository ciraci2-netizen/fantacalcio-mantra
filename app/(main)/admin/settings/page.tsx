import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";
import { DEFAULT_GOAL_THRESHOLDS, DEFAULT_SCORE_CONVERSION } from "@/app/lib/scoring";
import { DEFAULT_PORTIERI, DEFAULT_MOVIMENTO } from "@/app/lib/leagueSettings";

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/dashboard");

  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;

  // LeagueSettings may not exist yet (migration not run) — fail-safe
  let settings = {
    initialCredits: 500,
    maxSubstitutions: 3,
    goalThresholds: DEFAULT_GOAL_THRESHOLDS,
    homeAdvantage: 0,
    scoreConversion: DEFAULT_SCORE_CONVERSION,
    numPortieri: DEFAULT_PORTIERI,
    numMovimento: DEFAULT_MOVIMENTO,
  };
  if (season) {
    try {
      const settingsRes = await db.execute({
        sql: `SELECT initialCredits, maxSubstitutions, goalThresholds, homeAdvantage, scoreConversion, numPortieri, numMovimento FROM "LeagueSettings" WHERE seasonId = ?`,
        args: [season.id],
      });
      const raw = settingsRes.rows[0];
      if (raw) {
        settings = {
          initialCredits: (raw.initialCredits as number) ?? 500,
          maxSubstitutions: (raw.maxSubstitutions as number) ?? 3,
          homeAdvantage: (raw.homeAdvantage as number) ?? 0,
          numPortieri: (raw.numPortieri as number) ?? DEFAULT_PORTIERI,
          numMovimento: (raw.numMovimento as number) ?? DEFAULT_MOVIMENTO,
          goalThresholds: raw.goalThresholds
            ? (() => { try { return JSON.parse(raw.goalThresholds as string); } catch { return DEFAULT_GOAL_THRESHOLDS; } })()
            : DEFAULT_GOAL_THRESHOLDS,
          scoreConversion: raw.scoreConversion
            ? (() => { try { return JSON.parse(raw.scoreConversion as string); } catch { return DEFAULT_SCORE_CONVERSION; } })()
            : DEFAULT_SCORE_CONVERSION,
        };
      }
    } catch { /* tabella non ancora creata */ }
  }

  // credits column may not exist yet — fail-safe
  let users: { id: number; teamName: string; username: string; credits: number; spent: number; rosterCount: number }[] = [];
  try {
    const usersRes = await db.execute(
      `SELECT u.id, u.teamName, u.username, u.credits,
              COALESCE(SUM(r.purchasePrice), 0) as spent,
              COUNT(r.id) as rosterCount
       FROM "User" u
       LEFT JOIN "Roster" r ON r.userId = u.id
       WHERE u.isAdmin = 0
       GROUP BY u.id
       ORDER BY u.teamName ASC`
    );
    users = usersRes.rows.map((r) => ({
      id: r.id as number,
      teamName: r.teamName as string,
      username: r.username as string,
      credits: (r.credits as number) ?? 500,
      spent: r.spent as number,
      rosterCount: r.rosterCount as number,
    }));
  } catch {
    // credits column not yet migrated — load users without it
    const usersRes = await db.execute(
      `SELECT u.id, u.teamName, u.username,
              COALESCE(SUM(r.purchasePrice), 0) as spent,
              COUNT(r.id) as rosterCount
       FROM "User" u
       LEFT JOIN "Roster" r ON r.userId = u.id
       WHERE u.isAdmin = 0
       GROUP BY u.id
       ORDER BY u.teamName ASC`
    );
    users = usersRes.rows.map((r) => ({
      id: r.id as number,
      teamName: r.teamName as string,
      username: r.username as string,
      credits: 500,
      spent: r.spent as number,
      rosterCount: r.rosterCount as number,
    }));
  }

  return (
    <SettingsClient
      seasonId={season?.id as number ?? null}
      seasonName={season?.name as string ?? null}
      settings={settings}
      users={users}
    />
  );
}
