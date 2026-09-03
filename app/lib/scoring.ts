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

// Raggruppamento ruoli per la validazione dei moduli (vedi validateFormation
// in app/actions/lineup.ts) e per le sostituzioni automatiche "ruolo per
// ruolo" (vedi la sostituzione automatica in app/lib/voteImporter.ts): un
// modulo Mantra (es. "4-4-2") conta i difensori (TER+DC insieme) e gli
// attaccanti (ATT) — il centrocampo (M+OFF) riempie il resto senza
// distinzione tra i due. Unica fonte di verità condivisa dai due file.
export const DEF_ROLES = new Set(["DC", "TER"]);
export const MID_ROLES = new Set(["M", "OFF"]);
export const ATT_ROLES = new Set(["ATT"]);

export type RoleBucket = "GK" | "DEF" | "MID" | "ATT" | null;

/** Bucket di un ruolo Mantra, per confrontare "stesso ruolo ai fini del modulo". */
export function roleBucket(role: string): RoleBucket {
  if (role === "POR") return "GK";
  if (DEF_ROLES.has(role)) return "DEF";
  if (MID_ROLES.has(role)) return "MID";
  if (ATT_ROLES.has(role)) return "ATT";
  return null;
}

type SubCategory = "gk" | "def" | "mid" | "off" | "att" | null;

function subCategoryOf(role: string): SubCategory {
  if (role === "POR") return "gk";
  if (DEF_ROLES.has(role)) return "def";
  if (role === "M") return "mid";
  if (role === "OFF") return "off";
  if (ATT_ROLES.has(role)) return "att";
  return null;
}

export interface SubCandidate {
  mantraRole: string;
  fantavoto: number | null;
}

/**
 * Calcola le sostituzioni automatiche di un titolare senza voto (assente o
 * "sv"), usata sia dal calcolo dei punteggi (calculateScoresCore in
 * app/lib/voteImporter.ts) sia dalla evidenziazione nel tabellino
 * (computeSubbedInIds in app/(main)/calendar/[matchId]/page.tsx): unica
 * fonte di verita condivisa dai due file, cosi il punteggio calcolato e
 * quanto mostrato nel tabellino restano sempre coerenti.
 *
 * Regole: si scorre la lista titolari nell ordine in cui sono stati salvati
 * (il campo position) e, per ciascun titolare senza voto, si scorre la
 * lista riserve nello stesso ordine di priorita scelto in fase di
 * formazione, cercando la PRIMA riserva con voto che, entrando al posto del
 * titolare, mantenga valido il modulo secondo queste soglie: almeno 3
 * difensori, al massimo 3 attaccanti, al massimo 5 totali tra
 * centrocampisti offensivi (OFF) e attaccanti (ATT), e almeno 1
 * centrocampista puro (M) se la formazione originale ne schierava almeno
 * uno. Il modulo puo quindi cambiare completamente rispetto a quello
 * schierato in origine. Un portiere titolare puo essere sostituito solo da
 * un portiere di riserva (e un portiere di riserva non puo mai entrare per
 * un giocatore di movimento). Se nessuna riserva compatibile e disponibile,
 * il titolare resta a 0 (nessuna sostituzione forzata fuori dai limiti).
 */
