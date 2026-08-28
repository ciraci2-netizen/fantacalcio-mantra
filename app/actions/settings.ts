"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { DEFAULT_GOAL_THRESHOLDS, DEFAULT_SCORE_CONVERSION } from "@/app/lib/scoring";
import {
  MIN_PORTIERI, MAX_PORTIERI, DEFAULT_PORTIERI,
  MIN_MOVIMENTO, MAX_MOVIMENTO, DEFAULT_MOVIMENTO,
} from "@/app/lib/leagueSettings";

// ─── LeagueSettings ─────────────────────────────────────────────────────────

export async function saveLeagueSettings(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const seasonId = parseInt(formData.get("seasonId") as string);
  const initialCredits = parseInt(formData.get("initialCredits") as string) || 500;
  const maxSubstitutions = parseInt(formData.get("maxSubstitutions") as string) || 3;
  const homeAdvantage = parseFloat(formData.get("homeAdvantage") as string) || 0;

  // Slot rosa: portieri e giocatori di movimento (range fissi validati qui)
  const numPortieriRaw = parseInt(formData.get("numPortieri") as string);
  const numPortieri = isNaN(numPortieriRaw) ? DEFAULT_PORTIERI : numPortieriRaw;
  if (numPortieri < MIN_PORTIERI || numPortieri > MAX_PORTIERI) {
    return `Il numero di portieri deve essere tra ${MIN_PORTIERI} e ${MAX_PORTIERI}.`;
  }

  const numMovimentoRaw = parseInt(formData.get("numMovimento") as string);
  const numMovimento = isNaN(numMovimentoRaw) ? DEFAULT_MOVIMENTO : numMovimentoRaw;
  if (numMovimento < MIN_MOVIMENTO || numMovimento > MAX_MOVIMENTO) {
    return `Il numero di giocatori di movimento deve essere tra ${MIN_MOVIMENTO} e ${MAX_MOVIMENTO}.`;
  }

  // Goal thresholds — disabled by default (no bonus), preserved for backward compat
  const goalThresholds = JSON.stringify(DEFAULT_GOAL_THRESHOLDS);

  // Score-to-goals conversion (Mantra system)
  const scoreConvEnabled = formData.get("scoreConvEnabled") === "1";
  const scoreConvMinScore = parseFloat(formData.get("scoreConvMinScore") as string) || DEFAULT_SCORE_CONVERSION.minScore;
  const scoreConvStep = parseFloat(formData.get("scoreConvStep") as string) || DEFAULT_SCORE_CONVERSION.step;
  const scoreConversion = JSON.stringify({
    enabled: scoreConvEnabled,
    minScore: scoreConvMinScore,
    step: scoreConvStep,
  });

  const db = getDb();
  await db.execute({
    sql: `INSERT INTO "LeagueSettings" (seasonId, initialCredits, maxSubstitutions, goalThresholds, homeAdvantage, scoreConversion, numPortieri, numMovimento)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(seasonId) DO UPDATE SET
            initialCredits    = excluded.initialCredits,
            maxSubstitutions  = excluded.maxSubstitutions,
            goalThresholds    = excluded.goalThresholds,
            homeAdvantage     = excluded.homeAdvantage,
            scoreConversion   = excluded.scoreConversion,
            numPortieri       = excluded.numPortieri,
            numMovimento      = excluded.numMovimento`,
    args: [seasonId, initialCredits, maxSubstitutions, goalThresholds, homeAdvantage, scoreConversion, numPortieri, numMovimento],
  });

  revalidatePath("/admin/schedule");
  revalidatePath("/admin/votes");
  revalidatePath("/admin/settings");
  return "ok";
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
