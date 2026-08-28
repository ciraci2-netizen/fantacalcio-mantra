import type { Client } from "@libsql/client/http";

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
