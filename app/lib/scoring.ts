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

export type GoalThreshold = { m: number; b: number }; // minGoals → bonus

export const DEFAULT_GOAL_THRESHOLDS: GoalThreshold[] = [
  { m: 0, b: -6 },
  { m: 1, b: -4 },
  { m: 2, b: -2 },
  { m: 3, b: 0 },
  { m: 4, b: 3 },
  { m: 5, b: 5 },
  { m: 6, b: 9 },
];

/** Calcola il bonus soglie gol per una formazione */
export function calculateGoalBonus(
  goals: number,
  thresholds: GoalThreshold[] = DEFAULT_GOAL_THRESHOLDS
): number {
  // Ordina per minGoals desc, prende il primo che soddisfa la soglia
  const sorted = [...thresholds].sort((a, b) => b.m - a.m);
  const match = sorted.find((t) => goals >= t.m);
  return match?.b ?? 0;
}

// Calcola il punteggio totale di una formazione
export function calculateLineupScore(
  starters: Array<{
    playerRole: MantraRole;
    playedAs: MantraRole;
    fantavoto: number | null;
    goals?: number; // gol segnati (gfGs positivo)
  }>,
  reserves: Array<{
    playerRole: MantraRole;
    fantavoto: number | null;
    position: number;
  }>,
  options?: {
    maxSubstitutions?: number;         // default: illimitato
    goalThresholds?: GoalThreshold[];   // default: DEFAULT_GOAL_THRESHOLDS
    applyGoalBonus?: boolean;           // default: true
  }
): { total: number; goalBonus: number; substitutions: number } {
  const maxSubs = options?.maxSubstitutions ?? 99;
  const thresholds = options?.goalThresholds ?? DEFAULT_GOAL_THRESHOLDS;
  const applyBonus = options?.applyGoalBonus !== false;

  let base = 0;
  let subsUsed = 0;
  let totalGoals = 0;
  const missingStarters: number[] = [];

  starters.forEach((s, idx) => {
    if (s.goals && s.goals > 0) totalGoals += s.goals;
    if (s.fantavoto === null) {
      missingStarters.push(idx);
    } else {
      const modifier = ROLE_MODIFIERS[s.playerRole]?.[s.playedAs] ?? -3;
      base += s.fantavoto + modifier;
    }
  });

  // Sostituzione automatica riserve (entro il limite)
  const sortedReserves = [...reserves].sort((a, b) => a.position - b.position);
  for (const _missing of missingStarters) {
    if (subsUsed >= maxSubs) break;
    const idx = sortedReserves.findIndex((r) => r.fantavoto !== null);
    if (idx !== -1) {
      base += sortedReserves[idx].fantavoto!;
      sortedReserves.splice(idx, 1);
      subsUsed++;
    }
  }

  const goalBonus = applyBonus ? calculateGoalBonus(totalGoals, thresholds) : 0;
  const total = Math.round((base + goalBonus) * 100) / 100;

  return { total, goalBonus, substitutions: subsUsed };
}
