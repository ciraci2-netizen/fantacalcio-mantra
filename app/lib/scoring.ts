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
export const MANTRA_ROLES = ["POR", "TER", "DC", "M", "OFF", "ATT"] as const;
export type MantraRole = (typeof MANTRA_ROLES)[number];

// Alias comuni (nomi per esteso / sigle classiche fantacalcio) che vengono
// mappati sui codici Mantra canonici sopra, così un import da Excel/CSV con
// "PORTIERE", "TERZINO", ecc. invece delle sigle non fallisce inutilmente.
const MANTRA_ROLE_ALIASES: Record<string, MantraRole> = {
  PORTIERE: "POR",

  "DIFENSORE CENTRALE": "DC",
  DIFENSORE: "DC",
  CENTRALE: "DC",

  TERZINO: "TER",
  "TERZINO DESTRO": "TER",
  "TERZINO SINISTRO": "TER",
  "ESTERNO BASSO": "TER",
  "ESTERNO DIFENSIVO": "TER",
  DD: "TER",
  DS: "TER",

  CENTROCAMPISTA: "M",
  MEDIANO: "M",
  MEZZALA: "M",
  REGISTA: "M",

  TREQUARTISTA: "OFF",
  "ESTERNO ALTO": "OFF",
  "ESTERNO OFFENSIVO": "OFF",
  ALA: "OFF",
  OFFENSIVO: "OFF",

  ATTACCANTE: "ATT",
  PUNTA: "ATT",
  "PRIMA PUNTA": "ATT",
};

/**
 * Normalizza un ruolo in input (case-insensitive, spazi liberi) verso una
 * delle sigle Mantra canoniche. Ritorna null se non riconosciuto.
 */
export function normalizeMantraRole(input: string | null | undefined): MantraRole | null {
  const clean = input?.toUpperCase().trim().replace(/\s+/g, " ");
  if (!clean) return null;
  if ((MANTRA_ROLES as readonly string[]).includes(clean)) return clean as MantraRole;
  return MANTRA_ROLE_ALIASES[clean] ?? null;
}

// Formazioni valide Mantra (difensori-centrocampisti-attaccanti)
export const VALID_FORMATIONS = [
  "3-4-3", "3-5-2", "3-4-2-1", "3-3-3-1",
  "4-3-3", "4-4-2", "4-5-1", "4-4-1-1", "4-3-2-1",
  "5-3-2", "5-4-1",
];

// Modificatori fuori ruolo: quale ruolo può giocare in quale posizione e con quale malus
export const ROLE_MODIFIERS: Record<string, Record<string, number>> = {
  POR: { POR: 0 },
  DC:  { DC: 0, TER: -1 },
  TER: { TER: 0, DC: -1, M: -2 },
  M:   { M: 0, TER: -2, OFF: -1 },
  OFF: { OFF: 0, M: -1, ATT: -1 },
  ATT: { ATT: 0, OFF: -1 },
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

  if (mantraRole === "POR") {
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
  { m: 0, b: 0 },
];

// ── Score-to-goals conversion (Mantra system) ─────────────────────────────────

export interface ScoreConversion {
  enabled: boolean;
  minScore: number; // punteggio per segnare esattamente 1 gol (default 66)
  step: number;     // punti aggiuntivi per ogni gol in più (default 4)
}

export const DEFAULT_SCORE_CONVERSION: ScoreConversion = {
  enabled: false,
  minScore: 66,
  step: 4,
};

/**
 * Converte il punteggio totale di una formazione in numero di gol (sistema Mantra).
 * Esempi con minScore=66, step=4:
 *   < 66  → 0 gol
 *   66–69.5 → 1 gol
 *   70–73.5 → 2 gol
 *   74–77.5 → 3 gol
 */
export function convertScoreToGoals(
  score: number,
  conv: ScoreConversion = DEFAULT_SCORE_CONVERSION
): number {
  if (!conv.enabled) return 0;
  return Math.max(0, Math.floor((score - (conv.minScore - conv.step)) / conv.step));
}

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

// ── Modificatore difensivo (portiere + 3 migliori difensori titolari) ────────

export type DefenseThreshold = { m: number; b: number }; // media minima → malus

/**
 * Soglie ufficiali del modificatore difensivo Mantra: media tra portiere e i
 * 3 migliori difensori (terzini/centrali) titolari → malus inflitto alla
 * squadra avversaria.
 */
export const DEFAULT_DEFENSE_THRESHOLDS: DefenseThreshold[] = [
  { m: 6, b: -1 },
  { m: 6.5, b: -2 },
  { m: 7, b: -3 },
  { m: 7.5, b: -4 },
];

export interface DefenseModifierResult {
  applies: boolean;       // se il modificatore è scattato (malus != 0)
  average: number | null; // media portiere + 3 migliori difensori, null se non calcolabile
  malus: number;          // malus da infliggere alla squadra avversaria (0 o negativo)
}

/**
 * Modificatore difensivo: si prende il voto (non il fantavoto) del portiere
 * titolare e dei 3 migliori difensori (terzini/centrali) titolari. Scatta
 * SOLO se portiere e TUTTI i difensori titolari (terzini+centrali) sono
 * andati a voto — se anche uno solo è sv/assente, niente modificatore per
 * quella squadra in quella giornata.
 */
export function calculateDefenseModifier(
  starters: Array<{ mantraRole: string; vote: number | null }>,
  thresholds: DefenseThreshold[] = DEFAULT_DEFENSE_THRESHOLDS
): DefenseModifierResult {
  const nullResult: DefenseModifierResult = { applies: false, average: null, malus: 0 };

  const gk = starters.find((s) => s.mantraRole === "POR");
  if (!gk || gk.vote === null) return nullResult;

  const defenders = starters.filter((s) => s.mantraRole === "TER" || s.mantraRole === "DC");
  if (defenders.length < 3) return nullResult;
  if (defenders.some((d) => d.vote === null)) return nullResult;

  const bestThree = [...defenders]
    .sort((a, b) => (b.vote as number) - (a.vote as number))
    .slice(0, 3);

  const average =
    Math.round(((gk.vote + bestThree.reduce((sum, d) => sum + (d.vote as number), 0)) / 4) * 100) / 100;

  const sorted = [...thresholds].sort((a, b) => b.m - a.m);
  const match = sorted.find((t) => average >= t.m);
  const malus = match?.b ?? 0;

  return { applies: malus !== 0, average, malus };
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
