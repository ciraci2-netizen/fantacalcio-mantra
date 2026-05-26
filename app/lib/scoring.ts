// Mantra scoring rules
// Calcola il punteggio di un giocatore data la giornata

export interface VoteData {
  vote: number | null;
  fantavoto: number | null;
  gfGs: number;
  gsr: number;
  amm: number;
  esp: number;
  rpRs: number;
  aut: number;
  ass: number;
  adf: number;
}

export interface ScoringConfig {
  golFatto: number;
  assist: number;
  adf: number;
  ammonizione: number;
  espulsione: number;
  autogol: number;
  rigoreSbagliato: number;
  rigoreParato: number;
  golSubito: number;
  cleanSheetPortiere: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  golFatto: 3,
  assist: 1,
  adf: 0.5,
  ammonizione: -0.5,
  espulsione: -1,
  autogol: -2,
  rigoreSbagliato: -3,
  rigoreParato: 3,
  golSubito: -1,
  cleanSheetPortiere: 0,
};

// Ruoli Mantra
export const MANTRA_ROLES = ["Por", "Dc", "Dd", "Ds", "M", "C", "T", "W", "A", "Pc"] as const;
export type MantraRole = (typeof MANTRA_ROLES)[number];

// Formazioni valide Mantra (difensori-centrocampisti-attaccanti)
export const VALID_FORMATIONS = [
  "3-4-3", "3-5-2", "3-4-2-1", "3-3-3-1",
  "4-3-3", "4-4-2", "4-5-1", "4-4-1-1", "4-3-2-1",
  "5-3-2", "5-4-1",
];

// Modificatori fuori ruolo: quale ruolo può giocare in quale posizione e con quale malus
export const ROLE_MODIFIERS: Record<string, Record<string, number>> = {
  Por: { Por: 0 },
  Dc: { Dc: 0, Dd: -1, Ds: -1 },
  Dd: { Dd: 0, Dc: -1, Ds: -1 },
  Ds: { Ds: 0, Dc: -1, Dd: -1 },
  M: { M: 0, C: -1, T: -1, Ds: -2, Dd: -2 },
  C: { C: 0, M: -1, T: -1, W: -1 },
  T: { T: 0, C: -1, M: -1, A: -1, W: -1 },
  W: { W: 0, T: -1, A: -1, C: -2 },
  A: { A: 0, Pc: -1, W: -1, T: -2 },
  Pc: { Pc: 0, A: -1 },
};

export function calculateFantavoto(
  voteData: VoteData,
  mantraRole: string,
  config: ScoringConfig = DEFAULT_SCORING
): number | null {
  if (voteData.vote === null && voteData.fantavoto === null) return null;

  // Se il giocatore ha la SV (senza voto), usa il fantavoto di fantapiu3 direttamente
  if (voteData.vote === null) return voteData.fantavoto;

  let score = voteData.vote;

  // Gol fatti o subiti (gfGs)
  if (voteData.gfGs > 0) {
    score += voteData.gfGs * config.golFatto;
  } else if (voteData.gfGs < 0) {
    // Gol subiti (portieri/difensori)
    score += voteData.gfGs * Math.abs(config.golSubito);
  }

  score += voteData.gsr * config.rigoreSbagliato;
  score += voteData.amm * config.ammonizione;
  score += voteData.esp * config.espulsione;

  if (mantraRole === "Por") {
    score += voteData.rpRs * config.rigoreParato;
  } else {
    score += voteData.rpRs * config.rigoreSbagliato;
  }

  score += voteData.aut * config.autogol;
  score += voteData.ass * config.assist;
  score += voteData.adf * config.adf;

  return Math.round(score * 100) / 100;
}

// Calcola il punteggio totale di una formazione
// slots: array di { playerId, mantraRole, playerRole, fantavoto, isStarter, position }
export function calculateLineupScore(
  starters: Array<{
    playerRole: MantraRole;
    playedAs: MantraRole;
    fantavoto: number | null;
  }>,
  reserves: Array<{
    playerRole: MantraRole;
    fantavoto: number | null;
    position: number; // ordine di entrata (1=prima riserva, ecc.)
  }>
): number {
  let total = 0;
  const missingStarters: number[] = [];

  starters.forEach((s, idx) => {
    if (s.fantavoto === null) {
      missingStarters.push(idx);
    } else {
      const modifier = ROLE_MODIFIERS[s.playerRole]?.[s.playedAs] ?? -3;
      total += s.fantavoto + modifier;
    }
  });

  // Sostituzione automatica riserve
  const sortedReserves = [...reserves].sort((a, b) => a.position - b.position);
  for (const missing of missingStarters) {
    const replacement = sortedReserves.find(
      (r) => r.fantavoto !== null
    );
    if (replacement) {
      total += replacement.fantavoto!;
      sortedReserves.splice(sortedReserves.indexOf(replacement), 1);
    }
  }

  return Math.round(total * 100) / 100;
}
