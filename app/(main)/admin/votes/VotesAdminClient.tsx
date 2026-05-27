"use client";

import { useActionState, useState } from "react";
import { importVotes, calculateAllScores } from "@/app/actions/votes";
import { lockAndAdvanceMatchday } from "@/app/actions/schedule";

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
}

export default function VotesAdminClient({
  seasonId,
  seasonName,
  currentMatchday,
  currentMatchdayId,
  currentMatchdayTotal,
  matchdays,
  lineupSubmissions,
}: {
  seasonId: number;
  seasonName: string;
  currentMatchday: number;
  currentMatchdayId: number | null;
  currentMatchdayTotal: number;
  matchdays: Matchday[];
  lineupSubmissions: LineupSubmission[];
}) {
  const [importResult, importAction, importPending] = useActionState(importVotes, null);
  const [calcResult, calcAction, calcPending] = useActionState(calculateAllScores, null);
  const [advanceResult, advanceAction, advancePending] = useActionState(lockAndAdvanceMatchday, null);

  const [selectedMatchday, setSelectedMatchday] = useState(
    matchdays.find((m) => m.number === currentMatchday) ?? matchdays[0]
  );

  const submitted = lineupSubmissions.filter((l) => l.submitted).length;
  const scoresCalculated = lineupSubmissions.some((l) => l.score !== null);
  const canAdvance = currentMatchdayId !== null && currentMatchday < currentMatchdayTotal;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Importa Voti</h1>
      <p className="text-gray-500 text-sm">
        Stagione: <strong>{seasonName}</strong> — Fonte: Fantapiu3.com Premier League
      </p>

      {/* Lineup submission overview for current matchday */}
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

        {lineupSubmissions.length === 0 ? (
          <p className="text-gray-400 text-sm">Nessun partecipante registrato.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lineupSubmissions.map((l) => (
              <div
                key={l.userId}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                  l.submitted ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                }`}
              >
                <span className={`font-medium ${l.submitted ? "text-green-800" : "text-red-700"}`}>
                  {l.submitted ? "✓" : "✗"} {l.teamName}
                </span>
                {l.score !== null && (
                  <span className="text-green-700 font-bold">{l.score.toFixed(1)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vote import panel */}
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
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedMatchday.votesImported
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
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
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
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
              <div
                className={`px-4 py-3 rounded-lg text-sm ${
                  importResult.startsWith("Errore") || importResult.startsWith("Non")
                    ? "bg-red-50 border border-red-200 text-red-700"
                    : "bg-green-50 border border-green-200 text-green-700"
                }`}
              >
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
          <li>Verifica che tutte le formazioni siano state inviate (pannello sopra)</li>
          <li>Seleziona la giornata e clicca <strong>Importa voti</strong></li>
          <li>Clicca <strong>Calcola punteggi</strong> — i risultati vengono aggiornati</li>
          <li>Clicca <strong>Blocca G{currentMatchday} e avanza</strong> per passare alla giornata successiva</li>
        </ol>
      </div>
    </div>
  );
}
