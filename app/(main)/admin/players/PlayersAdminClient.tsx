"use client";

import { useActionState, useState, useEffect, useRef, type ChangeEvent } from "react";
import { createPlayer, deletePlayer, importPlayersCSV, updatePlayer } from "@/app/actions/players";
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
  POR: "bg-yellow-100 text-yellow-800",
  DC: "bg-blue-100 text-blue-800",
  TER: "bg-indigo-100 text-indigo-800",
  M: "bg-green-100 text-green-800",
  OFF: "bg-teal-100 text-teal-800",
  ATT: "bg-red-100 text-red-800",
};

export default function PlayersAdminClient({ players }: { players: Player[] }) {
  const [createError, createAction, createPending] = useActionState(createPlayer, null);
  const [deleteError, deleteAction] = useActionState(deletePlayer, null);
  const [csvResult, csvAction, csvPending] = useActionState(importPlayersCSV, null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("tutti");
  const [showForm, setShowForm] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError("");

    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        setCsvText(await file.text());
      } else {
        // .xlsx / .xls
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
        const lines = rows
          .map((row) => row.map((cell) => (cell ?? "").toString().trim()).join(","))
          .filter((line) => line.replace(/,/g, "").length > 0);
        setCsvText(lines.join("\n"));
      }
    } catch {
      setParseError("Impossibile leggere il file. Verifica che sia un .csv o .xlsx valido.");
    }
  }

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
              Esempio: SALAH,LIVERPOOL,OFF,SALAH
            </p>
          </div>
        </div>
      )}

      {showCsv && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3">Import giocatori (svincolati)</h2>
          <p className="text-xs text-gray-500 mb-3">
            Formato: <code className="bg-gray-100 px-1 rounded">NOME,SQUADRA,RUOLO,NOME_FANTAPIU3</code> — una riga per giocatore
            (l&apos;ultima colonna è opzionale). Vengono aggiunti come svincolati, non assegnati a nessuna squadra:
            per assegnarli usa poi <em>Gestione Rose</em>.<br />
            Esempio: <code className="bg-gray-100 px-1 rounded">SALAH,LIVERPOOL,OFF,SALAH</code>
          </p>

          <div className="flex items-center gap-3 flex-wrap mb-3">
            <label className="inline-flex items-center gap-2 bg-white border rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-blue-400">
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
              📂 Scegli file (.csv / .xlsx)
            </label>
            {fileName && <span className="text-sm text-gray-600">{fileName}</span>}
          </div>
          {parseError && <p className="text-sm text-red-600 mb-3">{parseError}</p>}

          <form
            action={csvAction}
            className="space-y-3"
            onSubmit={() => {
              setTimeout(() => { setCsvText(""); setFileName(""); }, 0);
            }}
          >
            <textarea
              name="csv"
              required
              rows={10}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"SALAH,LIVERPOOL,OFF\nHAALAND,MANCITY,ATT,HAALAND"}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {csvResult && (
              <div className={`px-3 py-2 rounded text-sm ${csvResult.startsWith("Importati") ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {csvResult}
              </div>
            )}
            <button
              type="submit"
              disabled={csvPending || !csvText.trim()}
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
              {filtered.map((p) =>
                editingId === p.id ? (
                  <EditPlayerRow key={p.id} player={p} onDone={() => setEditingId(null)} />
                ) : (
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
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingId(p.id)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          ✏️ Modifica
                        </button>
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
                      </div>
                    </td>
                  </tr>
                )
              )}
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

function EditPlayerRow({ player, onDone }: { player: Player; onDone: () => void }) {
  const [error, action, pending] = useActionState(updatePlayer, null);
  const wasPending = useRef(false);

  // Il salvataggio ha successo quando l'azione torna null (nessun errore) e
  // non è più in corso — a quel punto chiudiamo la riga di modifica. Va in
  // un effect (non nel corpo del render) perché aggiorna lo stato del
  // genitore (onDone → setEditingId).
  useEffect(() => {
    if (wasPending.current && !pending && error === null) {
      onDone();
    }
    wasPending.current = pending;
  }, [pending, error, onDone]);

  return (
    <tr className="bg-blue-50/50">
      <td colSpan={5} className="px-4 py-3">
        <form
          action={action}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end"
        >
          <input type="hidden" name="id" value={player.id} />
          <div>
            <label className="text-xs font-medium text-gray-500">Nome</label>
            <input
              name="name"
              defaultValue={player.name}
              required
              className="w-full border rounded-lg px-2 py-1.5 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Squadra reale</label>
            <input
              name="realTeam"
              defaultValue={player.realTeam}
              required
              className="w-full border rounded-lg px-2 py-1.5 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Ruolo Mantra</label>
            <select
              name="mantraRole"
              defaultValue={player.mantraRole}
              required
              className="w-full border rounded-lg px-2 py-1.5 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MANTRA_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Nome su Fantapiu3</label>
            <input
              name="fantapiu3Name"
              defaultValue={player.fantapiu3Name ?? ""}
              placeholder="(se diverso dal nome)"
              className="w-full border rounded-lg px-2 py-1.5 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              {pending ? "Salvataggio..." : "Salva"}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="text-gray-500 hover:text-gray-700 text-xs px-2 py-1.5"
            >
              Annulla
            </button>
          </div>
          {error && <div className="col-span-full text-red-600 text-sm">{error}</div>}
        </form>
      </td>
    </tr>
  );
}
