// Fase a eliminazione diretta delle coppe (quarti, semifinale, finale) con
// accoppiamenti incrociati dai gironi. Pure funzioni, nessun accesso al DB:
// riusate dalle action (app/actions/cups.ts) e dalle pagine admin/pubblica.
//
// Modello dati: ogni "sfida" (tie) di un turno a eliminazione ha una
// posizione nel tabellone (CupMatch.bracketPos: 1..4 nei quarti, 1..2 in
// semifinale, 1 in finale) e una o due partite:
//   - roundSlot 1 = andata, roundSlot 2 = ritorno (quarti e semifinale)
//   - roundSlot 1 = partita secca (finale)
// La giornata di campionato di andata/ritorno e' quella di CupRoundSlot,
// come per i turni interni dei gironi: "Calcola" e la pagina formazione la
// usano gia' cosi'.
//
// Squadra "1" della sfida = testa di serie (meglio piazzata nel girone):
// gioca il ritorno in casa (in coppa comunque nessun fattore campo) e passa
// lei se anche gol e fantapunti complessivi sono pari.

import { computeCupMatchResult, type CupStandingRow, type CupForfeit } from "./cupStandings";
import { DEFAULT_CUP_RULES, type CupRules } from "./leagueSettings";

export type KnockoutLeg = {
  id: number;
  homeUserId: number;
  awayUserId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  roundSlot: number | null;
  bracketPos: number | null;
} & CupForfeit;

export type KnockoutTie = {
  pos: number;
  team1Id: number; // testa di serie (ritorno in casa)
  team2Id: number;
  team1: string;
  team2: string;
  legs: KnockoutLeg[]; // ordinate per roundSlot (andata, ritorno)
  twoLegs: boolean;
  complete: boolean; // tutte le partite giocate
  team1Goals: number;
  team2Goals: number;
  team1Score: number;
  team2Score: number;
  winnerId: number | null; // null finche' la sfida non e' conclusa
  decidedBy: "gol" | "fantapunti" | "testa di serie" | null;
};

export function computeKnockoutTies(matches: KnockoutLeg[], rules: CupRules = DEFAULT_CUP_RULES): KnockoutTie[] {
  const byPos = new Map<number, KnockoutLeg[]>();
  for (const m of matches) {
    if (m.bracketPos === null) continue;
    if (!byPos.has(m.bracketPos)) byPos.set(m.bracketPos, []);
    byPos.get(m.bracketPos)!.push(m);
  }

  const ties: KnockoutTie[] = [];
  for (const [pos, legsRaw] of [...byPos.entries()].sort((a, b) => a[0] - b[0])) {
    const legs = [...legsRaw].sort((a, b) => (a.roundSlot ?? 0) - (b.roundSlot ?? 0));
    const twoLegs = legs.length >= 2;
    // Testa di serie = squadra di casa dell'ultima partita (ritorno, o
    // partita secca).
    const last = legs[legs.length - 1];
    const team1Id = last.homeUserId;
    const team2Id = last.awayUserId;

    let team1Goals = 0, team2Goals = 0, team1Score = 0, team2Score = 0;
    let complete = true;
    // Senza conversione punti->gol (regola disattivata) si decide solo sui
    // fantapunti complessivi.
    let goalsAvailable = true;
    for (const leg of legs) {
      const r = computeCupMatchResult(leg.homeScore, leg.awayScore, rules, leg);
      if (r.homePoints === null) {
        complete = false;
        continue;
      }
      if (r.homeGoals === null || r.awayGoals === null) goalsAvailable = false;
      const t1Home = leg.homeUserId === team1Id;
      team1Goals += (t1Home ? r.homeGoals : r.awayGoals) ?? 0;
      team2Goals += (t1Home ? r.awayGoals : r.homeGoals) ?? 0;
      team1Score += (t1Home ? leg.homeScore : leg.awayScore) ?? 0;
      team2Score += (t1Home ? leg.awayScore : leg.homeScore) ?? 0;
    }
    team1Score = Math.round(team1Score * 100) / 100;
    team2Score = Math.round(team2Score * 100) / 100;

    let winnerId: number | null = null;
    let decidedBy: KnockoutTie["decidedBy"] = null;
    if (complete) {
      if (goalsAvailable && team1Goals !== team2Goals) {
        winnerId = team1Goals > team2Goals ? team1Id : team2Id;
        decidedBy = "gol";
      } else if (team1Score !== team2Score) {
        winnerId = team1Score > team2Score ? team1Id : team2Id;
        decidedBy = "fantapunti";
      } else {
        winnerId = team1Id;
        decidedBy = "testa di serie";
      }
    }

    ties.push({
      pos,
      team1Id,
      team2Id,
      team1: last.homeTeam,
      team2: last.awayTeam,
      legs,
      twoLegs,
      complete,
      team1Goals,
      team2Goals,
      team1Score,
      team2Score,
      winnerId,
      decidedBy,
    });
  }
  return ties;
}

