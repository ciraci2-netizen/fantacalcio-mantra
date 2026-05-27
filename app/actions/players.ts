"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { MANTRA_ROLES } from "@/app/lib/scoring";

export async function createPlayer(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const name = (formData.get("name") as string)?.trim().toUpperCase();
  const realTeam = (formData.get("realTeam") as string)?.trim().toUpperCase();
  const mantraRole = formData.get("mantraRole") as string;
  const fantapiu3Name = (formData.get("fantapiu3Name") as string)?.trim().toUpperCase() || null;

  if (!name || !realTeam || !mantraRole) return "Compila tutti i campi obbligatori.";
  if (!MANTRA_ROLES.includes(mantraRole as never)) return "Ruolo non valido.";

  await getDb().execute({
    sql: `INSERT INTO "Player" (name, realTeam, mantraRole, fantapiu3Name) VALUES (?, ?, ?, ?)`,
    args: [name, realTeam, mantraRole, fantapiu3Name],
  });
  revalidatePath("/admin/players");
  return null;
}

export async function updatePlayer(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const id = parseInt(formData.get("id") as string);
  const name = (formData.get("name") as string)?.trim().toUpperCase();
  const realTeam = (formData.get("realTeam") as string)?.trim().toUpperCase();
  const mantraRole = formData.get("mantraRole") as string;
  const fantapiu3Name = (formData.get("fantapiu3Name") as string)?.trim().toUpperCase() || null;

  if (!name || !realTeam || !mantraRole) return "Compila tutti i campi obbligatori.";

  await getDb().execute({
    sql: `UPDATE "Player" SET name = ?, realTeam = ?, mantraRole = ?, fantapiu3Name = ? WHERE id = ?`,
    args: [name, realTeam, mantraRole, fantapiu3Name, id],
  });
  revalidatePath("/admin/players");
  return null;
}

export async function deletePlayer(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const id = parseInt(formData.get("id") as string);
  const db = getDb();

  const slots = await db.execute({ sql: `SELECT ls.id FROM "LineupSlot" ls WHERE ls.playerId = ?`, args: [id] });
  for (const s of slots.rows) {
    await db.execute({ sql: `DELETE FROM "LineupSlot" WHERE id = ?`, args: [s.id] });
  }
  await db.execute({ sql: `DELETE FROM "Roster" WHERE playerId = ?`, args: [id] });
  await db.execute({ sql: `DELETE FROM "PlayerVote" WHERE playerId = ?`, args: [id] });
  await db.execute({ sql: `DELETE FROM "Player" WHERE id = ?`, args: [id] });

  revalidatePath("/admin/players");
  return null;
}

export async function importPlayersCSV(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const csv = formData.get("csv") as string;
  if (!csv) return "Nessun dato CSV fornito.";

  const lines = csv.split("\n").filter((l) => l.trim());
  let imported = 0;
  const errors: string[] = [];
  const db = getDb();

  for (const line of lines) {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 3) { errors.push(`Riga non valida: ${line}`); continue; }
    const [name, realTeam, mantraRole, fantapiu3Name] = parts;
    if (!MANTRA_ROLES.includes(mantraRole as never)) { errors.push(`Ruolo non valido per ${name}: ${mantraRole}`); continue; }
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO "Player" (name, realTeam, mantraRole, fantapiu3Name) VALUES (?, ?, ?, ?)`,
        args: [name.toUpperCase(), realTeam.toUpperCase(), mantraRole, fantapiu3Name?.toUpperCase() || null],
      });
      imported++;
    } catch { /* skip */ }
  }

  revalidatePath("/admin/players");
  if (errors.length > 0) return `Importati ${imported}. Errori: ${errors.join("; ")}`;
  return null;
}
