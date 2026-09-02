import type { Metadata } from "next";
import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { getDb } from "@/app/lib/db";
import LineupForm from "@/app/(main)/lineup/LineupForm";

export const metadata: Metadata = { title: "Admin — Formazioni" };
export const dynamic = "force-dynamic";

export default async function AdminLineupPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; matchdayId?: string }>;
}) {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const db = getDb();
  const { userId: userIdParam, matchdayId: matchdayIdParam } = await searchParams;

  const seasonRes = await db.execute(
    `SELECT id, name, currentMatchday FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nessuna stagione attiva. Crea prima una stagione in Calendario.
      </div>
    );
  }

  const matchdaysRes = await db.execute({
    sql: `SELECT id, number, isLocked, votesImported FROM "Matchday" WHERE seasonId = ? ORDER BY number ASC`,
    args: [season.id],
  });
  const matchdays = matchdaysRes.rows.map((m) => ({
    id: m.id as number,
    number: m.number as number,
    isLocked: Boolean(m.isLocked),
    votesImported: Boolean(m.votesImported),
  }));

  const usersRes = await db.execute(
    `SELECT id, teamName FROM "User" WHERE isParticipant = 1 ORDER BY teamName ASC`
  );
  const users = usersRes.rows.map((u) => ({
    id: u.id as number,
    teamName: u.teamName as string,
  }));

  // Giornata selezionata (default: giornata corrente della stagione)
  const selectedMatchday =
    matchdays.find((m) => m.id === parseInt(matchdayIdParam ?? "")) ??
    matchdays.find((m) => m.number === season.currentMatchday) ??
    matchdays[0] ??
    null;

  // Squadra selezionata (default: nessuna, l'admin deve scegliere)
  const selectedUserId = parseInt(userIdParam ?? "");
  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  // Chi ha già inviato la formazione per la giornata selezionata (per la lista rapida)
  let submittedIds = new Set<number>();
  if (selectedMatchday) {
    const submittedRes = await db.execute({
      sql: `SELECT userId FROM "Lineup" WHERE matchdayId = ?`,
      args: [selectedMatchday.id],
    });
    submittedIds = new Set(submittedRes.rows.map((r) => r.userId as number));
  }

  // Dati per il form (rosa + formazione esistente) solo se squadra+giornata selezionate
  let roster: { id: number; name: string; realTeam: string; mantraRole: string }[] = [];
  let existingLineupData: { formation: string; starters: number[]; reserves: number[] } | null = null;

  if (selectedUser && selectedMatchday) {
    const rosterRes = await db.execute({
      sql: `SELECT p.id, p.name, p.realTeam, p.mantraRole
            FROM "Roster" r
            JOIN "Player" p ON p.id = r.playerId
            WHERE r.userId = ?
            ORDER BY p.mantraRole ASC, p.name ASC`,
      args: [selectedUser.id],
    });
    roster = rosterRes.rows.map((r) => ({
      id: r.id as number,
      name: r.name as string,
      realTeam: r.realTeam as string,
      mantraRole: r.mantraRole as string,
    }));

    const existingLineupRes = await db.execute({
      sql: `SELECT id, formation FROM "Lineup" WHERE userId = ? AND matchdayId = ? LIMIT 1`,
      args: [selectedUser.id, selectedMatchday.id],
    });
    const existingLineup = existingLineupRes.rows[0] ?? null;

    if (existingLineup) {
      const slotsRes = await db.execute({
        sql: `SELECT playerId, isStarter FROM "LineupSlot" WHERE lineupId = ? ORDER BY isStarter DESC, position ASC`,
        args: [existingLineup.id],
      });
      existingLineupData = {
        formation: existingLineup.formation as string,
        starters: slotsRes.rows.filter((s) => Number(s.isStarter) === 1).map((s) => s.playerId as number),
        reserves: slotsRes.rows.filter((s) => Number(s.isStarter) === 0).map((s) => s.playerId as number),
      };
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">🛠️ Formazioni — Inserimento admin</h1>
      </div>
      <p className="text-sm text-gray-500">
        Usa questa pagina per inserire o correggere manualmente la formazione di una squadra
        (es. un presidente che non è riuscito ad accedere in tempo). Funziona anche a giornata
        bloccata.
      </p>

      {/* ── Selezione giornata + squadra ─────────────────────────── */}
      <form method="get" className="bg-white rounded-xl border shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Giornata</label>
          <select
            name="matchdayId"
            defaultValue={selectedMatchday?.id ?? ""}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {matchdays.map((m) => (
              <option key={m.id} value={m.id}>
                G{m.number} {m.isLocked ? "🔒" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Squadra</label>
          <select
            name="userId"
            defaultValue={selectedUser?.id ?? ""}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">— seleziona —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {submittedIds.has(u.id) ? "✓ " : "✗ "}
                {u.teamName}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Carica
        </button>
      </form>

      {/* ── Riepilogo stato invii per la giornata selezionata ────── */}
      {selectedMatchday && (
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Stato formazioni G{selectedMatchday.number} — {submittedIds.size}/{users.length}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {users.map((u) => (
              <a
                key={u.id}
                href={`?matchdayId=${selectedMatchday.id}&userId=${u.id}`}
                className={`text-xs px-2 py-1 rounded-full font-medium border ${
                  submittedIds.has(u.id)
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-700 border-red-200"
                } ${selectedUser?.id === u.id ? "ring-2 ring-green-500" : ""}`}
              >
                {submittedIds.has(u.id) ? "✓" : "✗"} {u.teamName}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Form formazione ──────────────────────────────────────── */}
      {selectedUser && selectedMatchday ? (
        roster.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
            {selectedUser.teamName} non ha ancora una rosa assegnata (vedi Admin → Rose).
          </div>
        ) : (
          <LineupForm
            matchdayId={selectedMatchday.id}
            matchdayNumber={selectedMatchday.number}
            isLocked={selectedMatchday.isLocked}
            roster={roster}
            existingLineup={existingLineupData}
            admin={{ userId: selectedUser.id, teamName: selectedUser.teamName }}
          />
        )
      ) : (
        <div className="text-center py-8 text-gray-400 text-sm">
          Seleziona una giornata e una squadra per inserire o modificare la formazione.
        </div>
      )}
    </div>
  );
}
