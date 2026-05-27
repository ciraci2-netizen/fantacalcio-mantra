"use client";

import { useActionState, useState } from "react";
import { createPlayer, deletePlayer, importPlayersCSV } from "@/app/actions/players";
import { MANTRA_ROLES } from "@/app/lib/scoring";

interface Player {
  id: number;
  name: string;
  realTeam: string;
  mantraRole: string;
  fantapiu3Name: string | null;
  assignedTo: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  Por: "bg-yellow-100 text-yellow-800",
  Dc: "bg-blue-100 text-blue-800",
  Dd: "bg-blue-100 text-blue-800",
  Ds: "bg-blue-100 text-blue-800",
  M: "bg-green-100 text-green-800",
  C: "bg-green-100 text-green-800",
  T: "bg-green-100 text-green-800",
  W: "bg-green-100 text-green-800",
  A: "bg-red-100 text-red-800",
  Pc: "bg-red-100 text-red-800",
};

export default function PlayersAdminClient({ players }: { players: Player[] }) {
  const [createError, createAction, createPending] = useActionState(createPlayer, null);
  const [deleteError, deleteAction] = useActionState(deletePlayer, null);
  const [csvResult, csvAction, csvPending] = useActionState(importPlayersCSV, null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("tutti");
  const [showForm, setShowForm] = useState(false);
  const [showCsv, setShowCsv] = useState(false);

  const filtered = players.filter(
    (p) =>
      (roleFilter === "tutti" || p.mantraRole === roleFilter) &&
      (p.name.includes(search.toUpperCase()) || p.realTeam.includes(search.toUpperCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestisci Giocatori</h1>
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-gray-500 self-center">{players.length} giocatori</span>
          <button
            onClick={() => { setShowForm(!showForm); setShowCsv(false); }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {showForm ? "Chiudi" : "+ Aggiungi"}
          </button>
          <button
            onClick={() => { setShowCsv(!showCsv); setShowForm(false); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {showCsv ? "Chiudi" : "📋 Import CSV"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Nuovo giocatore</h2>
          <form action={createAction} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Nome *</label>
              <input name="name" required placeholder="SALAH" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Squadra reale *</label>
              <input name="realTeam" required placeholder="LIVERPOOL" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Ruolo Mantra *</label>
              <select name="mantraRole" required className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                {MANTRA_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Nome su Fantapiu3</label>
              <input name="fantapiu3Name" placeholder="SALAH (se diverso)" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            {createError && (
              <div className="col-span-full text-red-600 text-sm">{createError}</div>
            )}
            <div className="col-span-full">
              <button type="submit" disabled={createPending} className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {createPending ? "Salvataggio..." : "Salva giocatore"}
              </button>
            </div>
          </form>

          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500 mb-1">
              <strong>Import CSV rapido</strong> — formato: NOME,SQUADRA,RUOLO,NOME_FANTAPIU3 (una riga per giocatore)
            </p>
            <p className="text-xs text-gray-400">
              Esempio: SALAH,LIVERPOOL,W,SALAH
            </p>
          </div>
        </div>
      )}

      {showCsv && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3">Import CSV</h2>
          <p className="text-xs text-gray-500 mb-3">
            Formato: <code className="bg-gray-100 px-1 rounded">NOME,SQUADRA,RUOLO,NOME_FANTAPIU3</code> — una riga per giocatore.<br />
            Esempio: <code className="bg-gray-100 px-1 rounded">SALAH,LIVERPOOL,W,SALAH</code>
          </p>
          <form action={csvAction} className="space-y-3">
            <textarea
              name="csv"
              required
              rows={10}
              placeholder={"SALAH,LIVERPOOL,W\nHAALAND,MANCITY,A,HAALAND"}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {csvResult && (
              <div className={`px-3 py-2 rounded text-sm ${csvResult.startsWith("Importati") ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {csvResult}
              </div>
            )}
            <button
              type="submit"
              disabled={csvPending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {csvPending ? "Importazione..." : "Importa giocatori"}
            </button>
          </form>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Cerca per nome o squadra..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="tutti">Tutti i ruoli</option>
          {MANTRA_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {deleteError && <div className="text-red-600 text-sm">{deleteError}</div>}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Giocatore</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Squadra</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Ruolo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Rosa</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-gray-500">{p.realTeam}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[p.mantraRole] ?? "bg-gray-100"}`}>
                      {p.mantraRole}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{p.assignedTo ?? "—"}</td>
                  <td className="px-4 py-2">
                    <form action={deleteAction} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="text-red-500 hover:text-red-700 text-xs"
                        onClick={(e) => {
                          if (!confirm(`Eliminare ${p.name}?`)) e.preventDefault();
                        }}
                      >
                        Elimina
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-400">Nessun giocatore trovato.</div>
          )}
        </div>
      </div>
    </div>
  );
}
