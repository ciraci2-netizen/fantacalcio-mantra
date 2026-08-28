import type { Metadata } from "next";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { getRosterLimits } from "@/app/lib/leagueSettings";
import Link from "next/link";

export const metadata: Metadata = { title: "Squadre" };

export default async function SquadrePage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();
  const { numPortieri, numMovimento } = await getRosterLimits(db);

  const usersRes = await db.execute(
    `SELECT u.id, u.teamName, u.username,
            SUM(CASE WHEN p.mantraRole = 'POR' THEN 1 ELSE 0 END) as porCount,
            SUM(CASE WHEN r.id IS NOT NULL AND p.mantraRole != 'POR' THEN 1 ELSE 0 END) as movCount
     FROM "User" u
     LEFT JOIN "Roster" r ON r.userId = u.id
     LEFT JOIN "Player" p ON p.id = r.playerId
     WHERE u.isParticipant = 1
     GROUP BY u.id
     ORDER BY u.teamName ASC`
  );

  const teams = usersRes.rows.map((u) => ({
    id: u.id as number,
    teamName: u.teamName as string,
    username: u.username as string,
    porCount: (u.porCount as number) ?? 0,
    movCount: (u.movCount as number) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Squadre</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => {
          const isMe = team.id === session.userId;
          return (
            <Link
              key={team.id}
              href={isMe ? "/team" : `/squadre/${team.id}`}
              className={`bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-all flex items-center gap-4 ${
                isMe ? "border-green-300 ring-1 ring-green-200" : ""
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                {team.teamName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-800 truncate">
                  {team.teamName}
                  {isMe && (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                      Tu
                    </span>
                  )}
                </p>
                <p className="text-gray-400 text-sm">@{team.username}</p>
                <p
                  className={`text-xs mt-0.5 font-medium ${
                    team.porCount === numPortieri && team.movCount === numMovimento
                      ? "text-green-600"
                      : "text-amber-600"
                  }`}
                >
                  POR {team.porCount}/{numPortieri} · MOV {team.movCount}/{numMovimento}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
