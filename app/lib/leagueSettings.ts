import type { Client } from "@libsql/client/http";
import { DEFAULT_SCORE_CONVERSION, normalizeScoreConversion, type ScoreConversion } from "./scoring";

/**
 * Limiti configurabili per la composizione delle rose, divisi per slot
 * portieri e slot giocatori di movimento (DC/TER/M/OFF/ATT). L'admin può
 * impostare un valore libero all'interno di questi range da Impostazioni Lega.
 */
export const MIN_PORTIERI = 3;
export const MAX_PORTIERI = 8;
export const DEFAULT_PORTIERI = 3;

export const MIN_MOVIMENTO = 21;
export const MAX_MOVIMENTO = 26;
export const DEFAULT_MOVIMENTO = 23;

export interface RosterLimits {
  numPortieri: number;
  numMovimento: number;
}

/**
 * Legge i limiti di rosa (slot portieri / slot movimento) impostati
 * dall'admin per la stagione attiva. Ritorna i default se non c'è una
 * stagione attiva, le colonne non sono ancora migrate, o i valori non
 * sono impostati.
 */
export async function getRosterLimits(db: Client): Promise<RosterLimits> {
  try {
    const seasonRes = await db.execute(`SELECT id FROM "Season" WHERE isActive = 1 LIMIT 1`);
    const seasonId = seasonRes.rows[0]?.id as number | undefined;
    if (!seasonId) return { numPortieri: DEFAULT_PORTIERI, numMovimento: DEFAULT_MOVIMENTO };

    const settingsRes = await db.execute({
      sql: `SELECT numPortieri, numMovimento FROM "LeagueSettings" WHERE seasonId = ?`,
      args: [seasonId],
    });
    const row = settingsRes.rows[0];
    return {
      numPortieri: (row?.numPortieri as number) ?? DEFAULT_PORTIERI,
      numMovimento: (row?.numMovimento as number) ?? DEFAULT_MOVIMENTO,
    };
  } catch {
    return { numPortieri: DEFAULT_PORTIERI, numMovimento: DEFAULT_MOVIMENTO };
  }
}

/**
 * Regole di lega che decidono un risultato (distacco minimo per vincere,
 * bonus gol per fascia) - usate per calcolare al volo i risultati delle
 * partite di coppa con le STESSE regole del campionato (vedi
 * computeMatchOutcome in app/lib/scoring.ts e computeCupMatchResult in
 * app/lib/cupStandings.ts). Mai fattore campo qui: le coppe non hanno una
 * squadra "di casa", quello resta solo per il campionato.
 */
export interface CupRules {
  minWinMargin: number;
  scoreConversion: ScoreConversion;
}

export const DEFAULT_CUP_RULES: CupRules = {
  minWinMargin: 0,
  scoreConversion: DEFAULT_SCORE_CONVERSION,
};

/**
 * Legge minWinMargin e scoreConversion per la stagione data. Ritorna i
 * default (nessun distacco minimo, conversione disabilitata) se non ci sono
 * impostazioni salvate o le colonne non sono ancora migrate - stesso
 * comportamento di sicurezza di calculateScoresCore in voteImporter.ts.
 */
export async function getCupRules(db: Client, seasonId: number | null | undefined): Promise<CupRules> {
  if (!seasonId) return DEFAULT_CUP_RULES;
  try {
    const settingsRes = await db.execute({
      sql: `SELECT minWinMargin, scoreConversion FROM "LeagueSettings" WHERE seasonId = ?`,
      args: [seasonId],
    });
    const row = settingsRes.rows[0];
    if (!row) return DEFAULT_CUP_RULES;

    let scoreConversion = DEFAULT_SCORE_CONVERSION;
    try {
      if (row.scoreConversion) {
        scoreConversion = normalizeScoreConversion(JSON.parse(row.scoreConversion as string));
      }
    } catch { /* usa default */ }

    return {
      minWinMargin: (row.minWinMargin as number) ?? 0,
      scoreConversion,
    };
  } catch {
    return DEFAULT_CUP_RULES;
  }
}
