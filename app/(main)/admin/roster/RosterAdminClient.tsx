"use client";

import { useActionState, useState } from "react";
import { addPlayerToRoster, removePlayerFromRoster, updatePurchasePrice } from "@/app/actions/roster";
import { MANTRA_ROLES } from "@/app/lib/scoring";

const ROLE_COLORS: Record<string, string> = {
  Por: "bg-yellow-100 text-yellow-800",
  Dc: "bg-blue-100 text-blue-800",
  Dd: "bg-blue-100 text-blue-800",
  Ds: "bg-blue-100 text-blue-800",
  M: "bg-green-100 text-green-800",
  C: "bg-green-100 text-green-800",
  T: "bg-green-100 text-green-800",
  W: "bg-green-100 text-green-800",
  A: "bg-red-100 text-red-800",
  Pc: "bg-red-100 text-red-800",
};

type RosterEntry = { id: number; playerId: number; purchasePrice: number; name: string; mantraRole: string; realTeam: string };
type User = { id: number; teamName: string; username: string; credits: number; logoUrl: string | null; roster: RosterEntry[] };
type FreePlayer = { id: number; name: string; realTeam: string; mantraRole: string };

export default function RosterAdminClient({
  users,
  freePlayers,
}: {
  users: User[];
  freePlayers: FreePlayer[];
}) {
  const [addError, addAction] = useActionState(addPlayerToRoster, null);
  const [removeError, removeAction] = useActionState(removePlayerFromRoster, null);
  const [, priceAction] = useActionState(updatePurchasePrice, null);

  const [selectedTeam, setSelectedTeam] = useState<number>(users[0]?.id ?? 0);
  const [freeSearch, setFreeSearch] = useState("");
  const [freeRole, setFreeRole] = useState("tutti");

  const team = users.find((u) => u.id === selectedTeam);
  const totalSpent = team?.roster.reduce((s, r) => s + r.purchasePrice, 0) ?? 0;

  const filteredFree = freePlayers.filter(
    (p) =>
      (freeRole === "tutti" || p.mantraRole === freeRole) &&
      (freeSearch === "" ||
        p.name.toUpperCase().includes(freeSearch.toUpperCase()) ||
        p.realTeam.toUpperCase().includes(freeSearch.toUpperCase()))
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Gestione Rose</h1>
        <span className="text-sm text-gray-500">{freePlayers.length} giocatori svincolati</span>
      </div>

      {/* Selettore squadra */}
      <div className="flex flex-wrap gap-2">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => setSelectedTeam(u.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
              selectedTeam === u.id
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-green-400"
            }`}
          >
            {u.logoUrl ? (
              <img src={u.logoUrl} alt={u.teamName} className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs flex items-center justify-center font-bold">
                {u.teamName.slice(0, 1)}
              </span>
            )}
            <span>{u.teamName}</span>
            <span className={`text-xs rounded-full px-1.5 ${selectedTeam === u.id ? "bg-green-500" : "bg-gray-100 text-gray-500"}`}>
              {u.roster.length}/26
            </span>
          </button>
        ))}
      </div>

      {team && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* ── Rosa squadra selezionata ────────────────── */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-green-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                {team.logoUrl ? (
                  <img src={team.logoUrl} alt={team.teamName} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold">
                    {team.teamName.slice(0, 1)}
                  </div>
                )}
                <span className="font-semibold">{team.teamName}</span>
              </div>
              <div className="text-sm text-green-200 flex gap-3">
                <span>{team.roster.length}/26 giocatori</span>
                <span>💰 {team.credits - totalSpent} cred. rimasti</span>
              </div>
            </div>

            {(addError || removeError) && (
              <div className="px-4 py-2 bg-red-50 text-red-600 text-sm border-b border-red-100">
                {addError || removeError}
              </div>
            )}

            {team.roster.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Nessun giocatore in rosa. Aggiungine dal pannello svincolati.
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Giocatore</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500 w-20">Prezzo</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {team.roster.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${ROLE_COLORS[r.mantraRole] ?? "bg-gray-100"}`}>
                              {r.mantraRole}
                            </span>
                            <div>
                              <p className="font-medium">{r.name}</p>
                              <p className="text-xs text-gray-400">{r.realTeam}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <form action={priceAction} className="flex items-center gap-1">
                            <input type="hidden" name="rosterId" value={r.id} />
                            <input
                              name="purchasePrice"
                              type="number"
                              min={0}
                              defaultValue={r.purchasePrice}
                              className="w-14 border rounded px-1.5 py-0.5 text-xs text-center"
                            />
                            <button type="submit" className="text-xs text-blue-500 hover:text-blue-700">✓</button>
                          </form>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <form action={removeAction}>
                            <input type="hidden" name="rosterId" value={r.id} />
                            <button
                              type="submit"
                              onClick={(e) => { if (!confirm(`Rimuovere ${r.name}?`)) e.preventDefault(); }}
                              className="text-red-400 hover:text-red-600 text-xs"
                            >
                              ✕
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Svincolati / aggiungi ───────────────────── */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-700 mb-2">Aggiungi svincolato</h2>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Cerca..."
                  value={freeSearch}
                  onChange={(e) => setFreeSearch(e.target.value)}
                  className="flex-1 min-w-0 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <select
                  value={freeRole}
                  onChange={(e) => setFreeRole(e.target.value)}
                  className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                >
                  <option value="tutti">Tutti</option>
                  {MANTRA_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {filteredFree.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                {freePlayers.length === 0 ? "Tutti i giocatori sono già assegnati." : "Nessun giocatore trovato."}
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[480px]">
                {filteredFree.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-2 border-b hover:bg-gray-50">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${ROLE_COLORS[p.mantraRole] ?? "bg-gray-100"}`}>
                      {p.mantraRole}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.realTeam}</p>
                    </div>
                    <form action={addAction} className="flex items-center gap-1 shrink-0">
                      <input type="hidden" name="userId" value={team.id} />
                      <input type="hidden" name="playerId" value={p.id} />
                      <input
                        name="purchasePrice"
                        type="number"
                        min={0}
                        defaultValue={0}
                        placeholder="€"
                        className="w-14 border rounded px-1.5 py-1 text-xs text-center"
                        title="Prezzo acquisto"
                      />
                      <button
                        type="submit"
                        className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded font-medium"
                      >
                        + Aggiungi
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