// Piazzamento di una squadra nei gironi, per decidere la testa di serie
// anche nei turni successivi (semifinale, finale).
export type Seed = { userId: number; position: number; points: number; diff: number; scoreFor: number };

export function seedsFromGroups(groups: CupStandingRow[][]): Map<number, Seed> {
  const seeds = new Map<number, Seed>();
  for (const standings of groups) {
    standings.forEach((s, i) =>
      seeds.set(s.userId, { userId: s.userId, position: i + 1, points: s.points, diff: s.diff, scoreFor: s.scoreFor })
    );
  }
  return seeds;
}

/** true se a e' testa di serie rispetto a b (o se non si sa: ordine invariato). */
export function isBetterSeed(a: number, b: number, seeds: Map<number, Seed>): boolean {
  const sa = seeds.get(a);
  const sb = seeds.get(b);
  if (!sa || !sb) return true;
  if (sa.position !== sb.position) return sa.position < sb.position;
  if (sa.points !== sb.points) return sa.points > sb.points;
  if (sa.diff !== sb.diff) return sa.diff > sb.diff;
  return sa.scoreFor >= sb.scoreFor;
}

export type PlannedTie = { pos: number; team1Id: number; team2Id: number };

/**
 * Quarti incrociati da due gironi (prime 4 di ciascuno):
 *   Q1: 1A - 4B   Q2: 2B - 3A   (lato alto: vincenti in Semifinale 1)
 *   Q3: 2A - 3B   Q4: 1B - 4A   (lato basso: vincenti in Semifinale 2)
 * Cosi' le due prime e le due seconde finiscono in lati opposti del
 * tabellone e possono incontrarsi solo in finale.
 */
export function crossedQuarterFinals(groupA: CupStandingRow[], groupB: CupStandingRow[]): PlannedTie[] {
  const a = (n: number) => groupA[n - 1].userId;
  const b = (n: number) => groupB[n - 1].userId;
  return [
    { pos: 1, team1Id: a(1), team2Id: b(4) },
    { pos: 2, team1Id: b(2), team2Id: a(3) },
    { pos: 3, team1Id: a(2), team2Id: b(3) },
    { pos: 4, team1Id: b(1), team2Id: a(4) },
  ];
}

/** Turno successivo: vincente sfida 1 vs vincente 2, 3 vs 4, ... */
export function nextRoundTies(prev: KnockoutTie[], seeds: Map<number, Seed>): PlannedTie[] | { error: string } {
  if (prev.length < 2 || prev.length % 2 !== 0) return { error: "Il turno precedente non ha un numero pari di sfide." };
  const open = prev.filter((t) => t.winnerId === null);
  if (open.length > 0) {
    return { error: `Il turno precedente non e' ancora concluso (${open.length} sfide senza vincitore: inserisci o calcola tutti i risultati).` };
  }
  const sorted = [...prev].sort((x, y) => x.pos - y.pos);
  const out: PlannedTie[] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const w1 = sorted[i].winnerId!;
    const w2 = sorted[i + 1].winnerId!;
    const [t1, t2] = isBetterSeed(w1, w2, seeds) ? [w1, w2] : [w2, w1];
    out.push({ pos: i / 2 + 1, team1Id: t1, team2Id: t2 });
  }
  return out;
}

export function tieLabel(pos: number, tieCount: number): string {
  if (tieCount === 1) return "Finale";
  if (tieCount === 2) return `Semifinale ${pos}`;
  if (tieCount === 4) return `Quarto ${pos}`;
  return `Sfida ${pos}`;
}
