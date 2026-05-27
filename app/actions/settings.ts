"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { DEFAULT_GOAL_THRESHOLDS } from "@/app/lib/scoring";

// ─── LeagueSettings ─────────────────────────────────────────────────────────

export async function saveLeagueSettings(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const seasonId = parseInt(formData.get("seasonId") as string);
  const initialCredits = parseInt(formData.get("initialCredits") as string) || 500;
  const maxSubstitutions = parseInt(formData.get("maxSubstitutions") as string) || 3;

  // Parse goal thresholds from form: minGoals_0, bonus_0, minGoals_1, bonus_1 ...
  const thresholds: { m: number; b: number }[] = [];
  let i = 0;
  while (formData.has(`thr_m_${i}`)) {
    const m = parseInt(formData.get(`thr_m_${i}`) as string);
    const b = parseFloat(formData.get(`thr_b_${i}`) as string);
    if (!isNaN(m) && !isNaN(b)) thresholds.push({ m, b });
    i++;
  }
  const goalThresholds = thresholds.length > 0
    ? JSON.stringify(thresholds.sort((a, b) => a.m - b.m))
    : JSON.stringify(DEFAULT_GOAL_THRESHOLDS);

  const db = getDb();
  await db.execute({
    sql: `INSERT INTO "LeagueSettings" (seasonId, initialCredits, maxSubstitutions, goalThresholds)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(seasonId) DO UPDATE SET
            initialCredits = excluded.initialCredits,
            maxSubstitutions = excluded.maxSubstitutions,
            goalThresholds = excluded.goalThresholds`,
    args: [seasonId, initialCredits, maxSubstitutions, goalThresholds],
  });

  revalidatePath("/admin/schedule");
  revalidatePath("/admin/votes");
  return null;
}

// ─── Crediti utenti ──────────────────────────────────────────────────────────

export async function setUserCredits(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const userId = parseInt(formData.get("userId") as string);
  const credits = parseInt(formData.get("credits") as string);
  if (isNaN(credits) || credits < 0) return "Crediti non validi.";

  const db = getDb();
  await db.execute({
    sql: `UPDATE "User" SET credits = ? WHERE id = ? AND isAdmin = 0`,
    args: [credits, userId],
  });

  revalidatePath("/admin/users");
  revalidatePath("/team");
  return null;
}

// ─── Logo squadra ───────────────────────────────────────────────────────────

export async function setTeamLogo(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const userId = parseInt(formData.get("userId") as string);
  const logoData = (formData.get("logoData") as string)?.trim();

  if (!logoData) {
    // Rimuovi logo
    await getDb().execute({ sql: `UPDATE "User" SET logoUrl = NULL WHERE id = ?`, args: [userId] });
  } else {
    // Accetta solo data URL (base64)
    if (!logoData.startsWith("data:image/")) return "Formato immagine non valido.";
    if (logoData.length > 500_000) return "Immagine troppo grande (max ~375KB).";
    await getDb().execute({ sql: `UPDATE "User" SET logoUrl = ? WHERE id = ?`, args: [logoData, userId] });
  }

  revalidatePath("/admin/roster");
  revalidatePath("/admin/users");
  revalidatePath("/standings");
  revalidatePath("/team");
  revalidatePath("/squadre");
  return null;
}

// ─── PlayerStatus (disponibilità) ───────────────────────────────────────────

export async function setPlayerStatus(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const playerId = parseInt(formData.get("playerId") as string);
  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const status = (formData.get("status") as string) || "ok";

  if (!["ok", "inj", "sus"].includes(status)) return "Stato non valido.";

  const db = getDb();
  if (status === "ok") {
    await db.execute({
      sql: `DELETE FROM "PlayerStatus" WHERE playerId = ? AND matchdayId = ?`,
      args: [playerId, matchdayId],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO "PlayerStatus" (playerId, matchdayId, status)
            VALUES (?, ?, ?)
            ON CONFLICT(playerId, matchdayId) DO UPDATE SET status = excluded.status`,
      args: [playerId, matchdayId, status],
    });
  }

  revalidatePath("/admin/votes");
  revalidatePath("/lineup");
  return null;
}
