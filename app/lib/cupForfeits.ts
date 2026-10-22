import { getDb } from "./db";

export type CupForfeitMap = Record<number, { homeForfeit: boolean; awayForfeit: boolean }>;

/**
 * Tavolini (sconfitta 3-0 decisa dall'admin) delle partite di un turno di
 * coppa, per id partita. Colonne opzionali: se non ancora create, nessun
 * tavolino. Vedi setCupMatchForfeit in app/actions/cups.ts.
 */
export async function loadCupForfeits(cupRoundId: number): Promise<CupForfeitMap> {
  try {
    const res = await getDb().execute({
      sql: `SELECT id, homeForfeit, awayForfeit FROM "CupMatch" WHERE cupRoundId = ?`,
      args: [cupRoundId],
    });
    return Object.fromEntries(
      res.rows.map((r) => [
        r.id as number,
        { homeForfeit: Number(r.homeForfeit) === 1, awayForfeit: Number(r.awayForfeit) === 1 },
      ])
    );
  } catch {
    return {};
  }
}
