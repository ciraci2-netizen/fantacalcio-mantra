import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";
import { DEFAULT_GOAL_THRESHOLDS } from "@/app/lib/scoring";

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/dashboard");

  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;

  const settingsRes = season
    ? await db.execute({
        sql: `SELECT initialCredits, maxSubstitutions, goalThresholds FROM "LeagueSettings" WHERE seasonId = ?`,
        args: [season.id],
      })
    : null;

  const raw = settingsRes?.rows[0];
  const settings = {
    initialCredits: (raw?.initialCredits as number) ?? 500,
    maxSubstitutions: (raw?.maxSubstitutions as number) ?? 3,
    goalThresholds: raw?.goalThresholds
      ? (() => { try { return JSON.parse(raw.goalThresholds as string); } catch { return DEFAULT_GOAL_THRESHOLDS; } })()
      : DEFAULT_GOAL_THRESHOLDS,
  };

  // Utenti con crediti e spesa rosa
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

  const users = usersRes.rows.map((r) => ({
    id: r.id as number,
    teamName: r.teamName as string,
    username: r.username as string,
    credits: r.credits as number,
    spent: r.spent as number,
    rosterCount: r.rosterCount as number,
  }));

  return (
    <SettingsClient
      seasonId={season?.id as number ?? null}
      seasonName={season?.name as string ?? null}
      settings={settings}
      users={users}
    />
  );
}
