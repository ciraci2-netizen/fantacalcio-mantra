"use client";

import { useActionState } from "react";
import { createCup, createCupRound, createCupMatch, setCupMatchScore, deleteCup } from "@/app/actions/cups";

type Match = { id: number; homeScore: number | null; awayScore: number | null; homeTeam: string; awayTeam: string; homeUserId: number; awayUserId: number };
type Round = { id: number; name: string; number: number; matches: Match[] };
type Cup = { id: number; name: string; rounds: Round[] };
type User = { id: number; teamName: string; username: string };

export default function AdminCoppeClient({ cups, users, seasonName }: { cups: Cup[]; users: User[]; seasonName: string | null }) {
  const [createState, createAction, createPending] = useActionState(createCup, null);
  const [roundState, roundAction, roundPending] = useActionState(createCupRound, null);
  const [matchState, matchAction, matchPending] = useActionState(createCupMatch, null);
  const [scoreState, scoreAction, scorePending] = useActionState(setCupMatchScore, null);
  const [deleteState, deleteAction] = useActionState(deleteCup, null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Admin Coppe {seasonName ? `— ${seasonName}` : ""}</h1>

      {/* Create cup */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h2 className="font-semibold text-gray-700 mb-3">Nuova Coppa</h2>
        <form action={createAction} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Nome Coppa</label>
            <input type="text" name="name" required placeholder="es. Coppa IPA" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
          </div>
          <button type="submit" disabled={createPending} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
            Crea
          </button>
        </form>
        {createState?.error && <p className="text-red-600 text-sm mt-2">{createState.error}</p>}
        {createState?.success && <p className="text-green-600 text-sm mt-2">Coppa creata.</p>}
      </div>

      {/* Cups list */}
      {cups.map((cup) => (
        <div key={cup.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="bg-yellow-600 text-white px-4 py-3 flex items-center justify-between">
            <span className="font-bold text-lg">🏆 {cup.name}</span>
            <form action={deleteAction}>
              <input type="hidden" name="cupId" value={cup.id} />
              <button type="submit" className="text-xs bg-red-700 hover:bg-red-800 px-2 py-1 rounded">Elimina</button>
            </form>
          </div>

          {/* Add round */}
          <div className="p-4 border-b">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Aggiungi turno</h3>
            <form action={roundAction} className="flex gap-3 items-end">
              <input type="hidden" name="cupId" value={cup.id} />
              <div className="flex-1">
                <input type="text" name="name" required placeholder="es. Quarti di finale" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
              </div>
              <button type="submit" disabled={roundPending} className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg text-sm">+Turno</button>
            </form>
          </div>

          {/* Rounds */}
          {cup.rounds.map((round) => (
            <div key={round.id} className="p-4 border-b last:border-0">
              <h4 className="font-semibold text-gray-700 mb-3">{round.name}</h4>

              {/* Add match */}
              <form action={matchAction} className="flex flex-wrap gap-2 items-end mb-4">
                <input type="hidden" name="cupRoundId" value={round.id} />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Casa</label>
                  <select name="homeUserId" required className="border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none">
                    {users.map((u) => <option key={u.id} value={u.id}>{u.teamName}</option>)}
                  </select>
                </div>
                <span className="text-gray-400 pb-1">vs</span>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Trasferta</label>
                  <select name="awayUserId" required className="border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none">
                    {users.map((u) => <option key={u.id} value={u.id}>{u.teamName}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={matchPending} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm">+Partita</button>
              </form>

              {/* Matches */}
              <div className="space-y-2">
                {round.matches.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="font-medium text-sm flex-1 text-right">{m.homeTeam}</span>
                    <form action={scoreAction} className="flex items-center gap-1">
                      <input type="hidden" name="matchId" value={m.id} />
                      <input type="number" name="homeScore" step="0.1" defaultValue={m.homeScore ?? ""} placeholder="0.0" className="w-16 border rounded px-1 py-0.5 text-sm text-center" />
                      <span className="text-gray-400">—</span>
                      <input type="number" name="awayScore" step="0.1" defaultValue={m.awayScore ?? ""} placeholder="0.0" className="w-16 border rounded px-1 py-0.5 text-sm text-center" />
                      <button type="submit" disabled={scorePending} className="px-2 py-0.5 bg-green-600 text-white rounded text-xs">✓</button>
                    </form>
                    <span className="font-medium text-sm flex-1">{m.awayTeam}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {cups.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Nessuna coppa ancora. Creane una sopra.</p>}
    </div>
  );
}
