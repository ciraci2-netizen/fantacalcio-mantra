// Calcola la classifica di un girone di Coppa (fase a gruppi) a partire
// dalle partite del turno. Punti: vittoria 3, pareggio 1, sconfitta 0.
// Spareggio: punti -> differenza punteggio -> punteggio totale fatto.
// Pura funzione, senza accesso al DB, cosi' e' riusabile sia lato admin
// (app/(main)/admin/coppe) sia lato pubblico (app/(main)/coppe).

export type CupGroupMatch = {
  homeUserId: number;
  awayUserId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
};

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

export function computeGroupStandings(matches: CupGroupMatch[]): CupStandingRow[] {
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

    if (m.homeScore > m.awayScore) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (m.homeScore < m.awayScore) {
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
