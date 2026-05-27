"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.isAdmin) throw new Error("Non autorizzato");
}

export async function saveBonusRow(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const id = formData.get("id") ? Number(formData.get("id")) : null;
    const evento = formData.get("evento") as string;
    const portiere = (formData.get("portiere") as string) || "—";
    const difensore = (formData.get("difensore") as string) || "—";
    const centrocampista = (formData.get("centrocampista") as string) || "—";
    const attaccante = (formData.get("attaccante") as string) || "—";

    if (id) {
      await db.execute({
        sql: `UPDATE "BonusMalusRule" SET evento=?, portiere=?, difensore=?, centrocampista=?, attaccante=? WHERE id=?`,
        args: [evento, portiere, difensore, centrocampista, attaccante, id],
      });
    } else {
      const maxRes = await db.execute(`SELECT COALESCE(MAX(sortOrder),0) as m FROM "BonusMalusRule"`);
      const sortOrder = Number(maxRes.rows[0].m) + 1;
      await db.execute({
        sql: `INSERT INTO "BonusMalusRule" (evento, portiere, difensore, centrocampista, attaccante, sortOrder) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [evento, portiere, difensore, centrocampista, attaccante, sortOrder],
      });
    }
    revalidatePath("/regolamento");
    revalidatePath("/admin/regolamento");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteBonusRow(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    await db.execute({ sql: `DELETE FROM "BonusMalusRule" WHERE id=?`, args: [Number(formData.get("id"))] });
    revalidatePath("/regolamento");
    revalidatePath("/admin/regolamento");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function saveSection(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    const id = formData.get("id") ? Number(formData.get("id")) : null;
    const titolo = formData.get("titolo") as string;
    const contenuto = formData.get("contenuto") as string;

    if (id) {
      await db.execute({
        sql: `UPDATE "RegolamentoSection" SET titolo=?, contenuto=? WHERE id=?`,
        args: [titolo, contenuto, id],
      });
    } else {
      const maxRes = await db.execute(`SELECT COALESCE(MAX(sortOrder),0) as m FROM "RegolamentoSection"`);
      const sortOrder = Number(maxRes.rows[0].m) + 1;
      await db.execute({
        sql: `INSERT INTO "RegolamentoSection" (titolo, contenuto, sortOrder) VALUES (?, ?, ?)`,
        args: [titolo, contenuto, sortOrder],
      });
    }
    revalidatePath("/regolamento");
    revalidatePath("/admin/regolamento");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteSection(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const db = getDb();
    await db.execute({ sql: `DELETE FROM "RegolamentoSection" WHERE id=?`, args: [Number(formData.get("id"))] });
    revalidatePath("/regolamento");
    revalidatePath("/admin/regolamento");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
