import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { MANTRA_ROLES } from "@/app/lib/scoring";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

const ROLE_BG: Record<string, string> = {
  Por: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Dc:  "bg-blue-100 text-blue-800 border-blue-300",
  Dd:  "bg-blue-100 text-blue-800 border-blue-300",
  Ds:  "bg-blue-100 text-blue-800 border-blue-300",
  M:   "bg-green-100 text-green-800 border-green-300",
  C:   "bg-green-100 text-green-800 border-green-300",
  T:   "bg-green-100 text-green-800 border-green-300",
  W:   "bg-green-100 text-green-800 border-green-300",
  A:   "bg-red-100 text-red-800 border-red-300",
  Pc:  "bg-red-100 text-red-800 border-red-300",
};

const ROLE_LABEL: Record<string, string> = {
  Por: "Portieri", Dc: "Difensori Centrali", Dd: "Terzini Destri", Ds: "Terzini Sinistri",
  M: "Mediani", C: "Centrocampisti", T: "Trequartisti", W: "Esterni",
  A: "Attaccanti", Pc: "Seconde Punte",
};

export default async function TeamDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { userId: userIdStr } = await params;
  const userId = parseInt(userIdStr);
  if (isNaN(userId)) notFound();

  // Redirect to own team page
  if (userId === session.userId) redirect("/team");

  const db = getDb();

  const userRes = await db.execute({
    sql: `SELECT id, teamName, username FROM "User" WHERE id = ? AND isAdmin = 0`,
    args: [userId],
  });
  if (userRes.rows.length === 0) notFound();

  const user = userRes.rows[0];

  const rosterRes = await db.execute({
    sql: `SELECT r.id, r.purchasePrice, p.name, p.realTeam, p.mantraRole
          FROM "Roster" r
          JOIN "Player" p ON p.id = r.playerId
          WHERE r.userId = ?
          ORDER BY p.mantraRole ASC, p.name ASC`,
    args: [userId],
  });

  type RosterItem = { id: number; purchasePrice: number; player: { mantraRole: string; name: string; realTeam: string } };
  const roster: RosterItem[] = rosterRes.rows.map((r) => ({
    id: r.id as number,
    purchasePrice: r.purchasePrice as number,
    player: { mantraRole: r.mantraRole as string, name: r.name as string, realTeam: r.realTeam as string },
  }));

  const byRole: Record<string, RosterItem[]> = {};
  for (const r of roster) {
    if (!byRole[r.player.mantraRole]) byRole[r.player.mantraRole] = [];
    byRole[r.player.mantraRole].push(r);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-lg">
            {(user.teamName as string).slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{user.teamName as string}</h1>
            <p className="text-gray-400 text-sm">@{user.username as string}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${roster.length === 26 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {roster.length} / 26 giocatori
          </span>
          <Link href="/squadre" className="text-green-600 text-sm hover:underline">← Tutte le squadre</Link>
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-amber-700 font-medium">Questa rosa è ancora vuota.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {MANTRA_ROLES.filter((r) => byRole[r]?.length > 0).map((role) => (
            <div key={role} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className={`px-4 py-2.5 flex items-center justify-between border-b ${ROLE_BG[role]}`}>
                <span className="font-bold text-sm">{role}</span>
                <span className="text-xs opacity-70">{ROLE_LABEL[role]} · {byRole[role].length}</span>
              </div>
              <ul className="divide-y">
                {byRole[role].map((r) => (
                  <li key={r.id} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{r.player.name}</p>
                      <p className="text-xs text-gray-400">{r.player.realTeam}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
