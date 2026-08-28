import type { Metadata } from "next";
import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import { getRosterLimits } from "@/app/lib/leagueSettings";
import TeamClient from "./TeamClient";

export const metadata: Metadata = { title: "Rosa" };

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

  // Crediti: leggi dalla tabella User + spesa totale
  const creditsRes = await db.execute({
    sql: `SELECT credits FROM "User" WHERE id = ?`,
    args: [session.userId],
  });
  const totalCredits = (creditsRes.rows[0]?.credits as number) ?? 500;

  const roster = rosterRes.rows.map((r) => ({
    id: r.id as number,
    purchasePrice: r.purchasePrice as number,
    player: {
      mantraRole: r.mantraRole as string,
      name: r.name as string,
      realTeam: r.realTeam as string,
    },
  }));

  const totalValue = roster.reduce((sum, r) => sum + (r.purchasePrice ?? 0), 0);

  const { numPortieri, numMovimento } = await getRosterLimits(db);
  const porCount = roster.filter((r) => r.player.mantraRole === "POR").length;
  const movCount = roster.length - porCount;
  const rosterComplete = porCount === numPortieri && movCount === numMovimento;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Rosa: <span className="text-green-700">{session.teamName}</span>
          </h1>
          {totalValue > 0 && (
            <p className="text-gray-400 text-sm mt-0.5">Valore acquisti: {totalValue}M</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span
            className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
              totalCredits - totalValue >= 0
                ? "bg-blue-100 text-blue-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            💰 {totalCredits - totalValue} crediti rimanenti
          </span>
          <span
            className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
              rosterComplete
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            POR {porCount}/{numPortieri} · MOV {movCount}/{numMovimento}
          </span>
        </div>
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
        <TeamClient roster={roster} totalCredits={totalCredits} />
      )}
    </div>
  );
}
