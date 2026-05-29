"use client";

import { useActionState } from "react";
import { importVotes } from "@/app/actions/votes";

export default function QuickImportButton({
  matchdayId,
  matchdayNumber,
}: {
  matchdayId: number;
  matchdayNumber: number;
}) {
  const [result, action, pending] = useActionState(importVotes, null);

  return (
    <form action={action} className="inline-flex flex-col gap-1">
      <input type="hidden" name="matchdayId" value={matchdayId} />
      <input type="hidden" name="matchdayNumber" value={matchdayNumber} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors"
      >
        {pending ? (
          <><span className="animate-spin">⏳</span> Importazione…</>
        ) : (
          <>📥 Importa voti ora</>
        )}
      </button>
      {result && (
        <p className={`text-xs px-1 ${result.startsWith("Errore") ? "text-red-600" : "text-green-700"}`}>
          {result}
        </p>
      )}
    </form>
  );
}
