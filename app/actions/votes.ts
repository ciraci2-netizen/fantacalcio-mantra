"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { scrapeVotes } from "@/app/lib/scraper";
import { calculateFantavoto } from "@/app/lib/scoring";

export async function importVotes(prevState: string | null, formData: FormData) {
  const session = await getSession();
  if (!session?.isAdmin) return "Non autorizzato.";

  const matchdayId = parseInt(formData.get("matchdayId") as string);
  const matchdayNumber = parseInt(formData.get("matchdayNumber") as string);

  const matchday = await prisma.matchday.findUnique({ where: { id: matchdayId } });
  if (!matchday) return "Giornata non trovata.";

  try {
    const scraped = await scrapeVotes(matchdayNumber);
    if (scraped.length === 0) return "Nessun voto trovato sul sito. Riprova più tardi.";

    // Recupera tutti i giocatori con fantapiu3Name o name per il matching
    const players = await prisma.player.findMany();

    let matched = 0;
    let unmatched = 0;

    for (const vote of scraped) {
      // Trova il giocatore per nome (fantapiu3Name ha priorità)
      const player = players.find(
        (p) =>
          (p.fantapiu3Name && p.fantapiu3Name === vote.name) ||
          p.name === vote.name
      );

      if (!player) {
        unmatched++;
        continue;
      }

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
        player.mantraRole
      );

      await prisma.playerVote.upsert({
        where: { playerId_matchdayId: { playerId: player.id, matchdayId } },
        create: {
          playerId: player.id,
          matchdayId,
          vote: vote.vote,
          fantavoto,
          gfGs: vote.gfGs,
          gsr: vote.gsr,
          amm: vote.amm,
          esp: vote.esp,
          rpRs: vote.rpRs,
          aut: vote.aut,
          ass: vote.ass,
          adf: vote.adf,
        },
        update: {
          vote: vote.vote,
          fantavoto,
          gfGs: vote.gfGs,
          gsr: vote.gsr,
          amm: vote.amm,
          esp: vote.esp,
          rpRs: vote.rpRs,
          aut: vote.aut,
          ass: vote.ass,
          adf: vote.adf,
        },
      });
      matched++;
    }

    // Segna la giornata come importata
    await prisma.matchday.update({
      where: { id: matchdayId },
      data: { votesImported: true },
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

  const lineups = await prisma.lineup.findMany({
    where: { matchdayId, isSubmitted: true },
    include: {
      slots: {
        include: {
          player: {
            include: {
              votes: { where: { matchdayId } },
            },
          },
        },
      },
    },
  });

  for (const lineup of lineups) {
    const starters = lineup.slots
      .filter((s) => s.isStarter)
      .sort((a, b) => a.position - b.position);

    const reserves = lineup.slots
      .filter((s) => !s.isStarter)
      .sort((a, b) => a.position - b.position);

    // Calcola punteggio base (con sostituzione automatica)
    let total = 0;
    const starterScores = starters.map((s) => ({
      fantavoto: s.player.votes[0]?.fantavoto ?? null,
    }));

    const usedReserves = new Set<number>();
    for (let i = 0; i < starterScores.length; i++) {
      if (starterScores[i].fantavoto !== null) {
        total += starterScores[i].fantavoto!;
      } else {
        // Cerca riserva
        const reserve = reserves.find(
          (r, idx) => !usedReserves.has(idx) && r.player.votes[0]?.fantavoto !== null
        );
        if (reserve) {
          const ridx = reserves.indexOf(reserve);
          usedReserves.add(ridx);
          total += reserve.player.votes[0]!.fantavoto!;
        }
      }
    }

    await prisma.lineup.update({
      where: { id: lineup.id },
      data: { totalScore: total },
    });
  }

  // Aggiorna i risultati delle partite
  const matches = await prisma.match.findMany({ where: { matchdayId } });
  for (const match of matches) {
    const homeLineup = await prisma.lineup.findUnique({
      where: { userId_matchdayId: { userId: match.homeUserId, matchdayId } },
    });
    const awayLineup = await prisma.lineup.findUnique({
      where: { userId_matchdayId: { userId: match.awayUserId, matchdayId } },
    });

    const homeScore = homeLineup?.totalScore ?? 0;
    const awayScore = awayLineup?.totalScore ?? 0;

    let homePoints = 1;
    let awayPoints = 1;
    if (homeScore > awayScore) { homePoints = 3; awayPoints = 0; }
    else if (awayScore > homeScore) { homePoints = 0; awayPoints = 3; }

    await prisma.match.update({
      where: { id: match.id },
      data: { homeScore, awayScore, homePoints, awayPoints },
    });
  }

  revalidatePath("/standings");
  revalidatePath("/calendar");
  return null;
}
