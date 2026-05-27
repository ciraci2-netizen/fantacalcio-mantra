"use client";

import { useState, useActionState } from "react";
import { saveBonusRow, deleteBonusRow, saveSection, deleteSection } from "@/app/actions/regolamento";

type BonusRow = { id: number; evento: string; portiere: string; difensore: string; centrocampista: string; attaccante: string };
type Section = { id: number; titolo: string; contenuto: string };

function BonusForm({ row, onDone }: { row?: BonusRow; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveBonusRow, null);
  return (
    <form action={async (fd) => { await action(fd); onDone?.(); }} className="space-y-2">
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Evento</label>
          <input type="text" name="evento" required defaultValue={row?.evento} placeholder="es. Gol segnato" className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
        </div>
        {(["portiere", "difensore", "centrocampista", "attaccante"] as const).map((campo) => (
          <div key={campo}>
            <label className="block text-xs text-gray-500 mb-1 capitalize">{campo}</label>
            <input type="text" name={campo} defaultValue={row?.[campo] ?? "—"} placeholder="—" className="w-full border rounded px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-green-500 focus:outline-none" />
          </div>
        ))}
      </div>
      {state?.error && <p className="text-red-600 text-xs">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded text-sm font-medium">
          {pending ? "..." : row ? "Salva" : "Aggiungi riga"}
        </button>
        {onDone && <button type="button" onClick={onDone} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm">Annulla</button>}
      </div>
    </form>
  );
}

function SectionForm({ section, onDone }: { section?: Section; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveSection, null);
  return (
    <form action={async (fd) => { await action(fd); onDone?.(); }} className="space-y-2">
      {section && <input type="hidden" name="id" value={section.id} />}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Titolo sezione</label>
        <input type="text" name="titolo" required defaultValue={section?.titolo} placeholder="es. Formazione" className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Contenuto <span className="text-gray-400">(usa **testo** per grassetto, - per liste, invio per andare a capo)</span></label>
        <textarea name="contenuto" required defaultValue={section?.contenuto} rows={5} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none font-mono" />
      </div>
      {state?.error && <p className="text-red-600 text-xs">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded text-sm font-medium">
          {pending ? "..." : section ? "Salva" : "Aggiungi sezione"}
        </button>
        {onDone && <button type="button" onClick={onDone} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm">Annulla</button>}
      </div>
    </form>
  );
}

export default function AdminRegolamentoClient({ bonusRows, sections }: { bonusRows: BonusRow[]; sections: Section[] }) {
  const [editingBonus, setEditingBonus] = useState<number | null>(null);
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [addingBonus, setAddingBonus] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [deleteState, deleteAction] = useActionState(deleteBonusRow, null);
  const [deleteSectionState, deleteSectionAction] = useActionState(deleteSection, null);

  const noTables = bonusRows.length === 0 && sections.length === 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Admin — Regolamento</h1>

      {noTables && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          Le tabelle non esistono ancora. Torna su <strong>Admin</strong> e clicca <strong>Esegui migrazione DB</strong> per crearle con i dati predefiniti.
        </div>
      )}

      {/* Bonus/Malus table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-green-700 text-white px-4 py-3 flex items-center justify-between">
          <span className="font-semibold">Tabella Bonus e Malus</span>
          <button onClick={() => setAddingBonus(true)} className="text-xs bg-white text-green-700 font-medium px-3 py-1 rounded hover:bg-green-50">+ Aggiungi riga</button>
        </div>

        {addingBonus && (
          <div className="p-4 border-b bg-green-50">
            <BonusForm onDone={() => setAddingBonus(false)} />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Evento</th>
                <th className="px-4 py-2 text-center">Por</th>
                <th className="px-4 py-2 text-center">Dif</th>
                <th className="px-4 py-2 text-center">Cen</th>
                <th className="px-4 py-2 text-center">Att</th>
                <th className="px-4 py-2 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bonusRows.map((row) => (
                <>
                  {editingBonus === row.id ? (
                    <tr key={`edit-${row.id}`}>
                      <td colSpan={6} className="px-4 py-3 bg-yellow-50">
                        <BonusForm row={row} onDone={() => setEditingBonus(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{row.evento}</td>
                      {[row.portiere, row.difensore, row.centrocampista, row.attaccante].map((v, i) => (
                        <td key={i} className={`px-4 py-2 text-center font-semibold ${v.startsWith("+") ? "text-green-600" : v.startsWith("-") ? "text-red-500" : "text-gray-400"}`}>{v}</td>
                      ))}
                      <td className="px-4 py-2 text-center">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => setEditingBonus(row.id)} className="text-xs text-blue-600 hover:text-blue-800">Modifica</button>
                          <form action={deleteAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <button type="submit" className="text-xs text-red-500 hover:text-red-700">Elimina</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {bonusRows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">Nessuna riga. Aggiungi la prima.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Text sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700">Sezioni di testo</h2>
          <button onClick={() => setAddingSection(true)} className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded font-medium">+ Aggiungi sezione</button>
        </div>

        {addingSection && (
          <div className="bg-white rounded-xl border p-4">
            <SectionForm onDone={() => setAddingSection(false)} />
          </div>
        )}

        {sections.map((s) => (
          <div key={s.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {editingSection === s.id ? (
              <div className="p-4">
                <SectionForm section={s} onDone={() => setEditingSection(null)} />
              </div>
            ) : (
              <>
                <div className="bg-green-700 text-white px-4 py-2 flex items-center justify-between">
                  <span className="font-semibold">{s.titolo}</span>
                  <div className="flex gap-3">
                    <button onClick={() => setEditingSection(s.id)} className="text-xs text-green-200 hover:text-white">Modifica</button>
                    <form action={deleteSectionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="text-xs text-red-300 hover:text-red-100">Elimina</button>
                    </form>
                  </div>
                </div>
                <div className="p-4 text-sm text-gray-600 whitespace-pre-wrap font-mono">{s.contenuto}</div>
              </>
            )}
          </div>
        ))}

        {sections.length === 0 && !addingSection && (
          <p className="text-gray-400 text-sm text-center py-4">Nessuna sezione. Aggiungine una.</p>
        )}
      </div>
    </div>
  );
}