export function computeAutoSubstitutions(
  starters: SubCandidate[],
  reserves: SubCandidate[],
  maxSubstitutions: number
): (number | null)[] {
  const starterCats = starters.map((s) => subCategoryOf(s.mantraRole));
  const reserveCats = reserves.map((r) => subCategoryOf(r.mantraRole));

  let currentDef = starterCats.filter((c) => c === "def").length;
  let currentAtt = starterCats.filter((c) => c === "att").length;
  let currentOffAtt = starterCats.filter((c) => c === "off" || c === "att").length;
  let currentMid = starterCats.filter((c) => c === "mid").length;
  // Il vincolo "almeno 1 M in campo" si applica solo se la formazione
  // originale ne schierava gia almeno uno: non forza un centrocampista
  // puro in formazioni che non lo prevedevano fin dall inizio.
  const requireMid = currentMid >= 1;

  const usedReserveIdxs = new Set<number>();
  const reserveForStarter: (number | null)[] = starters.map(() => null);
  let subsUsed = 0;

  for (let si = 0; si < starters.length; si++) {
    if (starters[si].fantavoto !== null) continue;
    if (subsUsed >= maxSubstitutions) continue;

    const starterCat = starterCats[si];
    if (starterCat === null) continue;
    const starterIsGk = starterCat === "gk";

    let chosen = -1;
    for (let ri = 0; ri < reserves.length; ri++) {
      if (usedReserveIdxs.has(ri)) continue;
      if (reserves[ri].fantavoto === null) continue;
      const rCat = reserveCats[ri];
      if (rCat === null) continue;

      const reserveIsGk = rCat === "gk";
      if (starterIsGk !== reserveIsGk) continue;

      if (starterIsGk && reserveIsGk) {
        chosen = ri;
        break;
      }

      let newDef = currentDef;
      let newAtt = currentAtt;
      let newOffAtt = currentOffAtt;
      let newMid = currentMid;
      if (starterCat === "def") newDef--;
      if (starterCat === "att") newAtt--;
      if (starterCat === "off" || starterCat === "att") newOffAtt--;
      if (starterCat === "mid") newMid--;
      if (rCat === "def") newDef++;
      if (rCat === "att") newAtt++;
      if (rCat === "off" || rCat === "att") newOffAtt++;
      if (rCat === "mid") newMid++;

      if (
        newDef >= 3 &&
        newAtt <= 3 &&
        newOffAtt <= 5 &&
        (!requireMid || newMid >= 1)
      ) {
        chosen = ri;
        currentDef = newDef;
        currentAtt = newAtt;
        currentOffAtt = newOffAtt;
        currentMid = newMid;
        break;
      }
    }

    if (chosen !== -1) {
      usedReserveIdxs.add(chosen);
      reserveForStarter[si] = chosen;
      subsUsed++;
    }
  }

  return reserveForStarter;
}

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

  // gsr = GOAL SU RIGORE: gol segnato su rigore, va premiato come un gol normale.
  score += voteData.gsr * config.golFatto;
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

export type ScoreBand = { minScore: number; goals: number };

export interface ScoreConversion {
  enabled: boolean;
  bands: ScoreBand[];       // fasce punteggio->gol, in ordine di minScore crescente
  extrapolateStep: number;  // punti aggiuntivi per ogni gol oltre l'ultima fascia definita (default 4)
  homeFirstGoalThreshold: number; // 0 = disabilitato; se >0, sovrascrive SOLO la soglia del 1 gol per la squadra di casa (fattore campo "quota fissa", indipendente dal bonus punti fattore campo)
  bonusGoalEnabled: boolean;      // regola "vittoria e gol omaggio" (distacco minimo per fascia)
  bonusGoalDiffBandMargin: number; // distacco minimo richiesto quando le due squadre sono in fasce diverse
  bonusGoalSameBandMargin: number; // distacco minimo richiesto quando le due squadre sono nella stessa fascia
}

// Fasce ufficiali di conversione punteggio->gol: le prime due sono piu larghe
// (66-71,999 = 1 gol, 72-76,999 = 2 gol), poi si stabilizzano su 4 punti a gol.
export const DEFAULT_SCORE_CONVERSION: ScoreConversion = {
  enabled: false,
  bands: [
    { minScore: 66, goals: 1 },
    { minScore: 72, goals: 2 },
    { minScore: 77, goals: 3 },
    { minScore: 81, goals: 4 },
    { minScore: 85, goals: 5 },
    { minScore: 89, goals: 6 },
  ],
  extrapolateStep: 4,
  homeFirstGoalThreshold: 0,
  bonusGoalEnabled: false,
  bonusGoalDiffBandMargin: 3,
  bonusGoalSameBandMargin: 4,
};

/**
 * Normalizza un oggetto scoreConversion letto dal DB (anche nel vecchio
 * formato {enabled, minScore, step}, senza fasce esplicite) nel formato
 * attuale a fasce. Cosi le leghe che avevano gia salvato minScore/step
 * continuano a funzionare identiche a prima, e ogni campo nuovo mancante
 * prende un default sicuro (disabilitato).
 */
