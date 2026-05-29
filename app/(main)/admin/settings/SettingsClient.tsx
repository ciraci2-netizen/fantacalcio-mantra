"use client";

import { useActionState, useState, useMemo } from "react";
import { saveLeagueSettings, setUserCredits } from "@/app/actions/settings";

type User = {
  id: number;
  teamName: string;
  username: string;
  credits: number;
  spent: number;
  rosterCount: number;
};

type Props = {
  seasonId: number | null;
  seasonName: string | null;
  settings: {
    initialCredits: number;
    maxSubstitutions: number;
    homeAdvantage: number;
    scoreConversion: {
      enabled: boolean;
      minScore: number;
      step: number;
    };
  };
  users: User[];
};

export default function SettingsClient({ seasonId, seasonName, settings, users }: Props) {
  const [settingsResult, settingsAction, settingsPending] = useActionState(saveLeagueSettings, null);
  const [creditsResult, creditsAction, creditsPending] = useActionState(setUserCredits, null);

  /* ── Fattore campo ────────────────────────────────────────── */
  const [homeAdv, setHomeAdv] = useState<number>(settings.homeAdvantage);

  /* ── Conversione punteggio → gol ──────────────────────────── */
  const [scoreConvEnabled, setScoreConvEnabled] = useState<boolean>(settings.scoreConversion.enabled);
  const [minScore, setMinScore] = useState<number>(settings.scoreConversion.minScore);
  const [convStep, setConvStep] = useState<number>(settings.scoreConversion.step);

  /** Anteprima: [etichetta range, gol] */
  const scoreConvPreview = useMemo(() => {
    const rows: [string, number][] = [];
    // 0 gol: tutto ciò che è sotto minScore
    rows.push([`0 – ${minScore - 0.5} pt`, 0]);
    for (let g = 1; g <= 6; g++) {
      const low = minScore + (g - 1) * convStep;
      const high = minScore + g * convStep - 0.5;
      rows.push([`${low} – ${high} pt`, g]);
    }
    return rows;
  }, [minScore, convStep]);

  if (!seasonId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Impostazioni Lega</h1>
        <p className="text-amber-600">Nessuna stagione attiva. Crea una stagione prima.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Impostazioni Lega</h1>
        <p className="text-gray-500 text-sm mt-1">Stagione: <strong>{seasonName}</strong></p>
      </div>

      <form action={settingsAction} className="space-y-6">
        <input type="hidden" name="seasonId" value={seasonId} />
        {/* Fattore campo */}
        <input type="hidden" name="homeAdvantage" value={homeAdv} />
        {/* Conversione punteggio → gol */}
        <input type="hidden" name="scoreConvEnabled" value={scoreConvEnabled ? "1" : "0"} />
        <input type="hidden" name="scoreConvMinScore" value={minScore} />
        <input type="hidden" name="scoreConvStep" value={convStep} />

        {/* ── Card 1: Impostazioni base ──────────────────────── */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b px-5 py-3">
            <h2 className="font-semibold text-gray-700">⚙️ Impostazioni generali</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Crediti iniziali per squadra
              </label>
              <input
                name="initialCredits"
                type="number"
                min={0}
                defaultValue={settings.initialCredits}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">Crediti assegnati a ogni team all'inizio della stagione</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Max sostituzioni automatiche
              </label>
              <input
                name="maxSubstitutions"
                type="number"
                min={0}
                max={11}
                defaultValue={settings.maxSubstitutions}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">Quante riserve possono entrare automaticamente per titolari senza voto (es. 3)</p>
            </div>
          </div>
        </div>

        {/* ── Card 2: Fattore campo ──────────────────────────── */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-green-50 border-b border-green-100 px-5 py-3 flex items-center gap-2">
            <span className="text-lg">🏠</span>
            <h2 className="font-semibold text-gray-700">Fattore campo</h2>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 mb-4">
              La squadra che gioca <strong>in casa</strong> riceve un bonus sul punteggio per il calcolo
              di vittoria/pareggio/sconfitta. Il punteggio visualizzato rimane invariato.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Bonus punti per la squadra di casa
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={homeAdv}
                    onChange={(e) => setHomeAdv(parseFloat(e.target.value) || 0)}
                    className="w-28 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-500">punti</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Imposta <strong>0</strong> per disabilitare il fattore campo
                </p>
              </div>

              {homeAdv > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm flex-1 min-w-[240px]">
                  <p className="font-semibold text-green-700 mb-2">Esempio con fattore campo = {homeAdv}pt:</p>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li>🏠 Casa 65pt  vs  ✈️ Trasferta 64pt → <strong className="text-green-700">Casa vince</strong> (65 &gt; 64)</li>
                    <li>🏠 Casa 63pt  vs  ✈️ Trasferta 64pt → <strong className="text-green-700">Casa vince</strong> (63+{homeAdv} &gt; 64)</li>
                    <li>🏠 Casa {62}pt  vs  ✈️ Trasferta 64pt → {62 + homeAdv > 64 ? <><strong className="text-green-700">Casa vince</strong></> : 62 + homeAdv === 64 ? <strong className="text-amber-600">Pareggio</strong> : <><strong className="text-red-600">Trasferta vince</strong></>} ({62}+{homeAdv}={62 + homeAdv} vs 64)</li>
                  </ul>
                </div>
              )}
              {homeAdv === 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm flex-1 min-w-[200px]">
                  <p className="text-gray-400 text-xs">
                    ⬅️ Inserisci un valore &gt; 0 per attivare il fattore campo
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Card 3: Conversione Punteggio → Gol ───────────── */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-orange-50 border-b border-orange-100 px-5 py-3 flex items-center gap-2">
            <span className="text-lg">⚽</span>
            <h2 className="font-semibold text-gray-700">Conversione Punteggio → Gol</h2>
          </div>
          <div className="p-5 space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">Sistema Mantra — come funziona</p>
              <p>
                Il <strong>punteggio totale</strong> della tua formazione viene convertito in <strong>gol</strong>.
                I risultati vengono mostrati come un vero punteggio calcistico (es. <strong>2–1</strong>, <strong>1–0</strong>).
              </p>
              <p className="mt-1 text-xs text-blue-600">
                Esempio: casa 72pt → 2 gol, trasferta 67pt → 1 gol → risultato <strong>2–1</strong>
              </p>
            </div>

            {/* Toggle attivazione */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setScoreConvEnabled(!scoreConvEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                  scoreConvEnabled ? "bg-green-500" : "bg-gray-300"
                }`}
                aria-label="Attiva/disattiva conversione"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    scoreConvEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                {scoreConvEnabled
                  ? "✅ Attiva — i risultati mostrano i gol (es. 2–1)"
                  : "❌ Disattiva — i risultati mostrano i punteggi (es. 72.5–67.0)"}
              </span>
            </div>

            {scoreConvEnabled && (
              <>
                {/* Parametri formula */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Parametri della conversione</h3>
                  <div className="flex flex-wrap items-end gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Punteggio per il 1° gol
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={50}
                          max={80}
                          step={0.5}
                          value={minScore}
                          onChange={(e) => setMinScore(parseFloat(e.target.value) || 66)}
                          className="w-24 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                        <span className="text-sm text-gray-500">pt</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Sotto questo valore = 0 gol
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Punti per ogni gol aggiuntivo
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={10}
                          step={0.5}
                          value={convStep}
                          onChange={(e) => setConvStep(parseFloat(e.target.value) || 4)}
                          className="w-24 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                        <span className="text-sm text-gray-500">pt / gol</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Ogni {convStep}pt in più = +1 gol
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tabella anteprima */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Anteprima conversione
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="text-sm border-collapse w-full max-w-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border px-4 py-2 text-left font-medium text-gray-600">Punteggio formazione</th>
                          <th className="border px-4 py-2 text-center font-medium text-gray-600">Gol segnati</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoreConvPreview.map(([range, goals]) => (
                          <tr key={range} className={goals % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="border px-4 py-2 text-gray-700 font-mono text-xs">{range}</td>
                            <td className="border px-4 py-2 text-center">
                              <span
                                className={`inline-block font-bold px-3 py-0.5 rounded-full text-xs ${
                                  goals === 0
                                    ? "bg-gray-100 text-gray-500"
                                    : goals >= 3
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {goals} {goals === 1 ? "gol" : "gol"}
                              </span>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 text-xs text-gray-400 italic">
                          <td className="border px-4 py-1.5 text-gray-500">≥ {minScore + 6 * convStep} pt</td>
                          <td className="border px-4 py-1.5 text-center">7+ gol</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Submit ────────────────────────────────────────────── */}
        {settingsResult && settingsResult !== "ok" && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {settingsResult}
          </p>
        )}
        {settingsResult === "ok" && (
          <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3 font-medium">
            ✓ Impostazioni salvate con successo
          </p>
        )}

        <button
          type="submit"
          disabled={settingsPending}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors w-full sm:w-auto"
        >
          {settingsPending ? "Salvataggio in corso..." : "💾 Salva impostazioni"}
        </button>
      </form>

      {/* ── Card 4: Crediti squadre ───────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gray-50 border-b px-5 py-3">
          <h2 className="font-semibold text-gray-700">💰 Crediti squadre</h2>
        </div>
        <div className="p-5">
          {creditsResult && (
            <p className="text-red-600 text-sm mb-3">{creditsResult}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Squadra</th>
                  <th className="px-4 py-2.5 text-center font-medium text-gray-500">Giocatori</th>
                  <th className="px-4 py-2.5 text-center font-medium text-gray-500">Spesi</th>
                  <th className="px-4 py-2.5 text-center font-medium text-gray-500">Crediti totali</th>
                  <th className="px-4 py-2.5 text-center font-medium text-gray-500">Rimanenti</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Modifica</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <span className="font-medium">{u.teamName}</span>
                      <span className="text-gray-400 text-xs ml-1">@{u.username}</span>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-500">{u.rosterCount}</td>
                    <td className="px-4 py-2 text-center text-amber-600 font-medium">{u.spent}</td>
                    <td className="px-4 py-2 text-center font-bold text-gray-700">{u.credits}</td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`font-bold ${
                          u.credits - u.spent >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {u.credits - u.spent}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <form action={creditsAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <input
                          name="credits"
                          type="number"
                          min={0}
                          defaultValue={u.credits}
                          className="w-20 border rounded px-2 py-1 text-sm text-center"
                        />
                        <button
                          type="submit"
                          disabled={creditsPending}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded font-medium disabled:opacity-60"
                        >
                          Salva
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
