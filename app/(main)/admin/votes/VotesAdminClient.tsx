"use client";

import { useActionState, useState } from "react";
import { importVotes, calculateAllScores } from "@/app/actions/votes";

interface Matchday {
  id: number;
  number: number;
  votesImported: boolean;
  isLocked: boolean;
}

export default function VotesAdminClient({
  seasonName,
  currentMatchday,
  matchdays,
}: {
  seasonName: string;
  currentMatchday: number;
  matchdays: Matchday[];
}) {
  const [importResult, importAction, importPending] = useActionState(importVotes, null);
  const [, calcAction, calcPending] = useActionState(calculateAllScores, null);

  const [selectedMatchday, setSelectedMatchday] = useState(
    matchdays.find((m) => m.number === currentMatchday) ?? matchdays[0]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Importa Voti</h1>
      <p className="text-gray-500 text-sm">
        Stagione: <strong>{seasonName}</strong> — Fonte: Fantapiu3.com Premier League
      </p>

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
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  {importPending ? (
                    <>⏳ Importazione in corso...</>
                  ) : (
                    <>📥 Importa voti Giornata {selectedMatchday.number}</>
                  )}
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
              <div className={`px-4 py-3 rounded-lg text-sm ${importResult.startsWith("Errore") ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
                {importResult}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Come funziona:</strong>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li>Seleziona la giornata da importare</li>
          <li>Clicca &quot;Importa voti&quot; — i dati vengono scaricati da Fantapiu3.com</li>
          <li>Il sistema abbina automaticamente i giocatori per nome</li>
          <li>Clicca &quot;Calcola punteggi&quot; per elaborare le formazioni e i risultati</li>
        </ol>
        <p className="mt-2 text-blue-600">
          Se un giocatore non viene abbinato, verifica che il nome nella sua scheda corrisponda a quello su Fantapiu3 (campo &quot;Nome su Fantapiu3&quot;).
        </p>
      </div>
    </div>
  );
}
