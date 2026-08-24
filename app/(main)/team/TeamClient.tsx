"use client";

import { useState, useMemo } from "react";
import { MANTRA_ROLES } from "@/app/lib/scoring";

const ROLE_BG: Record<string, string> = {
  POR: "bg-yellow-100 text-yellow-800 border-yellow-300",
  DC:  "bg-blue-100 text-blue-800 border-blue-300",
  TER: "bg-indigo-100 text-indigo-800 border-indigo-300",
  M:   "bg-green-100 text-green-800 border-green-300",
  OFF: "bg-teal-100 text-teal-800 border-teal-300",
  ATT: "bg-red-100 text-red-800 border-red-300",
};

const ROLE_LABEL: Record<string, string> = {
  POR: "Portieri",
  DC:  "Difensori Centrali",
  TER: "Terzini",
  M:   "Mediani",
  OFF: "Offensivi",
  ATT: "Attaccanti",
};

// Macro groupings for the filter bar
const MACRO_FILTERS = [
  { key: "all",  label: "Tutti",     roles: MANTRA_ROLES },
  { key: "P",    label: "🧤 P",      roles: ["POR"] },
  { key: "D",    label: "🛡 D",      roles: ["DC", "TER"] },
  { key: "C",    label: "🎯 C",      roles: ["M", "OFF"] },
  { key: "A",    label: "⚡ A",      roles: ["ATT"] },
] as const;

type MacroKey = (typeof MACRO_FILTERS)[number]["key"];
type SortKey  = "nome" | "prezzo_asc" | "prezzo_desc";

interface RosterItem {
  id: number;
  purchasePrice: number;
  player: { mantraRole: string; name: string; realTeam: string };
}

interface Props {
  roster: RosterItem[];
  totalCredits?: number;
}

export default function TeamClient({ roster, totalCredits = 500 }: Props) {
  const [macro, setMacro]   = useState<MacroKey>("all");
  const [sort, setSort]     = useState<SortKey>("nome");
  const [search, setSearch] = useState("");

  const allowedRoles = useMemo(
    () => MACRO_FILTERS.find((f) => f.key === macro)?.roles ?? MANTRA_ROLES,
    [macro]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roster.filter(
      (r) =>
        allowedRoles.includes(r.player.mantraRole as never) &&
        (q === "" ||
          r.player.name.toLowerCase().includes(q) ||
          r.player.realTeam.toLowerCase().includes(q))
    );
  }, [roster, allowedRoles, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sort === "nome")         copy.sort((a, b) => a.player.name.localeCompare(b.player.name));
    if (sort === "prezzo_asc")   copy.sort((a, b) => a.purchasePrice - b.purchasePrice);
    if (sort === "prezzo_desc")  copy.sort((a, b) => b.purchasePrice - a.purchasePrice);
    return copy;
  }, [filtered, sort]);

  // Group sorted results by mantraRole in canonical order
  const byRole: Record<string, RosterItem[]> = {};
  for (const r of sorted) {
    if (!byRole[r.player.mantraRole]) byRole[r.player.mantraRole] = [];
    byRole[r.player.mantraRole].push(r);
  }
  const roleKeys = MANTRA_ROLES.filter((r) => byRole[r]?.length > 0);

  const totalSpent = useMemo(() => roster.reduce((sum, r) => sum + r.purchasePrice, 0), [roster]);
  const creditPct = Math.min(100, Math.round((totalSpent / totalCredits) * 100));
  const creditsLeft = totalCredits - totalSpent;

  return (
    <div className="space-y-4">
      {/* ── Budget bar ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm px-4 py-3">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="font-semibold text-gray-700">💰 Budget</span>
          <span className={`font-bold ${creditsLeft >= 0 ? "text-green-600" : "text-red-600"}`}>
            {creditsLeft >= 0 ? `${creditsLeft}M rimasti` : `${Math.abs(creditsLeft)}M sforati`}
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              creditPct >= 95 ? "bg-red-500" : creditPct >= 80 ? "bg-amber-400" : "bg-green-500"
            }`}
            style={{ width: `${creditPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{totalSpent}M spesi · {roster.length} giocatori</span>
          <span>{totalCredits}M totali</span>
        </div>
      </div>

      {/* ── Filter / sort bar ─────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm p-3 flex flex-wrap items-center gap-3">
        {/* Macro role buttons */}
        <div className="flex gap-1.5 flex-wrap">
          {MACRO_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setMacro(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                macro === f.key
                  ? "bg-green-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
              <span className="ml-1 opacity-60">
                ({roster.filter((r) => f.roles.includes(r.player.mantraRole as never)).length})
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 hidden sm:block" />

        {/* Sort */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-400 font-medium">Ordina:</span>
          {(
            [
              { key: "nome",        label: "A→Z" },
              { key: "prezzo_desc", label: "Prezzo ↓" },
              { key: "prezzo_asc",  label: "Prezzo ↑" },
            ] as { key: SortKey; label: string }[]
          ).map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                sort === s.key
                  ? "bg-blue-100 text-blue-700 font-semibold"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="ml-auto">
          <input
            type="search"
            placeholder="Cerca giocatore…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 w-40"
          />
        </div>
      </div>

      {/* ── Results count ──────────────────────────────────── */}
      {(search || macro !== "all") && (
        <p className="text-xs text-gray-400 px-1">
          {sorted.length} giocator{sorted.length === 1 ? "e" : "i"} trovati
          {search && ` per "${search}"`}
        </p>
      )}

      {/* ── Grid of role cards ────────────────────────────── */}
      {sorted.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border p-8 text-center text-gray-400">
          <p className="text-2xl mb-2">🔍</p>
          <p className="text-sm">Nessun giocatore trovato.</p>
          <button
            onClick={() => { setMacro("all"); setSearch(""); }}
            className="mt-3 text-xs text-green-600 hover:underline"
          >
            Reimposta filtri
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roleKeys.map((role) => (
            <div key={role} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className={`px-4 py-2.5 flex items-center justify-between border-b ${ROLE_BG[role]}`}>
                <span className="font-bold text-sm">{role}</span>
                <span className="text-xs opacity-70">
                  {ROLE_LABEL[role]} · {byRole[role].length}
                </span>
              </div>
              <ul className="divide-y">
                {byRole[role].map((r) => (
                  <li
                    key={r.id}
                    className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{r.player.name}</p>
                      <p className="text-xs text-gray-400">{r.player.realTeam}</p>
                    </div>
                    {r.purchasePrice > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-2 shrink-0">
                        {r.purchasePrice}M
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
