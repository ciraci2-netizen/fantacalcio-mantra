import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import BachecaClient from "./BachecaClient";

export default async function BachecaPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;

  let messages: {
    id: number;
    userId: number;
    teamName: string;
    logoUrl: string | null;
    content: string;
    createdAt: string;
  }[] = [];

  if (season) {
    try {
      const msgsRes = await db.execute({
        sql: `SELECT lm.id, lm.userId, lm.content, lm.createdAt,
                     u.teamName,
                     u.logoUrl
              FROM "LeagueMessage" lm
              JOIN "User" u ON u.id = lm.userId
              WHERE lm.seasonId = ?
              ORDER BY lm.createdAt DESC
              LIMIT 100`,
        args: [season.id],
      });
      messages = msgsRes.rows.map((r) => ({
        id: r.id as number,
        userId: r.userId as number,
        teamName: r.teamName as string,
        logoUrl: r.logoUrl as string | null,
        content: r.content as string,
        createdAt: r.createdAt as string,
      }));
    } catch {
      // Table not yet created — will be created on first post
    }
  }

  return (
    <BachecaClient
      messages={messages}
      currentUserId={session.userId}
      isAdmin={session.isAdmin}
      seasonName={season ? (season.name as string) : ""}
    />
  );
}
