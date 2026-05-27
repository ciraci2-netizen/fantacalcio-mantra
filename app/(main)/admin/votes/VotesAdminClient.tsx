"use client";

import { useActionState, useState } from "react";
import { importVotes, calculateAllScores } from "@/app/actions/votes";
import { lockAndAdvanceMatchday } from "@/app/actions/schedule";
import { setPlayerStatus } from "@/app/actions/settings";

interface Matchday {
  id: number;
  number: number;
  votesImported: boolean;
  isLocked: boolean;
}

interface LineupSubmission {
  userId: number;
  teamName: string;
  submitted: boolean;
  score: number | null;
  isAutomatic?: boolean;
  substitutions?: number;
}

interface PlayerStatus {
  playerId: number;
  playerName: string;
  status: string;
}

interface Player {
  id: number;
  name: string;
  realTeam: string;
  mantraRole: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  ok: { label: "Disponibile", color: "bg-green-100 text-green-700", icon: "✓" },
  inj: { label: "Infortunato", color: "bg-red-100 text-red-700", icon: "🤕" },
  sus: { label: "Squalificato", color: "bg-amber-100 text-amber-700", icon: "🟨" },
};

export default function VotesAdminClient({
  seasonId,
  seasonName,
  currentMatchday,
  currentMatchdayId,
  currentMatchdayTotal,
  matchdays,
  lineupSubmissions,
  playerStatuses,
  allPlayers,
}: {
  seasonId: number;
  seasonName: string;
  currentMatchday: number;
  currentMatchdayId: number | null;
  currentMatchdayTotal: number;
  matchdays: Matchday[];
  lineupSubmissions: LineupSubmission[];
  playerStatuses: PlayerStatus[];
  allPlayers: Player[];
}) {
  const [importResult, importAction, importPending] = useActionState(importVotes, null);
  const [calcResult, calcAction, calcPending] = useActionState(calculateAllScores, null);
  const [advanceResult, advanceAction, advancePending] = useActionState(lockAndAdvanceMatchday, null);
  const [, statusAction] = useActionState(setPlayerStatus, null);

  const [selectedMatchday, setSelectedMatchday] = useState(
    matchdays.find((m) => m.number === currentMatchday) ?? matchdays[0]
  );
  const [playerSearch, setPlayerSearch] = useState("");
  const [showAvailability, setShowAvailability] = useState(false);

  const submitted = lineupSubmissions.filter((l) => l.submitted).length;
  const canAdvance = currentMatchdayId !== null && currentMatchday < currentMatchdayTotal;

  // Mappa playerId → status corrente
  const statusMap = new Map(playerStatuses.map((s) => [s.playerId, s.status]));

  const filteredPlayers = allPlayers.filter(
    (p) =>
      p.name.includes(playerSearch.toUpperCase()) ||
      p.realTeam.includes(playerSearch.toUpperCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Gestione Giornata</h1>
      <p className="text-gray-500 text-sm">
        Stagione: <strong>{seasonName}</strong> — Fonte: Fantapiu3.com Premier League
      </p>

      {/* ── Formazioni inviate ─────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-700">
            Formazioni G{currentMatchday} — {submitted}/{lineupSubmissions.length} inviate
          </h2>
          {canAdvance && (
            <form action={advanceAction}>
              <input type="hidden" name="seasonId" value={seasonId} />
              <input type="hidden" name="matchdayId" value={currentMatchdayId!} />
              <input type="hidden" name="nextNumber" value={currentMatchday + 1} />
              <button
                type="submit"
                disabled={advancePending}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {advancePending ? "..." : `🔒 Blocca G${currentMatchday} e avanza a G${currentMatchday + 1}`}
              </button>
            </form>
          )}
        </div>

        {advanceResult && (
          <div className="mb-3 px-3 py-2 rounded text-sm bg-red-50 border border-red-200 text-red-700">
            {advanceResult}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {lineupSubmissions.map((l) => (
            <div
              key={l.userId}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border ${
                l.submitted
                  ? l.isAutomatic
                    ? "bg-amber-50 border-amber-200"
                    : "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <span className={`font-medium ${l.submitted ? (l.isAutomatic ? "text-amber-800" : "text-green-800") : "text-red-700"}`}>
                {l.submitted ? (l.isAutomatic ? "🤖" : "✓") : "✗"} {l.teamName}
              </span>
              <div className="flex items-center gap-2">
                {l.score !== null && (
                  <span className="font-bold text-gray-700">{l.score.toFixed(1)}</span>
                )}
                {(l.substitutions ?? 0) > 0 && (
                  <span className="text-xs text-gray-400">↔{l.substitutions}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-2">
          ✓ = inviata manualmente &nbsp;·&nbsp; 🤖 = generata automaticamente &nbsp;·&nbsp; ↔N = N sostituzioni
        </p>
      </div>

      {/* ── Disponibilità giocatori ────────────────────────── */}
      {currentMatchdayId && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold text-gray-700">
              Disponibilità giocatori G{currentMatchday}
            </h2>
            <button
              type="button"
              onClick={() => setShowAvailability(!showAvailability)}
              className="text-sm text-green-600 hover:underline"
            >
              {showAvailability ? "Chiudi" : "Gestisci"}
            </button>
          </div>

          {/* Riepilogo squalificati/infortunati */}
          {playerStatuses.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {playerStatuses.map((s) => (
                <span
                  key={s.playerId}
                  className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_LABELS[s.status]?.color}`}
                >
                  {STATUS_LABELS[s.status]?.icon} {s.playerName}
                </span>
              ))}
            </div>
          )}
          {playerStatuses.length === 0 && !showAvailability && (
            <p className="text-gray-400 text-sm">Tutti i giocatori sono disponibili per questa giornata.</p>
          )}

          {showAvailability && (
            <div className="mt-3 border-t pt-3 space-y-3">
              <input
                type="text"
                placeholder="Cerca giocatore..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="max-h-72 overflow-y-auto space-y-1">
                {filteredPlayers.slice(0, 50).map((p) => {
                  const currentStatus = statusMap.get(p.id) ?? "ok";
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-gray-50">
                      <span className="text-xs text-gray-400 w-8">{p.mantraRole}</span>
                      <span className="text-sm flex-1">{p.name}</span>
                      <span className="text-xs text-gray-400">{p.realTeam}</span>
                      <form action={statusAction} className="flex gap-1">
                        <input type="hidden" name="playerId" value={p.id} />
                        <input type="hidden" name="matchdayId" value={currentMatchdayId} />
                        {(["ok", "inj", "sus"] as const).map((s) => (
                          <button
                            key={s}
                            type="submit"
                            name="status"
                            value={s}
                            className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                              currentStatus === s
                                ? STATUS_LABELS[s].color + " border-current font-medium"
                                : "bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-400"
                            }`}
                          >
                            {STATUS_LABELS[s].icon}
                          </button>
                        ))}
                      </form>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Import voti ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Seleziona giornata</h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2 mb-4">
          {matchdays.map((md) => (
            <button
              key={md.id}
              type="button"
              onClick={() => setSelectedMatchday(md)}
              className={`text-center p-2 rounded-lg border text-xs font-medium transition-colors ${
                selectedMatchday?.id === md.id
                  ? "bg-green-600 text-white border-green-600"
                  : md.votesImported
                  ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
              }`}
            >
              G{md.number}
              {md.votesImported && <div>✓</div>}
              {md.isLocked && <div>🔒</div>}
            </button>
          ))}
        </div>

        {selectedMatchday && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${selectedMatchday.votesImported ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {selectedMatchday.votesImported ? "✓ Voti importati" : "Voti non ancora importati"}
              </div>
              {selectedMatchday.isLocked && (
                <div className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                  🔒 Giornata bloccata
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <form action={importAction}>
                <input type="hidden" name="matchdayId" value={selectedMatchday.id} />
                <input type="hidden" name="matchdayNumber" value={selectedMatchday.number} />
                <button
                  type="submit"
                  disabled={importPending}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {importPending ? "⏳ Importazione..." : `📥 Importa voti G${selectedMatchday.number}`}
                </button>
              </form>

              {selectedMatchday.votesImported && (
                <form action={calcAction}>
                  <input type="hidden" name="matchdayId" value={selectedMatchday.id} />
                  <button
                    type="submit"
                    disabled={calcPending}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    {calcPending ? "Calcolo..." : "⚡ Calcola punteggi"}
                  </button>
                </form>
              )}
            </div>

            {importResult && (
              <div className={`px-4 py-3 rounded-lg text-sm ${importResult.startsWith("Errore") || importResult.startsWith("Non") ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
                {importResult}
              </div>
            )}
            {calcResult && (
              <div className="px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
                {calcResult}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Flusso giornata:</strong>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li>Segna giocatori infortunati/squalificati nel pannello Disponibilità</li>
          <li>Verifica che le formazioni siano state inviate</li>
          <li>Seleziona la giornata e clicca <strong>Importa voti</strong></li>
          <li>Clicca <strong>Calcola punteggi</strong> — auto-genera formazioni mancanti + applica soglie gol</li>
          <li>Clicca <strong>Blocca G{currentMatchday}</strong> per passare alla giornata successiva</li>
        </ol>
      </div>
    </div>
  );
}
