"use client";

import { useActionState } from "react";
import { createCup, createCupRound, createCupGroup, createCupMatch, setCupMatchScore, setCupRoundSchedule, deleteCup, deleteCupRound } from "@/app/actions/cups";
import { computeGroupStandings } from "@/app/lib/cupStandings";

type Match = { id: number; homeScore: number | null; awayScore: number | null; homeTeam: string; awayTeam: string; homeUserId: number; awayUserId: number };
type Round = { id: number; name: string; number: number; type: "eliminazione" | "girone"; matchdayNumber: number | null; playDate: string | null; matches: Match[] };
type Cup = { id: number; name: string; rounds: Round[] };
type User = { id: number; teamName: string; username: string };

export default function AdminCoppeClient({ cups, users, seasonName }: { cups: Cup[]; users: User[]; seasonName: string | null }) {
  const [createState, createAction, createPending] = useActionState(createCup, null);
  const [roundState, roundAction, roundPending] = useActionState(createCupRound, null);
  const [groupState, groupAction, groupPending] = useActionState(createCupGroup, null);
  const [matchState, matchAction, matchPending] = useActionState(createCupMatch, null);
  const [scoreState, scoreAction, scorePending] = useActionState(setCupMatchScore, null);
  const [scheduleState, scheduleAction, schedulePending] = useActionState(setCupRoundSchedule, null);
  const [deleteState, deleteAction] = useActionState(deleteCup, null);
  const [deleteRoundState, deleteRoundAction] = useActionState(deleteCupRound, null);

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

      {deleteRoundState?.error && <p className="text-red-600 text-sm">{deleteRoundState.error}</p>}
      {scheduleState?.error && <p className="text-red-600 text-sm">{scheduleState.error}</p>}

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

          {/* Add round (eliminazione diretta: si aggiungono le partite a mano) */}
          <div className="p-4 border-b">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Aggiungi turno a eliminazione diretta</h3>
            <p className="text-xs text-gray-400 mb-2">Per quarti, semifinale, finale {"\u2014"} le partite si aggiungono a mano una alla volta scegliendo le due squadre.</p>
            <form action={roundAction} className="flex flex-wrap gap-3 items-end">
              <input type="hidden" name="cupId" value={cup.id} />
              <div className="flex-1 min-w-[160px]">
                <input type="text" name="name" required placeholder="es. Quarti di finale" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Giornata (facoltativo)</label>
                <input type="number" name="matchdayNumber" min="1" placeholder="es. 12" className="w-24 border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data (facoltativo)</label>
                <input type="date" name="playDate" className="border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
              </div>
              <button type="submit" disabled={roundPending} className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg text-sm">+Turno</button>
            </form>
            {roundState?.error && <p className="text-red-600 text-sm mt-2">{roundState.error}</p>}
          </div>

          {/* Add group (girone: round-robin automatico fra le squadre scelte) */}
          <div className="p-4 border-b bg-amber-50/40">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Aggiungi girone</h3>
            <p className="text-xs text-gray-400 mb-2">Seleziona le squadre del girone: vengono generate in automatico tutte le partite (ognuna gioca contro tutte le altre una volta).</p>
            <form action={groupAction} className="space-y-3">
              <input type="hidden" name="cupId" value={cup.id} />
              <div className="flex flex-wrap gap-3 items-end">
                <input type="text" name="name" required placeholder="es. Girone A" className="w-full sm:w-64 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Giornata (facoltativo)</label>
                  <input type="number" name="matchdayNumber" min="1" placeholder="es. 5" className="w-24 border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Data (facoltativo)</label>
                  <input type="date" name="playDate" className="border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input type="checkbox" name="userIds" value={u.id} className="rounded border-gray-300" />
                    {u.teamName}
                  </label>
                ))}
              </div>
              <button type="submit" disabled={groupPending} className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium">+Girone</button>
            </form>
            {groupState?.error && <p className="text-red-600 text-sm mt-2">{groupState.error}</p>}
            {groupState?.success && <p className="text-green-600 text-sm mt-2">Girone creato con le partite gia generate.</p>}
          </div>

          {/* Rounds */}
          {cup.rounds.map((round) => {
            const isGroup = round.type === "girone";
            const standings = isGroup ? computeGroupStandings(round.matches) : [];
            const qualifyCount = Math.min(4, standings.length);
            return (
              <div key={round.id} className="p-4 border-b last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="font-semibold text-gray-700">
                    {round.name} {isGroup && <span className="text-xs font-normal text-amber-600 ml-1">(girone)</span>}
                  </h4>
                  <form action={deleteRoundAction} onSubmit={(e) => { if (!confirm(`Eliminare il turno "${round.name}" e le sue partite?`)) e.preventDefault(); }}>
                    <input type="hidden" name="cupRoundId" value={round.id} />
                    <button type="submit" className="text-xs text-red-500 hover:text-red-700 hover:underline">Elimina turno</button>
                  </form>
                </div>

                {/* Quando si gioca: giornata/data, solo etichetta - il punteggio resta a mano */}
                <form action={scheduleAction} className="flex flex-wrap items-end gap-2 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                  <input type="hidden" name="cupRoundId" value={round.id} />
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Giornata</label>
                    <input type="number" name="matchdayNumber" min="1" defaultValue={round.matchdayNumber ?? ""} placeholder="es. 12" className="w-20 border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Data</label>
                    <input type="date" name="playDate" defaultValue={round.playDate ?? ""} className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                  </div>
                  <button type="submit" disabled={schedulePending} className="px-2.5 py-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-60 text-white rounded text-xs">Salva</button>
                </form>

                {/* Classifica (solo gironi) */}
                {isGroup && standings.length > 0 && (
                  <div className="overflow-x-auto mb-4 border rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 text-xs uppercase tracking-wide bg-gray-50">
                          <th className="text-left font-medium px-3 py-1.5">#</th>
                          <th className="text-left font-medium px-3 py-1.5">Squadra</th>
                          <th className="text-center font-medium px-2 py-1.5">PG</th>
                          <th className="text-center font-medium px-2 py-1.5">V</th>
                          <th className="text-center font-medium px-2 py-1.5">N</th>
                          <th className="text-center font-medium px-2 py-1.5">P</th>
                          <th className="text-center font-medium px-2 py-1.5">DR</th>
                          <th className="text-center font-medium px-3 py-1.5">Pt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((s, i) => (
                          <tr key={s.userId} className={`border-t ${i < qualifyCount ? "bg-green-50" : ""}`}>
                            <td className={`px-3 py-1.5 ${i < qualifyCount ? "text-green-700 font-semibold" : "text-gray-400"}`}>{i + 1}</td>
                            <td className="px-3 py-1.5 text-gray-700">{s.teamName}</td>
                            <td className="text-center px-2 py-1.5 text-gray-500">{s.played}</td>
                            <td className="text-center px-2 py-1.5 text-gray-500">{s.wins}</td>
                            <td className="text-center px-2 py-1.5 text-gray-500">{s.draws}</td>
                            <td className="text-center px-2 py-1.5 text-gray-500">{s.losses}</td>
                            <td className="text-center px-2 py-1.5 text-gray-500 tabular-nums">{s.diff > 0 ? `+${s.diff.toFixed(1)}` : s.diff.toFixed(1)}</td>
                            <td className="text-center px-3 py-1.5 font-bold text-gray-800">{s.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add match (solo turni a eliminazione: nei gironi le partite sono gia tutte generate) */}
                {!isGroup && (
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
                )}

                {/* Matches */}
                <div className="space-y-2">
                  {round.matches.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-medium text-sm flex-1 text-right">{m.homeTeam}</span>
                      <form action={scoreAction} className="flex items-center gap-1">
                        <input type="hidden" name="matchId" value={m.id} />
                        <input type="number" name="homeScore" step="0.1" defaultValue={m.homeScore ?? ""} placeholder="0.0" className="w-16 border rounded px-1 py-0.5 text-sm text-center" />
                        <span className="text-gray-400">{"\u2014"}</span>
                        <input type="number" name="awayScore" step="0.1" defaultValue={m.awayScore ?? ""} placeholder="0.0" className="w-16 border rounded px-1 py-0.5 text-sm text-center" />
                        <button type="submit" disabled={scorePending} className="px-2 py-0.5 bg-green-600 text-white rounded text-xs">{"\u2713"}</button>
                      </form>
                      <span className="font-medium text-sm flex-1">{m.awayTeam}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {cups.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Nessuna coppa ancora. Creane una sopra.</p>}
    </div>
  );
}
