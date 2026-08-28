import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import TeamLogo from "@/app/components/TeamLogo";
import StandingsSortClient from "./StandingsSortClient";
import { teamColor, teamInitials } from "@/app/lib/teamColor";

export const metadata: Metadata = { title: "Classifica" };

type StandingRow = {
  userId: number;
  teamName: string;
  username: string;
  logoUrl: string | null;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  played: number;
  gf: number;
  ga: number;
  gd: number;
  form: ("W" | "D" | "L")[];
};

async function getStandings(seasonId: number): Promise<StandingRow[]> {
  const db = getDb();

  const res = await db.execute({
    sql: `SELECT
            u.id, u.teamName, u.username,
            COALESCE(SUM(CASE WHEN m.homeUserId = u.id THEN m.homePoints ELSE m.awayPoints END), 0) as points,
            COALESCE(SUM(CASE WHEN (m.homeUserId = u.id AND m.homePoints = 3) OR (m.awayUserId = u.id AND m.awayPoints = 3) THEN 1 ELSE 0 END), 0) as wins,
            COALESCE(SUM(CASE WHEN (m.homeUserId = u.id AND m.homePoints = 1) OR (m.awayUserId = u.id AND m.awayPoints = 1) THEN 1 ELSE 0 END), 0) as draws,
            COALESCE(SUM(CASE WHEN (m.homeUserId = u.id AND m.homePoints = 0) OR (m.awayUserId = u.id AND m.awayPoints = 0) THEN 1 ELSE 0 END), 0) as losses,
            COALESCE(COUNT(m.id), 0) as played,
            COALESCE(ROUND(SUM(CASE WHEN m.homeUserId = u.id THEN m.homeScore ELSE m.awayScore END), 1), 0) as gf,
            COALESCE(ROUND(SUM(CASE WHEN m.homeUserId = u.id THEN m.awayScore ELSE m.homeScore END), 1), 0) as ga
          FROM "User" u
          LEFT JOIN (
            SELECT m2.* FROM "Match" m2
            JOIN "Matchday" md ON md.id = m2.matchdayId
            WHERE md.seasonId = ? AND m2.homePoints IS NOT NULL
          ) m ON m.homeUserId = u.id OR m.awayUserId = u.id
          WHERE u.isParticipant = 1
          GROUP BY u.id
          ORDER BY points DESC, gf DESC`,
    args: [seasonId],
  });

  const logoMap: Record<number, string | null> = {};
  try {
    const logoRes = await db.execute(`SELECT id, logoUrl FROM "User" WHERE isParticipant = 1`);
    for (const row of logoRes.rows) {
      logoMap[row.id as number] = (row.logoUrl as string | null) ?? null;
    }
  } catch { /* column not yet migrated */ }

  // ── Forma recente: last 5 results per user ─────────────────────────
  const formMap: Record<number, ("W" | "D" | "L")[]> = {};
  try {
    const formRes = await db.execute({
      sql: `SELECT userId, result, matchdayNumber FROM (
              SELECT m.homeUserId as userId,
                CASE WHEN m.homePoints = 3 THEN 'W' WHEN m.homePoints = 1 THEN 'D' ELSE 'L' END as result,
                md.number as matchdayNumber
              FROM "Match" m
              JOIN "Matchday" md ON md.id = m.matchdayId
              WHERE md.seasonId = ? AND m.homePoints IS NOT NULL
              UNION ALL
              SELECT m.awayUserId as userId,
                CASE WHEN m.awayPoints = 3 THEN 'W' WHEN m.awayPoints = 1 THEN 'D' ELSE 'L' END as result,
                md.number as matchdayNumber
              FROM "Match" m
              JOIN "Matchday" md ON md.id = m.matchdayId
              WHERE md.seasonId = ? AND m.awayPoints IS NOT NULL
            ) ORDER BY userId ASC, matchdayNumber DESC`,
      args: [seasonId, seasonId],
    });

    for (const row of formRes.rows) {
      const uid = row.userId as number;
      if (!formMap[uid]) formMap[uid] = [];
      if (formMap[uid].length < 5) {
        formMap[uid].push(row.result as "W" | "D" | "L");
      }
    }
  } catch { /* matches might not exist */ }

  return res.rows.map((r) => ({
    userId: r.id as number,
    teamName: r.teamName as string,
    username: r.username as string,
    logoUrl: logoMap[r.id as number] ?? null,
    points: r.points as number,
    wins: r.wins as number,
    draws: r.draws as number,
    losses: r.losses as number,
    played: r.played as number,
    gf: r.gf as number,
    ga: r.ga as number,
    gd: Math.round(((r.gf as number) - (r.ga as number)) * 10) / 10,
    form: formMap[r.id as number] ?? [],
  }));
}

