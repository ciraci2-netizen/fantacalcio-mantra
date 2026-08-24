"use client";

import { useActionState, useState } from "react";
import { createUser, updateUserPassword, deleteUser } from "@/app/actions/users";
import { addPlayerToRoster, removePlayerFromRoster } from "@/app/actions/roster";

interface RosterEntry {
  id: number;
  playerId: number;
  playerName: string;
  playerRole: string;
  playerTeam: string;
  purchasePrice: number;
}

interface User {
  id: number;
  username: string;
  teamName: string;
  roster: RosterEntry[];
}

interface AvailablePlayer {
  id: number;
  name: string;
  realTeam: string;
  mantraRole: string;
}

const ROLE_COLORS: Record<string, string> = {
  POR: "bg-yellow-100 text-yellow-800",
  DC: "bg-blue-100 text-blue-800",
  TER: "bg-indigo-100 text-indigo-800",
  M: "bg-green-100 text-green-800",
  OFF: "bg-teal-100 text-teal-800",
  ATT: "bg-red-100 text-red-800",
};

export default function UsersAdminClient({
  users,
  availablePlayers,
}: {
  users: User[];
  availablePlayers: AvailablePlayer[];
}) {
  const [createError, createAction, createPending] = useActionState(createUser, null);
  const [, deleteAction] = useActionState(deleteUser, null);
  const [, addPlayerAction] = useActionState(addPlayerToRoster, null);
  const [, removePlayerAction] = useActionState(removePlayerFromRoster, null);

  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");

  const filteredPlayers = availablePlayers.filter(
    (p) =>
      p.name.includes(playerSearch.toUpperCase()) ||
      p.realTeam.includes(playerSearch.toUpperCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestisci Utenti</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{users.length} / 10 partecipanti</span>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {showCreateForm ? "Chiudi" : "+ Nuovo utente"}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Crea nuovo partecipante</h2>
          <form action={createAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Username *</label>
              <input name="username" required placeholder="mario_rossi" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Password *</label>
              <input name="password" type="password" required placeholder="••••••••" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Nome squadra *</label>
              <input name="teamName" required placeholder="FC Invincibili" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            {createError && <p className="col-span-full text-red-600 text-sm">{createError}</p>}
            <button type="submit" disabled={createPending} className="col-span-full sm:col-span-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium">
              {createPending ? "Creazione..." : "Crea utente"}
            </button>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
            >
              <div>
                <p className="font-semibold text-gray-800">{user.teamName}</p>
                <p className="text-sm text-gray-400">@{user.username}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${user.roster.length === 26 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {user.roster.length}/26 giocatori
                </span>
                <span className="text-gray-400">{expandedUser === user.id ? "▲" : "▼"}</span>
              </div>
            </div>

            {expandedUser === user.id && (
              <div className="border-t px-5 py-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <PasswordResetForm userId={user.id} />
                  <form action={deleteAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button
                      type="submit"
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm"
                      onClick={(e) => { if (!confirm(`Eliminare ${user.teamName}?`)) e.preventDefault(); }}
                    >
                      Elimina utente
                    </button>
                  </form>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Rosa attuale */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 mb-2">Rosa attuale</h3>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {user.roster.length === 0 ? (
                        <p className="text-gray-400 text-sm">Rosa vuota.</p>
                      ) : (
                        user.roster.map((r) => (
                          <div key={r.id} className="flex items-center gap-2 text-sm">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_COLORS[r.playerRole] ?? "bg-gray-100"}`}>
                              {r.playerRole}
                            </span>
                            <span className="flex-1 font-medium">{r.playerName}</span>
                            <span className="text-gray-400 text-xs">{r.playerTeam}</span>
                            <form action={removePlayerAction} className="inline">
                              <input type="hidden" name="rosterId" value={r.id} />
                              <button type="submit" className="text-red-400 hover:text-red-600 text-xs">✕</button>
                            </form>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Aggiungi giocatori */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 mb-2">
                      Aggiungi giocatore ({availablePlayers.length} liberi)
                    </h3>
                    <input
                      type="text"
                      placeholder="Cerca..."
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      className="w-full border rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {filteredPlayers.slice(0, 20).map((p) => (
                        <form key={p.id} action={addPlayerAction} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="playerId" value={p.id} />
                          <input type="hidden" name="purchasePrice" value="0" />
                          <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_COLORS[p.mantraRole] ?? "bg-gray-100"}`}>
                            {p.mantraRole}
                          </span>
                          <span className="flex-1 text-sm">{p.name} <span className="text-gray-400">({p.realTeam})</span></span>
                          <button type="submit" className="text-green-600 hover:text-green-800 text-xs font-medium">
                            + Aggiungi
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Per-user password reset form with feedback ──────────────────────────── */
function PasswordResetForm({ userId }: { userId: number }) {
  const [state, action, pending] = useActionState(updateUserPassword, null);
  const success = state === "ok";
  const error = state && state !== "ok" ? state : null;

  return (
    <form action={action} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input type="hidden" name="userId" value={userId} />
        <input
          key={success ? "reset" : "input"}
          name="password"
          type="password"
          placeholder="Nuova password"
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-44"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm whitespace-nowrap"
        >
          {pending ? "..." : "Cambia pwd"}
        </button>
      </div>
      {success && (
        <p className="text-xs text-green-600 font-medium">✓ Password aggiornata</p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </form>
  );
}
