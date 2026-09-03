"use client";

import { useActionState } from "react";
import { createSeason, generateCalendar, setCurrentMatchday, importCalendarCsv, repeatCalendarFromFirstLeg } from "@/app/actions/schedule";

interface Matchday {
  id: number;
  number: number;
  isLocked: boolean;
  votesImported: boolean;
}

interface Season {
  id: number;
  name: string;
  isActive: boolean;
  currentMatchday: number;
  matchdayCount: number;
  matchdays: Matchday[];
}

export default function ScheduleAdminClient({
  seasons,
  activeSeasonId,
}: {
  seasons: Season[];
  activeSeasonId: number | null;
}) {
  const [createError, createAction, createPending] = useActionState(createSeason, null);
  const [calError, calAction, calPending] = useActionState(generateCalendar, null);
  const [, matchdayAction] = useActionState(setCurrentMatchday, null);
  const [csvResult, csvAction, csvPending] = useActionState(importCalendarCsv, null);
  const [repeatResult, repeatAction, repeatPending] = useActionState(repeatCalendarFromFirstLeg, null);

  const activeSeason = seasons.find((s) => s.id === activeSeasonId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Stagione & Calendario</h1>

      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Crea nuova stagione</h2>
        <form action={createAction} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-500">Nome stagione *</label>
            <input name="name" required placeholder="2025/26" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Numero giornate</label>
            <input name="matchdayCount" type="number" defaultValue={38} min={1} max={50} className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <button type="submit" disabled={createPending} className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium">
            {createPending ? "Creazione..." : "Crea stagione"}
          </button>
        </form>
        {createError && <p className="text-red-600 text-sm mt-2">{createError}</p>}
        <p className="text-xs text-amber-600 mt-2">Attenzione: creare una nuova stagione disattiverà quella corrente.</p>
      </div>

      {activeSeason && (
        <>
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-1">
              Stagione attiva: <span className="text-green-700">{activeSeason.name}</span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {activeSeason.matchdayCount} giornate — Giornata corrente: {activeSeason.currentMatchday}
            </p>

            <div className="flex flex-wrap gap-3">
              <form action={calAction} className="flex gap-3 items-center">
                <input type="hidden" name="seasonId" value={activeSeason.id} />
                <button type="submit" disabled={calPending} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {calPending ? "Generazione..." : "🔀 Genera calendario automatico"}
                </button>
              </form>

              <form action={matchdayAction} className="flex gap-2 items-center">
                <input type="hidden" name="seasonId" value={activeSeason.id} />
                <label className="text-sm text-gray-600">Imposta giornata:</label>
                <input
                  name="matchday"
                  type="number"
                  defaultValue={activeSeason.currentMatchday}
                  min={1}
                  max={activeSeason.matchdayCount}
                  className="border rounded-lg px-3 py-2 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button type="submit" className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm">
                  Aggiorna
                </button>
              </form>
            </div>
            {calError && (
              <p className={`text-sm mt-2 ${calError.startsWith("OK:") ? "text-green-600" : "text-red-600"}`}>
                {calError}
              </p>
            )}
          </div>

          {/* ── Import calendario da CSV ─────────────────── */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-1">📥 Importa calendario da CSV</h2>
            <p className="text-xs text-gray-400 mb-3">
              Formato: una riga per partita —{" "}
              <code className="bg-gray-100 px-1 rounded">giornata,squadra_casa,squadra_ospite</code>
              {" "}(separatore virgola o punto e virgola). I nomi squadra devono corrispondere esattamente.
            </p>

            <form action={csvAction} className="space-y-3">
              <input type="hidden" name="seasonId" value={activeSeason.id} />
              <textarea
                name="csv"
                rows={10}
                placeholder={"1,Godo Glimt,Deportivo la Carogna\n1,Ciofenaghen FC,Schalke 104\n2,Deportivo la Carogna,Ciofenaghen FC\n..."}
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
              />
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={csvPending}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {csvPending ? "Importazione..." : "Importa"}
                </button>
                {csvResult && (
                  <p className={`text-sm ${csvResult.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>
                    {csvResult}
                  </p>
                )}
              </div>
            </form>

            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
              <strong>Suggerimento:</strong> puoi copiare la tabella del calendario da Excel o Google Sheet e incollarla qui — assicurati che le colonne siano nell&apos;ordine corretto e che i nomi delle squadre corrispondano esattamente.
            </div>
          </div>

          {/* -- Ripeti calendario a campi invertiti -- */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-1">Ripeti prime 9 giornate (campi invertiti)</h2>
            <p className="text-xs text-gray-400 mb-3">
              Prende le partite gia&apos; inserite nelle giornate 1-9 (a mano, da CSV o con la
              generazione automatica) e le ripete identiche per tutte le giornate successive,
              invertendo ogni volta casa e trasferta rispetto alle prime 9. Le giornate che hanno
              gia&apos; un risultato inserito non vengono toccate.
            </p>
            <form action={repeatAction} className="flex gap-3 items-center">
              <input type="hidden" name="seasonId" value={activeSeason.id} />
              <button
                type="submit"
                disabled={repeatPending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {repeatPending ? "In corso..." : "Ripeti a campi invertiti"}
              </button>
            </form>
            {repeatResult && (
              <p className={`text-sm mt-2 ${repeatResult.startsWith("OK:") ? "text-green-600" : "text-red-600"}`}>
                {repeatResult}
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-3">Stato giornate</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2">
              {activeSeason.matchdays.map((md) => (
                <div
                  key={md.id}
                  className={`text-center p-2 rounded-lg border text-xs font-medium ${
                    md.number === activeSeason.currentMatchday
                      ? "bg-green-600 text-white border-green-600"
                      : md.votesImported
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-400 border-gray-200"
                  }`}
                >
                  <div>G{md.number}</div>
                  {md.votesImported && <div className="text-xs">✓</div>}
                  {md.isLocked && <div className="text-xs">🔒</div>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
