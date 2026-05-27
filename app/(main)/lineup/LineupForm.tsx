"use client";

import { useActionState, useState } from "react";
import { saveLineup } from "@/app/actions/lineup";
import { VALID_FORMATIONS, MANTRA_ROLES } from "@/app/lib/scoring";

interface Player {
  id: number;
  name: string;
  realTeam: string;
  mantraRole: string;
  availability?: string; // "ok" | "inj" | "sus"
}

interface Props {
  matchdayId: number;
  matchdayNumber: number;
  isLocked: boolean;
  roster: Player[];
  existingLineup: {
    formation: string;
    starters: number[];
    reserves: number[];
  } | null;
}

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

export default function LineupForm({ matchdayId, matchdayNumber, isLocked, roster, existingLineup }: Props) {
  const [error, action, pending] = useActionState(saveLineup, null);

  const [formation, setFormation] = useState(existingLineup?.formation ?? "4-4-2");
  const [starters, setStarters] = useState<(number | null)[]>(
    Array(11).fill(null).map((_, i) => existingLineup?.starters[i] ?? null)
  );
  const [reserves, setReserves] = useState<(number | null)[]>(
    Array(7).fill(null).map((_, i) => existingLineup?.reserves[i] ?? null)
  );
  const [filter, setFilter] = useState<string>("tutti");

  const usedIds = new Set([...starters, ...reserves].filter(Boolean) as number[]);

  const availablePlayers = roster.filter(
    (p) => !usedIds.has(p.id) && (filter === "tutti" || p.mantraRole === filter)
  );

  function selectStarter(slot: number, playerId: number | null) {
    setStarters((prev) => {
      const next = [...prev];
      next[slot] = playerId;
      return next;
    });
  }

  function selectReserve(slot: number, playerId: number | null) {
    setReserves((prev) => {
      const next = [...prev];
      next[slot] = playerId;
      return next;
    });
  }

  function getPlayerById(id: number | null) {
    if (!id) return null;
    return roster.find((p) => p.id === id) ?? null;
  }

  if (isLocked) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-gray-600 font-medium">La giornata {matchdayNumber} è bloccata.</p>
        <p className="text-gray-400 text-sm mt-1">Non puoi più modificare la formazione.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Formazione — Giornata {matchdayNumber}
        </h1>
        {existingLineup && (
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
            ✓ Formazione salvata
          </span>
        )}
      </div>

      <form action={action} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <input type="hidden" name="matchdayId" value={matchdayId} />
        <input type="hidden" name="formation" value={formation} />
        {starters.map((id, i) => (
          <input key={`s${i}`} type="hidden" name={`starter_${i + 1}`} value={id ?? ""} />
        ))}
        {reserves.map((id, i) => (
          <input key={`r${i}`} type="hidden" name={`reserve_${i + 1}`} value={id ?? ""} />
        ))}

        {/* Formazione e titolari */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Modulo</label>
            <select
              value={formation}
              onChange={(e) => setFormation(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {VALID_FORMATIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h2 className="font-semibold text-gray-700 mb-3">Titolari (11)</h2>
            <div className="space-y-2">
              {starters.map((id, i) => {
                const player = getPlayerById(id);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                    <div className="flex-1 border rounded-lg flex items-center gap-2 px-2 py-1.5 bg-gray-50">
                      {player ? (
                        <>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[player.mantraRole] ?? "bg-gray-100"}`}>
                            {player.mantraRole}
                          </span>
                          <span className="flex-1 text-sm font-medium">{player.name}</span>
                          <span className="text-xs text-gray-400">{player.realTeam}</span>
                          <button
                            type="button"
                            onClick={() => selectStarter(i, null)}
                            className="text-red-400 hover:text-red-600 text-xs ml-1"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-300 text-sm italic">Seleziona un giocatore →</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h2 className="font-semibold text-gray-700 mb-3">Riserve (ordine di entrata)</h2>
            <div className="space-y-2">
              {reserves.map((id, i) => {
                const player = getPlayerById(id);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right">{i + 1}°</span>
                    <div className="flex-1 border rounded-lg flex items-center gap-2 px-2 py-1.5 bg-gray-50">
                      {player ? (
                        <>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[player.mantraRole] ?? "bg-gray-100"}`}>
                            {player.mantraRole}
                          </span>
                          <span className="flex-1 text-sm font-medium">{player.name}</span>
                          <button
                            type="button"
                            onClick={() => selectReserve(i, null)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-300 text-sm italic">Opzionale</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {pending ? "Salvataggio..." : "Salva formazione"}
          </button>
        </div>

        {/* Lista giocatori disponibili */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Rosa disponibile</h2>

          <div className="flex flex-wrap gap-1 mb-3">
            <button
              type="button"
              onClick={() => setFilter("tutti")}
              className={`px-2 py-1 rounded text-xs font-medium ${filter === "tutti" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Tutti
            </button>
            {MANTRA_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setFilter(r)}
                className={`px-2 py-1 rounded text-xs font-medium ${filter === r ? "bg-green-600 text-white" : `${ROLE_COLORS[r]} border`}`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {availablePlayers.map((p) => {
              const av = p.availability ?? "ok";
              const isUnavailable = av !== "ok";
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                    isUnavailable
                      ? "bg-red-50 border-red-100 opacity-75"
                      : "hover:bg-gray-50 border-transparent hover:border-gray-200"
                  }`}
                >
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[p.mantraRole] ?? "bg-gray-100"}`}>
                    {p.mantraRole}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      {p.name}
                      {av === "inj" && <span title="Infortunato" className="text-red-500">🤕</span>}
                      {av === "sus" && <span title="Squalificato" className="text-amber-500">🟨</span>}
                    </p>
                    <p className="text-xs text-gray-400">{p.realTeam}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const emptySlot = starters.findIndex((s) => s === null);
                        if (emptySlot !== -1) selectStarter(emptySlot, p.id);
                      }}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                      title="Aggiungi ai titolari"
                    >
                      T
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const emptySlot = reserves.findIndex((s) => s === null);
                        if (emptySlot !== -1) selectReserve(emptySlot, p.id);
                      }}
                      className="text-xs bg-gray-400 text-white px-2 py-1 rounded hover:bg-gray-500"
                      title="Aggiungi alle riserve"
                    >
                      R
                    </button>
                  </div>
                </div>
              );
            })}
            {availablePlayers.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">
                Nessun giocatore disponibile per questo filtro.
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
