"use client";

import { useActionState, useState, useMemo } from "react";
import { saveLeagueSettings, setUserCredits } from "@/app/actions/settings";
import { MIN_PORTIERI, MAX_PORTIERI, MIN_MOVIMENTO, MAX_MOVIMENTO } from "@/app/lib/leagueSettings";

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
    minWinMargin: number;
    numPortieri: number;
    numMovimento: number;
    scoreConversion: {
      enabled: boolean;
      bands: { minScore: number; goals: number }[];
      extrapolateStep: number;
      homeFirstGoalThreshold: number;
      bonusGoalEnabled: boolean;
      bonusGoalDiffBandMargin: number;
      bonusGoalSameBandMargin: number;
    };
    defenseModifierEnabled: boolean;
  };
  users: User[];
};

export default function SettingsClient({ seasonId, seasonName, settings, users }: Props) {
  const [settingsResult, settingsAction, settingsPending] = useActionState(saveLeagueSettings, null);
  const [creditsResult, creditsAction, creditsPending] = useActionState(setUserCredits, null);

  /* ── Slot rosa: portieri / movimento ──────────────────────── */
  const [numPortieri, setNumPortieri] = useState<number>(settings.numPortieri);
  const [numMovimento, setNumMovimento] = useState<number>(settings.numMovimento);

  /* ── Fattore campo ────────────────────────────────────────── */
  const [homeAdv, setHomeAdv] = useState<number>(settings.homeAdvantage);

  /* Distacco minimo per vincere */
  const [minWinMargin, setMinWinMargin] = useState<number>(settings.minWinMargin);

  /* -- Conversione punteggio -> gol (fasce personalizzabili) -- */
  const [scoreConvEnabled, setScoreConvEnabled] = useState<boolean>(settings.scoreConversion.enabled);
  const [bands, setBands] = useState<{ minScore: number; goals: number }[]>(
    settings.scoreConversion.bands.length > 0
      ? settings.scoreConversion.bands
      : [{ minScore: 66, goals: 1 }]
  );
  const [extrapolateStep, setExtrapolateStep] = useState<number>(settings.scoreConversion.extrapolateStep);

  /* Soglia fissa "quota" per il 1o gol della squadra di casa (regola
     separata dal bonus punti fattore campo qui sopra; 0 = disabilitata) */
  const [homeFirstGoalThreshold, setHomeFirstGoalThreshold] = useState<number>(
    settings.scoreConversion.homeFirstGoalThreshold
  );

  /* Regola "vittoria e gol omaggio" (distacco minimo per fascia, regola
     separata dal "distacco minimo per vincere" qui sopra) */
  const [bonusGoalEnabled, setBonusGoalEnabled] = useState<boolean>(settings.scoreConversion.bonusGoalEnabled);
  const [bonusGoalDiffBandMargin, setBonusGoalDiffBandMargin] = useState<number>(
    settings.scoreConversion.bonusGoalDiffBandMargin
  );
  const [bonusGoalSameBandMargin, setBonusGoalSameBandMargin] = useState<number>(
    settings.scoreConversion.bonusGoalSameBandMargin
  );

  /* ── Modificatore difensivo ────────────────────────────────── */
  const [defenseModEnabled, setDefenseModEnabled] = useState<boolean>(settings.defenseModifierEnabled);

  const sortedBands = useMemo(
    () => [...bands].filter((b) => !isNaN(b.minScore) && !isNaN(b.goals)).sort((a, b) => a.minScore - b.minScore),
    [bands]
  );

  const updateBand = (idx: number, field: "minScore" | "goals", value: number) => {
    setBands((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  };
  const removeBand = (idx: number) => {
    setBands((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };
  const addBand = () => {
    setBands((prev) => {
      const last = [...prev].sort((a, b) => a.minScore - b.minScore).at(-1);
      const nextMin = last ? last.minScore + (extrapolateStep || 4) : 66;
      const nextGoals = last ? last.goals + 1 : 1;
      return [...prev, { minScore: nextMin, goals: nextGoals }];
    });
  };

  /** Anteprima calcolata dalle fasce ordinate + step di estrapolazione oltre l'ultima */
  const scoreConvPreview = useMemo(() => {
    const rows: { range: string; goals: string }[] = [];
    if (sortedBands.length === 0) return rows;
    rows.push({ range: `< ${sortedBands[0].minScore} pt`, goals: "0" });
    sortedBands.forEach((band, i) => {
      const next = sortedBands[i + 1];
      if (next) {
        const high = next.minScore - 0.5;
        rows.push({
          range: high >= band.minScore ? `${band.minScore} - ${high} pt` : `${band.minScore} pt`,
          goals: String(band.goals),
        });
      } else {
        const step = extrapolateStep > 0 ? extrapolateStep : 4;
        rows.push({
          range: `>= ${band.minScore} pt`,
          goals: `${band.goals} (poi +1 ogni ${step}pt)`,
        });
      }
    });
    return rows;
  }, [sortedBands, extrapolateStep]);

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
        {/* Slot rosa */}
        <input type="hidden" name="numPortieri" value={numPortieri} />
        <input type="hidden" name="numMovimento" value={numMovimento} />
        {/* Fattore campo */}
        <input type="hidden" name="homeAdvantage" value={homeAdv} />
        {/* Distacco minimo per vincere */}
        <input type="hidden" name="minWinMargin" value={minWinMargin} />
        {/* Conversione punteggio -> gol (fasce) */}
        <input type="hidden" name="scoreConvEnabled" value={scoreConvEnabled ? "1" : "0"} />
        <input type="hidden" name="scoreConvBands" value={JSON.stringify(bands)} />
        <input type="hidden" name="scoreConvExtrapolateStep" value={extrapolateStep} />
        <input type="hidden" name="scoreConvHomeFirstGoalThreshold" value={homeFirstGoalThreshold} />
        {/* Vittoria e gol omaggio */}
        <input type="hidden" name="scoreConvBonusGoalEnabled" value={bonusGoalEnabled ? "1" : "0"} />
        <input type="hidden" name="scoreConvBonusGoalDiffBandMargin" value={bonusGoalDiffBandMargin} />
        <input type="hidden" name="scoreConvBonusGoalSameBandMargin" value={bonusGoalSameBandMargin} />
        {/* Modificatore difensivo */}
        <input type="hidden" name="defenseModifierEnabled" value={defenseModEnabled ? "1" : "0"} />

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
                max={5}
                defaultValue={settings.maxSubstitutions}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Quante riserve possono entrare automaticamente per titolari senza voto, sempre ruolo per ruolo
                rispettando il modulo (max 5)
              </p>
            </div>
          </div>
        </div>

        {/* ── Card 1b: Slot rosa ─────────────────────────────── */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-5 py-3 flex items-center gap-2">
            <span className="text-lg">👥</span>
            <h2 className="font-semibold text-gray-700">Composizione rosa</h2>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 mb-4">
              Imposta quanti slot ha ogni rosa per <strong>portieri</strong> e per{" "}
              <strong>giocatori di movimento</strong> (DC, TER, M, OFF, ATT).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Slot portieri
                </label>
                <input
                  type="number"
                  min={MIN_PORTIERI}
                  max={MAX_PORTIERI}
                  value={numPortieri}
                  onChange={(e) => setNumPortieri(parseInt(e.target.value) || MIN_PORTIERI)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Da {MIN_PORTIERI} a {MAX_PORTIERI} portieri per rosa
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Slot giocatori di movimento
                </label>
                <input
                  type="number"
                  min={MIN_MOVIMENTO}
                  max={MAX_MOVIMENTO}
                  value={numMovimento}
                  onChange={(e) => setNumMovimento(parseInt(e.target.value) || MIN_MOVIMENTO)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Da {MIN_MOVIMENTO} a {MAX_MOVIMENTO} giocatori di movimento per rosa
                </p>
              </div>
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-800">
              Totale rosa: <strong>{numPortieri + numMovimento} giocatori</strong> ({numPortieri} portieri + {numMovimento} movimento)
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
              La squadra che gioca <strong>in casa</strong> riceve un bonus sul punteggio. Il bonus si somma
              al punteggio mostrato nel tabellino (e nel risultato/gol convertiti), cosi che i punti in
              classifica corrispondano sempre al risultato che si vede.
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
                  <p className="font-semibold text-green-700 mb-2">Esempio con fattore campo = {homeAdv}pt (punteggio formazione prima del bonus):</p>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li>Casa 65pt  vs  Trasferta 64pt {"->"} tabellino {65 + homeAdv}-64 {"->"} <strong className="text-green-700">Casa vince</strong></li>
                    <li>Casa 63pt  vs  Trasferta 64pt {"->"} tabellino {63 + homeAdv}-64 {"->"} <strong className="text-green-700">Casa vince</strong> (63+{homeAdv} &gt; 64)</li>
                    <li>Casa {62}pt  vs  Trasferta 64pt {"->"} tabellino {62 + homeAdv}-64 {"->"} {62 + homeAdv > 64 ? <><strong className="text-green-700">Casa vince</strong></> : 62 + homeAdv === 64 ? <strong className="text-amber-600">Pareggio</strong> : <><strong className="text-red-600">Trasferta vince</strong></>}</li>
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

            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-sm text-gray-600 mb-3">
                <strong>Regola separata</strong>: indipendentemente dal bonus punti qui sopra, puoi fissare una
                soglia diversa (una &quot;quota&quot;) per il <strong>1o gol</strong> della sola squadra di casa,
                invece della soglia normale della prima fascia (vedi Fasce di conversione piu sotto). Le fasce
                successive (2o gol, 3o gol...) non cambiano.
              </p>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Quota 1o gol in casa
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={homeFirstGoalThreshold}
                    onChange={(e) => setHomeFirstGoalThreshold(parseFloat(e.target.value) || 0)}
                    className="w-28 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-500">
                    punti {homeFirstGoalThreshold > 0 ? `(invece di ${sortedBands[0]?.minScore ?? 66})` : ""}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Imposta <strong>0</strong> per disabilitare (si usa sempre la soglia normale della prima fascia)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2b: Distacco minimo per vincere */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-purple-50 border-b border-purple-100 px-5 py-3 flex items-center gap-2">
            <span className="text-lg">{"\u{1F4CF}"}</span>
            <h2 className="font-semibold text-gray-700">Distacco minimo per vincere</h2>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 mb-4">
              Imposta di quanti <strong>fantapunti</strong> una squadra deve staccare l&apos;avversaria per
              vincere la partita (fattore campo gia applicato). Sotto questa soglia il risultato e
              considerato <strong>pareggio</strong>, anche se un punteggio e comunque piu alto.
            </p>
            {bonusGoalEnabled && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                Hai attivato piu sotto la regola &quot;Vittoria e gol omaggio&quot;: quando e attiva,
                questa impostazione viene ignorata (si usano le soglie per fascia di quella regola).
              </p>
            )}
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Distacco minimo
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={minWinMargin}
                    onChange={(e) => setMinWinMargin(parseFloat(e.target.value) || 0)}
                    className="w-28 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-500">punti (es. 1, 2, 3)</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Imposta <strong>0</strong> per disabilitare (vince chi ha il punteggio piu alto, anche di poco)
                </p>
              </div>

              {minWinMargin > 0 ? (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm flex-1 min-w-[240px]">
                  <p className="font-semibold text-purple-700 mb-2">Esempio con distacco minimo = {minWinMargin}pt:</p>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li>
                      {(70).toFixed(1)}pt vs {(70 + Math.max(minWinMargin - 0.5, 0)).toFixed(1)}pt (distacco {Math.max(minWinMargin - 0.5, 0)}) {"->"}{" "}
                      <strong className="text-amber-600">Pareggio</strong> (sotto {minWinMargin}pt)
                    </li>
                    <li>
                      {(70).toFixed(1)}pt vs {(70 + minWinMargin).toFixed(1)}pt (distacco {minWinMargin}) {"->"}{" "}
                      <strong className="text-green-700">Vince chi ha piu punti</strong> (raggiunge il minimo)
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm flex-1 min-w-[200px]">
                  <p className="text-gray-400 text-xs">
                    {"<--"} Inserisci un valore &gt; 0 per attivare il distacco minimo
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
                {/* Editor fasce */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Fasce di conversione</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Ogni riga dice: a partire da quanti punti si ottiene quel numero di gol. Le fasce non devono
                    per forza avere la stessa larghezza (es. la 1a e la 2a possono essere piu larghe delle altre).
                  </p>
                  <div className="overflow-x-auto">
                    <table className="text-sm border-collapse w-full max-w-md">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border px-3 py-2 text-left font-medium text-gray-600">Da (pt)</th>
                          <th className="border px-3 py-2 text-left font-medium text-gray-600">Gol</th>
                          <th className="border px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {bands.map((band, idx) => (
                          <tr key={idx} className="bg-white">
                            <td className="border px-2 py-1.5">
                              <input
                                type="number"
                                step={0.5}
                                value={band.minScore}
                                onChange={(e) => updateBand(idx, "minScore", parseFloat(e.target.value))}
                                className="w-24 border rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                              />
                            </td>
                            <td className="border px-2 py-1.5">
                              <input
                                type="number"
                                min={1}
                                value={band.goals}
                                onChange={(e) => updateBand(idx, "goals", parseInt(e.target.value, 10))}
                                className="w-16 border rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                              />
                            </td>
                            <td className="border px-2 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeBand(idx)}
                                disabled={bands.length <= 1}
                                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                x
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={addBand}
                    className="mt-2 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1.5 rounded-lg font-medium"
                  >
                    + Aggiungi fascia
                  </button>
                </div>

                {/* Step di estrapolazione oltre l'ultima fascia */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Punti per ogni gol oltre l&apos;ultima fascia
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      step={0.5}
                      value={extrapolateStep}
                      onChange={(e) => setExtrapolateStep(parseFloat(e.target.value) || 4)}
                      className="w-24 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <span className="text-sm text-gray-500">pt / gol</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Dopo l&apos;ultima fascia definita sopra, ogni {extrapolateStep}pt in piu = +1 gol
                  </p>
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
                        {scoreConvPreview.map((row) => (
                          <tr key={row.range} className="bg-white even:bg-gray-50">
                            <td className="border px-4 py-2 text-gray-700 font-mono text-xs">{row.range}</td>
                            <td className="border px-4 py-2 text-center">
                              <span className="inline-block font-bold px-3 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                                {row.goals}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card 3b: Vittoria e gol omaggio */}
        {scoreConvEnabled && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="bg-pink-50 border-b border-pink-100 px-5 py-3 flex items-center gap-2">
              <span className="text-lg">{"\u{1F381}"}</span>
              <h2 className="font-semibold text-gray-700">Vittoria e gol omaggio</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Regola alternativa al &quot;Distacco minimo per vincere&quot; qui sopra: quando e attiva, decide
                lei chi vince (e la ignora). Le due squadre devono raggiungere almeno la soglia del 1o gol; poi
                serve un distacco minimo di fantapunti che dipende dal fatto che le due squadre siano nella{" "}
                <strong>stessa fascia</strong> (stessi gol) o in <strong>fasce diverse</strong>. Se il distacco e
                raggiunto, la squadra avanti vince e riceve anche un <strong>gol omaggio</strong> in piu rispetto
                a quanto darebbe la sola conversione punteggio-gol.
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBonusGoalEnabled(!bonusGoalEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                    bonusGoalEnabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                  aria-label="Attiva/disattiva vittoria e gol omaggio"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      bonusGoalEnabled ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  {bonusGoalEnabled
                    ? "\u2705 Attiva - sostituisce il distacco minimo per vincere qui sopra"
                    : "\u274C Disattiva - resta valido il distacco minimo per vincere qui sopra"}
                </span>
              </div>

              {bonusGoalEnabled && (
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Distacco minimo - fasce diverse
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.5}
                        value={bonusGoalDiffBandMargin}
                        onChange={(e) => setBonusGoalDiffBandMargin(parseFloat(e.target.value) || 0)}
                        className="w-24 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-pink-400"
                      />
                      <span className="text-sm text-gray-500">pt</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Distacco minimo - stessa fascia
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.5}
                        value={bonusGoalSameBandMargin}
                        onChange={(e) => setBonusGoalSameBandMargin(parseFloat(e.target.value) || 0)}
                        className="w-24 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-pink-400"
                      />
                      <span className="text-sm text-gray-500">pt</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Card 4: Modificatore Difensivo ──────────────────── */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-cyan-50 border-b border-cyan-100 px-5 py-3 flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <h2 className="font-semibold text-gray-700">Modificatore Difensivo</h2>
          </div>
          <div className="p-5 space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">Come funziona</p>
              <p>
                Si prende il <strong>voto</strong> (non il fantavoto) del <strong>portiere titolare</strong> e dei{" "}
                <strong>3 migliori difensori</strong> (terzini/centrali) titolari, e se ne fa la media. In base alla
                media, la squadra avversaria subisce un malus sul punteggio finale:
              </p>
              <ul className="mt-2 space-y-0.5 font-mono text-xs">
                <li>media 6 – 6.49 → <strong>-1</strong> alla squadra avversaria</li>
                <li>media 6.5 – 6.99 → <strong>-2</strong> alla squadra avversaria</li>
                <li>media 7 – 7.49 → <strong>-3</strong> alla squadra avversaria</li>
                <li>media 7.5+ → <strong>-4</strong> alla squadra avversaria</li>
              </ul>
              <p className="mt-2 text-xs text-blue-600">
                Scatta solo con una difesa a 4 (o piu) - una difesa a 3 (es. modulo 3-5-2) non da mai diritto al
                modificatore, ne come formazione di partenza ne dopo i cambi - e solo se portiere e TUTTI i
                difensori considerati sono andati regolarmente a voto (nessuno sv/assente).
              </p>
            </div>

            {/* Toggle attivazione */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDefenseModEnabled(!defenseModEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                  defenseModEnabled ? "bg-green-500" : "bg-gray-300"
                }`}
                aria-label="Attiva/disattiva modificatore difensivo"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    defenseModEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                {defenseModEnabled
                  ? "✅ Attivo — le difese solide tolgono punti all'avversario"
                  : "❌ Disattivo — nessun modificatore applicato"}
              </span>
            </div>
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
