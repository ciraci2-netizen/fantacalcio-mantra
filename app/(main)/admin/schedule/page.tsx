import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { getDb } from "@/app/lib/db";
import ScheduleAdminClient from "./ScheduleAdminClient";

export default async function AdminSchedulePage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const db = getDb();

  const seasonsRes = await db.execute(
    `SELECT id, name, isActive, currentMatchday FROM "Season" ORDER BY id DESC`
  );

  const seasonsData = [];
  for (const s of seasonsRes.rows) {
    const matchdaysRes = await db.execute({
      sql: `SELECT id, number, isLocked, votesImported FROM "Matchday" WHERE seasonId = ? ORDER BY number ASC`,
      args: [s.id],
    });
    seasonsData.push({
      id: s.id as number,
      name: s.name as string,
      isActive: Boolean(s.isActive),
      currentMatchday: s.currentMatchday as number,
      matchdayCount: matchdaysRes.rows.length,
      matchdays: matchdaysRes.rows.map((m) => ({
        id: m.id as number,
        number: m.number as number,
        isLocked: Boolean(m.isLocked),
        votesImported: Boolean(m.votesImported),
      })),
    });
  }

  const activeSeasonId = seasonsData.find((s) => s.isActive)?.id ?? null;

  return (
    <ScheduleAdminClient
      seasons={seasonsData}
      activeSeasonId={activeSeasonId}
    />
  );
}