/* ── Podium component ────────────────────────────────────────────────────── */
function Podium({ standings, myUserId }: { standings: StandingRow[]; myUserId: number }) {
  const [first, second, third] = standings;
  const podiumOrder = [second, first, third]; // visual: 2nd left, 1st center, 3rd right
  const heights = ["h-20", "h-28", "h-14"];
  const medals = ["🥈", "🥇", "🥉"];
  const positions = [2, 1, 3];

  return (
    <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl p-6 shadow-xl">
      <div className="flex items-end justify-center gap-3">
        {podiumOrder.map((s, vi) => {
          if (!s) return null;
          const isMe = s.userId === myUserId;
          const { bg } = teamColor(s.teamName);
          const initials = teamInitials(s.teamName);
          return (
            <div key={s.userId} className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
              {/* Avatar */}
              <div className={`relative`}>
                {s.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logoUrl} alt={s.teamName}
                    className={`w-14 h-14 rounded-full object-cover border-4 ${isMe ? "border-yellow-400" : "border-white/20"} shadow-lg`}
                    loading="lazy" decoding="async" />
                ) : (
                  <div className={`w-14 h-14 rounded-full ${bg} flex items-center justify-center font-bold text-white text-lg border-4 ${isMe ? "border-yellow-400" : "border-white/20"} shadow-lg`}>
                    {initials}
                  </div>
                )}
                <span className="absolute -top-2 -right-2 text-xl">{medals[vi]}</span>
              </div>
              {/* Name */}
              <div className="text-center">
                <p className="text-white font-semibold text-xs leading-tight truncate max-w-[100px]">{s.teamName}</p>
                <p className="text-slate-400 text-xs">{s.points} pt</p>
              </div>
              {/* Bar */}
              <div className={`w-full ${heights[vi]} rounded-t-xl flex items-center justify-center text-white font-bold text-xl
                ${positions[vi] === 1 ? "bg-yellow-500" : positions[vi] === 2 ? "bg-slate-400" : "bg-amber-700"}`}>
                {positions[vi]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const POSITION_COLORS = [
  "text-yellow-500",  // 1°
  "text-slate-400",   // 2°
  "text-amber-600",   // 3°
];

const FORM_STYLES: Record<"W" | "D" | "L", string> = {
  W: "bg-green-100 text-green-700 font-bold",
  D: "bg-gray-100 text-gray-600 font-semibold",
  L: "bg-red-100 text-red-600 font-semibold",
};

export default async function StandingsPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();
  const seasonRes = await db.execute(`SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return <div className="text-center py-12 text-gray-500">Nessuna stagione attiva.</div>;
  }

  const seasonId = season.id as number;

  // Cache standings for 60 seconds (revalidated on demand via revalidatePath)
  const getCachedStandings = unstable_cache(
    () => getStandings(seasonId),
    [`standings-${seasonId}`],
    { revalidate: 60, tags: [`standings-${seasonId}`] }
  );

  const standings = await getCachedStandings();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">
        Classifica —{" "}
        <span className="text-green-700">{season.name as string}</span>
      </h1>

      {/* ── PODIO ── */}
      {standings.length >= 3 && (
        <Podium standings={standings} myUserId={session.userId} />
      )}

      <StandingsSortClient standings={standings} myUserId={session.userId} />
    </div>
  );
}
