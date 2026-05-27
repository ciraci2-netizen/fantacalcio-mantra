"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { scrapeVotes } from "@/app/lib/scraper";
import { calculateFantavoto } from "@/app/lib/scoring";

export async function importVotes(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const matchdayNumber = parseInt(formData.get("matchdayNumber") as string);

  const db = getDb();
  const matchdayRes = await db.execute({ sql: `SELECT id FROM "Matchday" WHERE id = ?`, args: [matchdayId] });
  if (matchdayRes.rows.length === 0) return "Giornata non trovata.";

  try {
    const scraped = await scrapeVotes(matchdayNumber);
    if (scraped.length === 0) return "Nessun voto trovato sul sito. Riprova più tardi.";

    const playersRes = await db.execute(`SELECT id, name, fantapiu3Name, mantraRole FROM "Player"`);
    const players = playersRes.rows;

    let matched = 0;
    let unmatched = 0;

    for (const vote of scraped) {
      const player = players.find(
        (p) => (p.fantapiu3Name && p.fantapiu3Name === vote.name) || p.name === vote.name
      );

      if (!player) { unmatched++; continue; }

      const fantavoto = calculateFantavoto(
        {
          vote: vote.vote,
          fantavoto: vote.fantavoto,
          gfGs: vote.gfGs,
          gsr: vote.gsr,
          amm: vote.amm,
          esp: vote.esp,
          rpRs: vote.rpRs,
          aut: vote.aut,
          ass: vote.ass,
          adf: vote.adf,
        },
        player.mantraRole as string
      );

      await db.execute({
        sql: `INSERT OR REPLACE INTO "PlayerVote"
              (playerId, matchdayId, vote, fantavoto, gfGs, gsr, amm, esp, rpRs, aut, ass, adf)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          player.id, matchdayId, vote.vote, fantavoto,
          vote.gfGs, vote.gsr, vote.amm, vote.esp, vote.rpRs, vote.aut, vote.ass, vote.adf,
        ],
      });
      matched++;
    }

    await db.execute({
      sql: `UPDATE "Matchday" SET votesImported = 1 WHERE id = ?`,
      args: [matchdayId],
    });

    revalidatePath("/admin/votes");
    revalidatePath("/standings");
    return `Voti importati: ${matched} giocatori trovati, ${unmatched} non abbinati.`;
  } catch (err) {
    return `Errore durante l'importazione: ${err instanceof Error ? err.message : "Errore sconosciuto"}`;
  }
}

export async function calculateAllScores(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const db = getDb();

  const lineupsRes = await db.execute({
    sql: `SELECT id FROM "Lineup" WHERE matchdayId = ? AND isSubmitted = 1`,
    args: [matchdayId],
  });

  for (const lineup of lineupsRes.rows) {
    const lineupId = lineup.id as number;

    const slotsRes = await db.execute({
      sql: `SELECT ls.position, ls.isStarter, pv.fantavoto
            FROM "LineupSlot" ls
            LEFT JOIN "PlayerVote" pv ON pv.playerId = ls.playerId AND pv.matchdayId = ?
            WHERE ls.lineupId = ?`,
      args: [matchdayId, lineupId],
    });

    const starters = slotsRes.rows
      .filter((s) => Number(s.isStarter) === 1)
      .sort((a, b) => (a.position as number) - (b.position as number));

    const reserves = slotsRes.rows
      .filter((s) => Number(s.isStarter) === 0)
      .sort((a, b) => (a.position as number) - (b.position as number));

    let total = 0;
    const usedReserves = new Set<number>();
    for (const starter of starters) {
      if (starter.fantavoto !== null) {
        total += starter.fantavoto as number;
      } else {
        const reserveIdx = reserves.findIndex(
          (_, idx) => !usedReserves.has(idx) && reserves[idx].fantavoto !== null
        );
        if (reserveIdx !== -1) {
          usedReserves.add(reserveIdx);
          total += reserves[reserveIdx].fantavoto as number;
        }
      }
    }

    await db.execute({
      sql: `UPDATE "Lineup" SET totalScore = ? WHERE id = ?`,
      args: [total, lineupId],
    });
  }

  const matchesRes = await db.execute({
    sql: `SELECT id, homeUserId, awayUserId FROM "Match" WHERE matchdayId = ?`,
    args: [matchdayId],
  });

  for (const match of matchesRes.rows) {
    const homeRes = await db.execute({
      sql: `SELECT totalScore FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
      args: [match.homeUserId, matchdayId],
    });
    const awayRes = await db.execute({
      sql: `SELECT totalScore FROM "Lineup" WHERE userId = ? AND matchdayId = ?`,
      args: [match.awayUserId, matchdayId],
    });

    const homeScore = (homeRes.rows[0]?.totalScore as number) ?? 0;
    const awayScore = (awayRes.rows[0]?.totalScore as number) ?? 0;

    let homePoints = 1;
    let awayPoints = 1;
    if (homeScore > awayScore) { homePoints = 3; awayPoints = 0; }
    else if (awayScore > homeScore) { homePoints = 0; awayPoints = 3; }

    await db.execute({
      sql: `UPDATE "Match" SET homeScore = ?, awayScore = ?, homePoints = ?, awayPoints = ? WHERE id = ?`,
      args: [homeScore, awayScore, homePoints, awayPoints, match.id],
    });
  }

  revalidatePath("/standings");
  revalidatePath("/calendar");
  return null;
}
