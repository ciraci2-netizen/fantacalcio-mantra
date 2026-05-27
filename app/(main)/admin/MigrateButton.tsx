"use client";

import { useActionState } from "react";
import { runMigrations } from "@/app/actions/dbMigrate";

export default function MigrateButton() {
  const [state, action, pending] = useActionState(runMigrations, null);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-700">Inizializzazione Database</p>
        <p className="text-xs text-gray-500 mt-0.5">Crea le tabelle per Coppe e Mercato (sicuro da eseguire più volte)</p>
      </div>
      <form action={action}>
        <button type="submit" disabled={pending} className="px-4 py-2 bg-gray-700 hover:bg-gray-800 disabled:opacity-60 text-white rounded-lg text-sm font-medium whitespace-nowrap">
          {pending ? "..." : "Esegui migrazione DB"}
        </button>
      </form>
      {state?.success && <span className="text-green-600 text-sm">✓ Tabelle create</span>}
      {state?.error && <span className="text-red-600 text-sm">{state.error}</span>}
    </div>
  );
}
