import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { calculateFantavoto } from "@/app/lib/scoring";
import { calculateScoresCore } from "@/app/lib/voteImporter";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/backfill-gsr
 *
 * Fix una tantum per il bug: i gol segnati su rigore (campo "gsr", icona
 * "GOAL SU RIGORE" di fantapiu3) venivano scorati con rigoreSbagliato (-3)
 * invece che con golFatto (+3) — vedi app/lib/scoring.ts. La formula è già
 * corretta per i NUOVI import; questo endpoint ricalcola il fantavoto dei
 * voti già salvati con la formula sbagliata e rilancia calculateScoresCore
 * per le giornate coinvolte, così anche punteggi/classifica già calcolati
 * vengono corretti.
 *
 * Body JSON opzionale: { "apply": true } per scrivere davvero le modifiche.
 * Senza "apply" (o con apply:false) esegue un DRY RUN: calcola cosa
 * cambierebbe e lo riporta senza toccare il database.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  let apply = false;
  try {
    const body = await req.json();
    apply = body?.apply === true;
  } catch {
    // nessun body / body non JSON ? dry run
  }

  const db = getDb();

  const res = await db.execute(
    `SELECT pv.playerId, pv.matchdayId, pv.vote, pv.fantavoto, pv.gfGs, pv.gsr,
            pv.amm, pv.esp, pv.rpRs, pv.aut, pv.ass, pv.adf,
            p.name, p.mantraRole
     FROM "PlayerVote" pv
     JOIN "Player" p ON p.id = pv.playerId
     WHERE pv.gsr > 0`
  );

  type Diff = {
    playerId: number;
    name: string;
    matchdayId: number;
    gsr: number;
    oldFantavoto: number | null;
    newFantavoto: number | null;
  };

  const diffs: Diff[] = [];

  for (const row of res.rows) {
    const mantraRole = row.mantraRole as string;
    const newFantavoto = calculateFantavoto(
      {
        vote: row.vote as number | null,
        fantavoto: null, // se vote non è null, il fantavoto va sempre ricalcolato dagli eventi
        gfGs: row.gfGs as number,
        gsr: row.gsr as number,
        amm: row.amm as number,
        esp: row.esp as number,
        rpRs: row.rpRs as number,
        aut: row.aut as number,
        ass: row.ass as number,
        adf: row.adf as number,
      },
      mantraRole
    );

    const oldFantavoto = row.fantavoto as number | null;
    if (newFantavoto !== oldFantavoto) {
      diffs.push({
        playerId: row.playerId as number,
        name: row.name as string,
        matchdayId: row.matchdayId as number,
        gsr: row.gsr as number,
        oldFantavoto,
        newFantavoto,
      });
    }
  }

  if (!apply) {
    return NextResponse.json({
      dryRun: true,
      rowsScanned: res.rows.length,
      rowsToFix: diffs.length,
      matchdaysAffected: [...new Set(diffs.map((d) => d.matchdayId))].sort((a, b) => a - b),
      diffs,
    });
  }

  for (const d of diffs) {
    await db.execute({
      sql: `UPDATE "PlayerVote" SET fantavoto = ? WHERE playerId = ? AND matchdayId = ?`,
      args: [d.newFantavoto, d.playerId, d.matchdayId],
    });
  }

  const matchdaysAffected = [...new Set(diffs.map((d) => d.matchdayId))].sort((a, b) => a - b);

  const recalcErrors: Array<{ matchdayId: number; error: string }> = [];
  for (const matchdayId of matchdaysAffected) {
    try {
      const mdRes = await db.execute({
        sql: `SELECT votesImported FROM "Matchday" WHERE id = ?`,
        args: [matchdayId],
      });
      if (mdRes.rows[0]?.votesImported) {
        await calculateScoresCore(matchdayId);
      }
    } catch (err) {
      recalcErrors.push({ matchdayId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    dryRun: false,
    rowsFixed: diffs.length,
    matchdaysAffected,
    matchdaysRecalculated: matchdaysAffected.length - recalcErrors.length,
    recalcErrors,
    diffs,
  });
}