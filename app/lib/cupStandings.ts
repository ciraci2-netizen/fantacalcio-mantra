// Calcola risultati e classifica delle partite di Coppa a partire dai
// punteggi salvati (homeScore/awayScore), applicando le STESSE regole del
// campionato (distacco minimo per vincere, bonus gol per fascia - vedi
// CupRules in app/lib/leagueSettings.ts) invece di un confronto diretto dei
// punteggi: senza questo, in coppa si vedevano vittorie con un distacco di
// fantapunti che in campionato sarebbe stato un pareggio. Il risultato non
// viene salvato nel DB: si ricalcola sempre al volo dal punteggio gia'
// salvato, cosi' resta coerente anche se le regole di lega cambiano dopo, e
// non serve nessuna migrazione per le partite gia' giocate.
// Pure funzioni, senza accesso al DB, cosi' sono riusabili sia lato admin
// (app/(main)/admin/coppe) sia lato pubblico (app/(main)/coppe).

import { computeMatchOutcome, type MatchOutcome } from "./scoring";
import { DEFAULT_CUP_RULES, type CupRules } from "./leagueSettings";

export type CupGroupMatch = {
  homeUserId: number;
  awayUserId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
};

export type CupMatchResult = {
  homeGoals: number | null;
  awayGoals: number | null;
  homePoints: number | null; // null se la partita non e' ancora stata giocata
  awayPoints: number | null;
};

/**
 * Risultato (gol mostrati + punti partita) di una singola partita di coppa,
 * calcolato dalle regole di lega correnti. Mai fattore campo (homeAdvantage
 * a 0): in coppa nessuna delle due squadre e' "di casa".
 */
export function computeCupMatchResult(
  homeScore: number | null,
  awayScore: number | null,
  rules: CupRules = DEFAULT_CUP_RULES
): CupMatchResult {
  if (homeScore === null || awayScore === null) {
    return { homeGoals: null, awayGoals: null, homePoints: null, awayPoints: null };
  }
  const outcome: MatchOutcome = computeMatchOutcome(homeScore, awayScore, 0, rules.minWinMargin, rules.scoreConversion);
  return outcome;
}

export type CupStandingRow = {
  userId: number;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  scoreFor: number;
  scoreAgainst: number;
  diff: number;
};

export function computeGroupStandings(matches: CupGroupMatch[], rules: CupRules = DEFAULT_CUP_RULES): CupStandingRow[] {
  const table = new Map<number, CupStandingRow>();

  const ensure = (id: number, name: string) => {
    let row = table.get(id);
    if (!row) {
      row = {
        userId: id,
        teamName: name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        diff: 0,
      };
      table.set(id, row);
    }
    return row;
  };

  for (const m of matches) {
    const home = ensure(m.homeUserId, m.homeTeam);
    const away = ensure(m.awayUserId, m.awayTeam);

    if (m.homeScore === null || m.awayScore === null) continue;

    home.played += 1;
    away.played += 1;
    home.scoreFor += m.homeScore;
    home.scoreAgainst += m.awayScore;
    away.scoreFor += m.awayScore;
    away.scoreAgainst += m.homeScore;

    // Vittoria/pareggio/sconfitta decisi dalle STESSE regole di lega
    // (distacco minimo, bonus gol per fascia) usate per il campionato -
    // mai un confronto diretto dei due punteggi, che ignorerebbe queste
    // regole e potrebbe mostrare una vittoria con un distacco che in
    // campionato sarebbe stato un pareggio.
    const result = computeCupMatchResult(m.homeScore, m.awayScore, rules);
    if (result.homePoints === 3) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (result.awayPoints === 3) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const rows = [...table.values()];
  for (const r of rows) r.diff = r.scoreFor - r.scoreAgainst;
  rows.sort(
    (a, b) => b.points - a.points || b.diff - a.diff || b.scoreFor - a.scoreFor
  );
  return rows;
}
