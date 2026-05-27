"use client";

import { useActionState, useState } from "react";
import { saveLeagueSettings, setUserCredits } from "@/app/actions/settings";

type GoalThreshold = { m: number; b: number };

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
    goalThresholds: GoalThreshold[];
  };
  users: User[];
};

export default function SettingsClient({ seasonId, seasonName, settings, users }: Props) {
  const [settingsResult, settingsAction, settingsPending] = useActionState(saveLeagueSettings, null);
  const [creditsResult, creditsAction, creditsPending] = useActionState(setUserCredits, null);

  const [thresholds, setThresholds] = useState<GoalThreshold[]>(settings.goalThresholds);

  const updateThreshold = (idx: number, field: "m" | "b", val: string) => {
    setThresholds((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: parseFloat(val) || 0 } : t));
  };
  const addThreshold = () => setThresholds((prev) => [...prev, { m: prev.length + 3, b: 0 }]);
  const removeThreshold = (idx: number) => setThresholds((prev) => prev.filter((_, i) => i !== idx));

  if (!seasonId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Impostazioni Lega</h1>
        <p className="text-amber-600">Nessuna stagione attiva. Crea una stagione prima.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Impostazioni Lega</h1>
      <p className="text-gray-500 text-sm -mt-4">Stagione: <strong>{seasonName}</strong></p>

      {/* ── Impostazioni generali ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Regole di gioco</h2>
        <form action={settingsAction} className="space-y-5">
          <input type="hidden" name="seasonId" value={seasonId} />
          {thresholds.map((t, i) => (
            <input key={i} type="hidden" name={`thr_m_${i}`} value={t.m} />
          ))}
          {thresholds.map((t, i) => (
            <input key={i} type="hidden" name={`thr_b_${i}`} value={t.b} />
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Crediti iniziali per squadra</label>
              <input
                name="initialCredits"
                type="number"
                min={0}
                defaultValue={settings.initialCredits}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Max sostituzioni automatiche</label>
              <input
                name="maxSubstitutions"
                type="number"
                min={0}
                max={11}
                defaultValue={settings.maxSubstitutions}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">Numero massimo di riserve che entrano automaticamente per titolari senza voto</p>
            </div>
          </div>

          {/* Soglie gol */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Soglie Gol</label>
              <button type="button" onClick={addThreshold} className="text-xs text-green-600 hover:underline">
                + Aggiungi soglia
              </button>
            </div>
            <div className="space-y-2">
              {thresholds.sort((a, b) => a.m - b.m).map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-gray-400 w-6">≥</span>
                    <input
                      type="number"
                      value={t.m}
                      onChange={(e) => updateThreshold(i, "m", e.target.value)}
                      className="w-16 border rounded px-2 py-1 text-sm text-center"
                      placeholder="Gol"
                    />
                    <span className="text-xs text-gray-400">gol →</span>
                    <input
                      type="number"
                      step="0.5"
                      value={t.b}
                      onChange={(e) => updateThreshold(i, "b", e.target.value)}
                      className="w-20 border rounded px-2 py-1 text-sm text-center"
                      placeholder="Bonus"
                    />
                    <span className="text-xs text-gray-400">pt</span>
                  </div>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      t.b > 0 ? "bg-green-100 text-green-700" : t.b < 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t.b > 0 ? "+" : ""}{t.b}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeThreshold(i)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Bonus/malus applicato al punteggio in base ai gol segnati dai titolari</p>
          </div>

          {settingsResult && (
            <p className="text-red-600 text-sm">{settingsResult}</p>
          )}
          <button
            type="submit"
            disabled={settingsPending}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium"
          >
            {settingsPending ? "Salvataggio..." : "Salva impostazioni"}
          </button>
        </form>
      </div>

      {/* ── Crediti squadre ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Crediti squadre</h2>
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
                <th className="px-4 py-2.5 text-left font-medium text-gray-500">Imposta</th>
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
                    <span className={`font-bold ${u.credits - u.spent >= 0 ? "text-green-600" : "text-red-600"}`}>
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
  );
}
