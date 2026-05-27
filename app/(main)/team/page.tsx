import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import { MANTRA_ROLES } from "@/app/lib/scoring";

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
  Por: "Portieri",
  Dc:  "Difensori Centrali",
  Dd:  "Terzini Destri",
  Ds:  "Terzini Sinistri",
  M:   "Mediani",
  C:   "Centrocampisti",
  T:   "Trequartisti",
  W:   "Esterni",
  A:   "Attaccanti",
  Pc:  "Seconde Punte",
};

type RosterItem = {
  id: number;
  purchasePrice: number;
  player: { mantraRole: string; name: string; realTeam: string };
};

export default async function TeamPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();
  const rosterRes = await db.execute({
    sql: `SELECT r.id, r.purchasePrice, p.name, p.realTeam, p.mantraRole
          FROM "Roster" r
          JOIN "Player" p ON p.id = r.playerId
          WHERE r.userId = ?
          ORDER BY p.mantraRole ASC, p.name ASC`,
    args: [session.userId],
  });

  const roster: RosterItem[] = rosterRes.rows.map((r) => ({
    id: r.id as number,
    purchasePrice: r.purchasePrice as number,
    player: {
      mantraRole: r.mantraRole as string,
      name: r.name as string,
      realTeam: r.realTeam as string,
    },
  }));

  const byRole: Record<string, RosterItem[]> = {};
  for (const r of roster) {
    if (!byRole[r.player.mantraRole]) byRole[r.player.mantraRole] = [];
    byRole[r.player.mantraRole].push(r);
  }

  const totalValue = roster.reduce((sum, r) => sum + (r.purchasePrice ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Rosa: <span className="text-green-700">{session.teamName}</span>
          </h1>
          {totalValue > 0 && (
            <p className="text-gray-400 text-sm mt-0.5">Valore totale: {totalValue}M</p>
          )}
        </div>
        <span
          className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
            roster.length === 26
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {roster.length} / 26 giocatori
        </span>
      </div>

      {roster.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-amber-700 font-medium">La tua rosa è vuota.</p>
          <p className="text-amber-600 text-sm mt-1">
            L&apos;admin deve ancora assegnare i giocatori alla tua squadra.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {MANTRA_ROLES.filter((r) => byRole[r]?.length > 0).map((role) => (
            <div key={role} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className={`px-4 py-2.5 flex items-center justify-between border-b ${ROLE_BG[role]}`}>
                <span className="font-bold text-sm">{role}</span>
                <span className="text-xs opacity-70">
                  {ROLE_LABEL[role]} · {byRole[role].length}
                </span>
              </div>
              <ul className="divide-y">
                {byRole[role].map((r) => (
                  <li key={r.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{r.player.name}</p>
                      <p className="text-xs text-gray-400">{r.player.realTeam}</p>
                    </div>
                    {r.purchasePrice > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-2 shrink-0">
                        {r.purchasePrice}M
                      </span>
                    )}
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
