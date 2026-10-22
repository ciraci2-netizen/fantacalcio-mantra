"use server";

import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { sendLineupReminders } from "@/app/lib/lineupReminders";

/** Admin: manda subito il promemoria push a chi non ha consegnato. */
export async function sendLineupRemindersNow(prevState: string | null, formData: FormData): Promise<string | null> {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const matchdayId = Number(formData.get("matchdayId"));
  if (!matchdayId) return "Giornata non valida.";

  const { missingTeams, withPush } = await sendLineupReminders(getDb(), matchdayId);
  if (missingTeams.length === 0) return "✅ Hanno consegnato tutti: nessun promemoria da mandare.";
  const noPush = missingTeams.length - withPush;
  return `📣 Promemoria inviato a ${withPush} squadr${withPush === 1 ? "a" : "e"} su ${missingTeams.length} senza formazione (${missingTeams.join(", ")}).${
    noPush > 0 ? ` ${noPush} non ha${noPush === 1 ? "" : "nno"} le notifiche attive: avvisale a mano.` : ""
  }`;
}
