import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/votes?matchdayId=X
 *
 * Admin-only: elenco dei voti già importati per una giornata (uniti ai dati
 * del giocatore), usato dal pannello di correzione manuale in /admin/votes.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const matchdayId = Number(req.nextUrl.searchParams.get("matchdayId"));
  if (!matchdayId) {
    return NextResponse.json({ error: "matchdayId mancante" }, { status: 400 });
  }

  const db = getDb();
  const res = await db.execute({
    sql: `SELECT pv.playerId, p.name, p.realTeam, p.mantraRole,
                 pv.vote, pv.fantavoto, pv.gfGs, pv.gsr, pv.amm, pv.esp, pv.rpRs, pv.aut, pv.ass, pv.adf
          FROM "PlayerVote" pv
          JOIN "Player" p ON p.id = pv.playerId
          WHERE pv.matchdayId = ?
          ORDER BY p.mantraRole ASC, p.name ASC`,
    args: [matchdayId],
  });

  return NextResponse.json({ votes: res.rows });
}
