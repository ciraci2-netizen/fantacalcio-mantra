"use client";

import { useActionState } from "react";
import { sendLineupRemindersNow } from "@/app/actions/reminders";

/** Tasto admin: promemoria push subito a chi non ha consegnato. */
export default function ReminderButton({ matchdayId, missing }: { matchdayId: number; missing: number }) {
  const [result, action, pending] = useActionState(sendLineupRemindersNow, null);
  return (
    <div className="space-y-1.5">
      <form action={action}>
        <input type="hidden" name="matchdayId" value={matchdayId} />
        <button
          type="submit"
          disabled={pending || missing === 0}
          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {pending ? "Invio..." : `📣 Invia promemoria ora (${missing})`}
        </button>
      </form>
      {result && <p className="text-xs text-gray-600">{result}</p>}
    </div>
  );
}