export function normalizeScoreConversion(
  raw: (Partial<ScoreConversion> & { minScore?: number; step?: number }) | null | undefined
): ScoreConversion {
  if (!raw) return { ...DEFAULT_SCORE_CONVERSION, bands: DEFAULT_SCORE_CONVERSION.bands.map((b) => ({ ...b })) };

  let bands = raw.bands;
  let extrapolateStep = raw.extrapolateStep;

  if (!bands || !Array.isArray(bands) || bands.length === 0) {
    // Formato precedente: fasce uniformi generate da minScore/step
    const minScore = typeof raw.minScore === "number" ? raw.minScore : DEFAULT_SCORE_CONVERSION.bands[0].minScore;
    const step = typeof raw.step === "number" && raw.step > 0 ? raw.step : DEFAULT_SCORE_CONVERSION.extrapolateStep;
    bands = Array.from({ length: 6 }, (_, i) => ({ minScore: minScore + i * step, goals: i + 1 }));
    extrapolateStep = step;
  }
  if (!extrapolateStep || extrapolateStep <= 0) extrapolateStep = DEFAULT_SCORE_CONVERSION.extrapolateStep;

  return {
    enabled: Boolean(raw.enabled),
    bands: [...bands].sort((a, b) => a.minScore - b.minScore),
    extrapolateStep,
    homeFirstGoalThreshold: typeof raw.homeFirstGoalThreshold === "number" ? raw.homeFirstGoalThreshold : 0,
    bonusGoalEnabled: Boolean(raw.bonusGoalEnabled),
    bonusGoalDiffBandMargin:
      typeof raw.bonusGoalDiffBandMargin === "number" ? raw.bonusGoalDiffBandMargin : DEFAULT_SCORE_CONVERSION.bonusGoalDiffBandMargin,
    bonusGoalSameBandMargin:
      typeof raw.bonusGoalSameBandMargin === "number" ? raw.bonusGoalSameBandMargin : DEFAULT_SCORE_CONVERSION.bonusGoalSameBandMargin,
  };
}

/**
 * Converte il punteggio totale di una formazione in numero di gol (sistema
 * Mantra), usando le fasce configurate (non necessariamente a step fisso:
 * le prime fasce possono essere piu larghe delle successive). Oltre
 * l'ultima fascia definita, si continua ad aggiungere un gol ogni
 * extrapolateStep punti. firstBandOverride sovrascrive SOLO la soglia
 * della prima fascia (usato per la soglia fissa "quota" della squadra di
 * casa, regola separata dal bonus punti fattore campo).
 */
export function convertScoreToGoals(
  score: number,
  conv: ScoreConversion = DEFAULT_SCORE_CONVERSION,
  firstBandOverride?: number
): number {
  if (!conv.enabled) return 0;
  const bands = [...conv.bands].sort((a, b) => a.minScore - b.minScore);
  if (bands.length === 0) return 0;
  if (firstBandOverride !== undefined && firstBandOverride > 0) {
    bands[0] = { ...bands[0], minScore: firstBandOverride };
  }
  if (score < bands[0].minScore) return 0;

  const step = conv.extrapolateStep > 0 ? conv.extrapolateStep : 4;
  for (let i = bands.length - 1; i >= 0; i--) {
    if (score >= bands[i].minScore) {
      if (i === bands.length - 1) {
        return bands[i].goals + Math.floor((score - bands[i].minScore) / step);
      }
      return bands[i].goals;
    }
  }
  return 0;
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
 * titolare e dei 3 migliori difensori (terzini/centrali) tra quelli
 * EFFETTIVAMENTE schierati (titolari, o le riserve entrate al loro posto).
 * Scatta SOLO se la difesa e a 4 (o piu) - una difesa a 3, come nel caso di
 * un 3-5-2, non da mai diritto al modificatore, ne come formazione di
 * partenza ne dopo i cambi - e se portiere e TUTTI i difensori considerati
 * sono andati a voto: se anche uno solo e sv/assente, niente modificatore
 * per quella squadra in quella giornata.
 */
export function calculateDefenseModifier(
  starters: Array<{ mantraRole: string; vote: number | null }>,
  thresholds: DefenseThreshold[] = DEFAULT_DEFENSE_THRESHOLDS
): DefenseModifierResult {
  const nullResult: DefenseModifierResult = { applies: false, average: null, malus: 0 };

  const gk = starters.find((s) => s.mantraRole === "POR");
  if (!gk || gk.vote === null) return nullResult;

  const defenders = starters.filter((s) => s.mantraRole === "TER" || s.mantraRole === "DC");
  if (defenders.length < 4) return nullResult;
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
