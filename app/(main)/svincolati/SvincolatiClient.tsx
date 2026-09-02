"use client";

import { useState } from "react";
import Link from "next/link";
import { MANTRA_ROLES } from "@/app/lib/scoring";

const ROLE_COLORS: Record<string, string> = {
  POR: "bg-yellow-100 text-yellow-800",
  DC: "bg-blue-100 text-blue-800",
  TER: "bg-indigo-100 text-indigo-800",
  M: "bg-green-100 text-green-800",
  OFF: "bg-teal-100 text-teal-800",
  ATT: "bg-red-100 text-red-800",
};

type Player = { id: number; name: string; realTeam: string; mantraRole: string };

export default function SvincolatiClient({
  players,
  countByRole,
  roleLabel,
  isAdmin,
}: {
  players: Player[];
  countByRole: Record<string, number>;
  roleLabel: Record<string, string>;
  isAdmin?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("tutti");
  const [view, setView] = useState<"list" | "byRole">("byRole");

  const filtered = players.filter(
    (p) =>
      (roleFilter === "tutti" || p.mantraRole === roleFilter) &&
      (search === "" ||
        p.name.toUpperCase().includes(search.toUpperCase()) ||
        p.realTeam.toUpperCase().includes(search.toUpperCase()))
  );

  const byRole: Record<string, Player[]> = {};
  for (const p of filtered) {
    if (!byRole[p.mantraRole]) byRole[p.mantraRole] = [];
    byRole[p.mantraRole].push(p);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Svincolati</h1>
          <p className="text-gray-500 text-sm mt-0.5">{players.length} giocatori non assegnati a nessuna squadra</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link
              href="/admin/players"
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
            >
              🛠️ Importa/gestisci giocatori
            </Link>
          )}
          <button
            onClick={() => setView("byRole")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${view === "byRole" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Per ruolo
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${view === "list" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Lista
          </button>
        </div>
      </div>

      {/* Riepilogo ruoli */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setRoleFilter("tutti")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${roleFilter === "tutti" ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          Tutti ({players.length})
        </button>
        {MANTRA_ROLES.filter((r) => (countByRole[r] ?? 0) > 0).map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r === roleFilter ? "tutti" : r)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${roleFilter === r ? ROLE_COLORS[r] + " border-current" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}
          >
            {r} <span className="ml-1 font-bold">{countByRole[r]}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cerca per nome o squadra reale..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:w-80 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
          <div className="text-3xl mb-2">🔍</div>
          <p>Nessun giocatore trovato.</p>
        </div>
      ) : view === "byRole" ? (
        /* Vista per ruolo */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {MANTRA_ROLES.filter((r) => byRole[r]?.length > 0).map((role) => (
            <div key={role} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className={`px-4 py-2.5 flex items-center justify-between ${ROLE_COLORS[role]} border-b`}>
                <span className="font-bold text-sm">{role}</span>
                <span className="text-xs opacity-70">{roleLabel[role]} · {byRole[role].length}</span>
              </div>
              <ul className="divide-y">
                {byRole[role].map((p) => (
                  <li key={p.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.realTeam}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        /* Vista lista flat */
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Giocatore</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Squadra reale</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Ruolo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{p.realTeam}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[p.mantraRole] ?? "bg-gray-100"}`}>
                        {p.mantraRole}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
