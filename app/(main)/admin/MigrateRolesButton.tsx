"use client";

import { useActionState } from "react";
import { migratePlayerRoles } from "@/app/actions/dbMigrate";

export default function MigrateRolesButton() {
  const [state, action, pending] = useActionState(migratePlayerRoles, null);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-700">Migrazione ruoli giocatore</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Converte i vecchi ruoli (Por, Dc, Dd, Ds…) nei nuovi (POR, DC, TER, M, OFF, ATT). Sicuro da eseguire più volte.
        </p>
      </div>
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-800 disabled:opacity-60 text-white rounded-lg text-sm font-medium whitespace-nowrap"
        >
          {pending ? "..." : "Esegui migrazione ruoli"}
        </button>
      </form>
      {state?.success && (
        <span className="text-green-600 text-sm">
          ✓ Aggiornati: {state.updated} — già ok: {state.skipped}
          {state.unknown && state.unknown.length > 0 && (
            <span className="block text-red-600">⚠️ Non riconosciuti: {state.unknown.join(", ")}</span>
          )}
        </span>
      )}
      {state?.error && <span className="text-red-600 text-sm">{state.error}</span>}
    </div>
  );
}
