import type { Metadata } from "next";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { computeGroupStandings, computeCupMatchResult, type CupMatchResult } from "@/app/lib/cupStandings";
import { getCupRules, type CupRules } from "@/app/lib/leagueSettings";
import { loadCupForfeits, loadCupBracketPos } from "@/app/lib/cupForfeits";
import { computeKnockoutTies, tieLabel, type KnockoutTie } from "@/app/lib/cupKnockout";

export const metadata: Metadata = { title: "Coppe" };

type CupMatch = {
  id: number;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: string;
  awayTeam: string;
  homeUserId: number;
  awayUserId: number;
  roundSlot: number | null;
  bracketPos: number | null;
  homeForfeit?: boolean;
  awayForfeit?: boolean;
};

type CupRound = {
  id: number;
  name: string;
  number: number;
  type: "eliminazione" | "girone";
  matchdayNumber: number | null;
  playDate: string | null;
  slotMatchdays: Record<number, number | null>;
  matches: CupMatch[];
};

type Cup = {
  id: number;
  name: string;
  rounds: CupRound[];
};

export default async function CoppePage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const seasonRes = await db.execute(`SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return <div className="text-center py-12 text-gray-500">Nessuna stagione attiva.</div>;
  }

  const cupsRes = await db.execute({
    sql: `SELECT id, name FROM "Cup" WHERE seasonId = ? ORDER BY id ASC`,
    args: [season.id],
  });

  if (cupsRes.rows.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">
          Coppe — <span className="text-green-700">{season.name as string}</span>
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center text-amber-700">
          <div className="text-4xl mb-3">🏆</div>
          <p className="font-medium">Nessuna coppa configurata.</p>
          <p className="text-sm mt-1">L&apos;admin può crearle da Admin → Gestisci Coppe.</p>
        </div>
      </div>
    );
  }

  const cups: Cup[] = await Promise.all(
    cupsRes.rows.map(async (cup) => {
      // "type" e' una colonna aggiunta dopo (fase a gironi) - se il DB non e'
      // ancora migrato, ricadiamo su un turno "eliminazione" per tutti.
      let roundsRes;
      try {
        roundsRes = await db.execute({
          sql: `SELECT id, name, number, type, matchdayNumber, playDate FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`,
          args: [cup.id],
        });
      } catch {
        roundsRes = await db.execute({
          sql: `SELECT id, name, number FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`,
          args: [cup.id],
        });
      }

      const rounds: CupRound[] = await Promise.all(
        roundsRes.rows.map(async (round) => {
          // "roundSlot" e' una colonna aggiunta dopo (turni interni del
          // girone) - se il DB non e' ancora migrato, ricadiamo su un
          // elenco piatto di partite senza raggruppamento.
          let matchesRes;
          try {
            matchesRes = await db.execute({
              sql: `SELECT cm.id, cm.homeScore, cm.awayScore, cm.homeUserId, cm.awayUserId, cm.roundSlot,
                           hu.teamName as homeTeam, au.teamName as awayTeam
                    FROM "CupMatch" cm
                    JOIN "User" hu ON hu.id = cm.homeUserId
                    JOIN "User" au ON au.id = cm.awayUserId
                    WHERE cm.cupRoundId = ?`,
              args: [round.id],
            });
          } catch {
            matchesRes = await db.execute({
              sql: `SELECT cm.id, cm.homeScore, cm.awayScore, cm.homeUserId, cm.awayUserId,
                           hu.teamName as homeTeam, au.teamName as awayTeam
                    FROM "CupMatch" cm
                    JOIN "User" hu ON hu.id = cm.homeUserId
                    JOIN "User" au ON au.id = cm.awayUserId
                    WHERE cm.cupRoundId = ?`,
              args: [round.id],
            });
          }
          const forfeits = await loadCupForfeits(round.id as number);
          const bracketPos = await loadCupBracketPos(round.id as number);
          // Giornata di andata/ritorno (o dei turni interni dei gironi)
          let slotMatchdays: Record<number, number | null> = {};
          try {
            const slotsRes = await db.execute({
              sql: `SELECT slot, matchdayNumber FROM "CupRoundSlot" WHERE cupRoundId = ?`,
              args: [round.id],
            });
            slotMatchdays = Object.fromEntries(
              slotsRes.rows.map((r) => [r.slot as number, (r.matchdayNumber as number | null) ?? null])
            );
          } catch { /* tabella non ancora migrata */ }

          return {
            id: round.id as number,
            name: round.name as string,
            number: round.number as number,
            type: ((round.type as string | undefined) ?? "eliminazione") as "eliminazione" | "girone",
            matchdayNumber: (round.matchdayNumber as number | null | undefined) ?? null,
            playDate: (round.playDate as string | null | undefined) ?? null,
            slotMatchdays,
            matches: matchesRes.rows.map((m) => ({
              id: m.id as number,
              homeScore: m.homeScore as number | null,
              awayScore: m.awayScore as number | null,
              homeTeam: m.homeTeam as string,
              awayTeam: m.awayTeam as string,
              homeUserId: m.homeUserId as number,
              awayUserId: m.awayUserId as number,
              roundSlot: (m.roundSlot as number | null | undefined) ?? null,
              homeForfeit: forfeits[m.id as number]?.homeForfeit ?? false,
              awayForfeit: forfeits[m.id as number]?.awayForfeit ?? false,
              bracketPos: bracketPos[m.id as number] ?? null,
            })),
          };
        })
      );

      return { id: cup.id as number, name: cup.name as string, rounds };
    })
  );

  const rules = await getCupRules(db, season.id as number);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold text-gray-800">
        Coppe — <span className="text-green-700">{season.name as string}</span>
      </h1>

      {cups.map((cup) => {
        const groupRounds = cup.rounds.filter((r) => r.type === "girone");
        const knockoutRounds = cup.rounds.filter((r) => r.type !== "girone");

        return (
          <div key={cup.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="bg-yellow-600 text-white px-5 py-3 font-bold text-lg flex items-center gap-2">
              {"\ud83c\udfc6"} {cup.name}
            </div>

            {cup.rounds.length === 0 ? (
              <div className="p-4 text-gray-400 text-sm">Nessun turno configurato.</div>
            ) : (
              <>
                {/* Gironi: classifica + risultati di ogni partita, per ognuno */}
                {groupRounds.length > 0 && (
                  <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5 border-b">
                    {groupRounds.map((round) => (
                      <div key={round.id} className="space-y-3">
                        <GroupStandings round={round} currentUserId={session.userId} rules={rules} />
                        <GroupMatches round={round} currentUserId={session.userId} rules={rules} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Turni a eliminazione diretta: tabellone torneo */}
                {knockoutRounds.length > 0 && canShowBracket(knockoutRounds) && (
                  <KnockoutBracket
                    rounds={knockoutRounds}
                    groupNames={groupRounds.map((r) => r.name)}
                    currentUserId={session.userId}
                    rules={rules}
                  />
                )}

                {/* Partite aggiunte a mano (senza posizione nel tabellone):
                    vecchia vista a colonne */}
                {knockoutRounds.length > 0 && !canShowBracket(knockoutRounds) && (
                  <div className="overflow-x-auto">
                    <div className="flex min-w-max p-5 gap-0">
                      {knockoutRounds.map((round, roundIdx) => {
                        const isLast = roundIdx === knockoutRounds.length - 1;
                        return (
                          <div key={round.id} className="flex items-stretch">
                            {/* Round column */}
                            <div className="w-72">
                              <div className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4 text-center px-2 pb-2 border-b">
                                {round.name}
                                {formatSchedule(round) && (
                                  <div className="text-[10px] font-normal normal-case text-gray-400 mt-1">
                                    {formatSchedule(round)}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col justify-around h-full gap-4">
                                {round.matches.length === 0 ? (
                                  <p className="text-gray-300 text-sm text-center py-4">{"\u2013"}</p>
                                ) : round.matches.some((m) => m.bracketPos !== null) ? (
                                  (() => {
                                    const ties = computeKnockoutTies(round.matches, rules);
                                    return ties.map((t) => (
                                      <TieCard
                                        key={t.pos}
                                        tie={t}
                                        label={tieLabel(t.pos, ties.length)}
                                        slotMatchdays={round.slotMatchdays}
                                        currentUserId={session.userId}
                                        rules={rules}
                                      />
                                    ));
                                  })()
                                ) : (
                                  round.matches.map((m) => (
                                    <MatchCard
                                      key={m.id}
                                      match={m}
                                      currentUserId={session.userId}
                                      rules={rules}
                                    />
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Connector arrow */}
                            {!isLast && (
                              <div className="w-10 flex items-center justify-center text-gray-200 text-2xl select-none shrink-0">
                                {"\u2192"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabellone torneo: una colonna per turno (quarti, semifinale, finale) piu' la
// coppa per il vincitore, unite da linee. I turni non ancora creati o non
// ancora sorteggiati compaiono comunque, con "Vincente Q1" ecc. (o il nome
// della squadra, appena la sfida precedente ha un vincitore).
// ---------------------------------------------------------------------------

/** Il tabellone serve solo se le partite hanno la posizione (bracketPos). */
function canShowBracket(rounds: CupRound[]): boolean {
  return rounds.every((r) => r.matches.length === 0 || r.matches.some((m) => m.bracketPos !== null));
}

type Slot = { id: number | null; name: string; placeholder: boolean };

type BracketCell =
  | { kind: "tie"; tie: KnockoutTie; label: string }
  | { kind: "planned"; pos: number; label: string; team1: Slot; team2: Slot; twoLegs: boolean; winnerId: null };

type BracketColumn = {
  title: string;
  round: CupRound | null;
  cells: BracketCell[];
};

function defaultRoundName(tieCount: number): string {
  if (tieCount === 1) return "Finale";
  if (tieCount === 2) return "Semifinale";
  if (tieCount === 4) return "Quarti di finale";
  if (tieCount === 8) return "Ottavi di finale";
  return `Turno a ${tieCount * 2}`;
}

function shortTieLabel(pos: number, tieCount: number): string {
  if (tieCount === 1) return "F";
  if (tieCount === 2) return `SF${pos}`;
  if (tieCount === 4) return `Q${pos}`;
  return `S${pos}`;
}

// Quarti incrociati, come crossedQuarterFinals in app/lib/cupKnockout.ts:
// Q1 1A-4B, Q2 2B-3A, Q3 2A-3B, Q4 1B-4A.
const CROSSED_QF: [number, number, number, number][] = [
  [1, 0, 4, 1],
  [2, 1, 3, 0],
  [2, 0, 3, 1],
  [1, 1, 4, 0],
];

function cellWinner(c: BracketCell): Slot | null {
  if (c.kind !== "tie" || c.tie.winnerId === null) return null;
  const t = c.tie;
  return { id: t.winnerId, name: t.winnerId === t.team1Id ? t.team1 : t.team2, placeholder: false };
}

function buildBracket(rounds: CupRound[], groupNames: string[], rules: CupRules): BracketColumn[] {
  const firstTies = rounds[0].matches.length > 0 ? computeKnockoutTies(rounds[0].matches, rules) : [];
  // Numero di sfide del primo turno (potenza di 2): dalle partite, o 4 se
  // il turno non e' ancora sorteggiato.
  let size = firstTies.length > 0 ? Math.max(...firstTies.map((t) => t.pos), firstTies.length) : 4;
  size = 2 ** Math.ceil(Math.log2(Math.max(1, size)));

  const columns: BracketColumn[] = [];
  for (let level = 0, count = size; count >= 1; level++, count = count / 2) {
    const round = rounds[level] ?? null;
    const ties = round && round.matches.length > 0 ? computeKnockoutTies(round.matches, rules) : [];
    const prev = columns[level - 1];
    const cells: BracketCell[] = [];
    for (let pos = 1; pos <= count; pos++) {
      const label = tieLabel(pos, count);
      const tie = ties.find((t) => t.pos === pos);
      if (tie) {
        cells.push({ kind: "tie", tie, label });
        continue;
      }
      let team1: Slot, team2: Slot;
      if (prev) {
        const prevCount = count * 2;
        const from = (p: number): Slot =>
          cellWinner(prev.cells[p - 1]) ?? { id: null, name: `Vincente ${shortTieLabel(p, prevCount)}`, placeholder: true };
        team1 = from(2 * pos - 1);
        team2 = from(2 * pos);
      } else if (count === 4 && groupNames.length === 2) {
        const [p1, g1, p2, g2] = CROSSED_QF[pos - 1];
        team1 = { id: null, name: `${p1}° ${groupNames[g1]}`, placeholder: true };
        team2 = { id: null, name: `${p2}° ${groupNames[g2]}`, placeholder: true };
      } else {
        team1 = { id: null, name: "Da definire", placeholder: true };
        team2 = { id: null, name: "Da definire", placeholder: true };
      }
      cells.push({ kind: "planned", pos, label, team1, team2, twoLegs: count > 1, winnerId: null });
    }
    columns.push({ title: round?.name ?? defaultRoundName(count), round, cells });
  }
  return columns;
}

function KnockoutBracket({
  rounds,
  groupNames,
  currentUserId,
  rules,
}: {
  rounds: CupRound[];
  groupNames: string[];
  currentUserId: number;
  rules: CupRules;
}) {
  const columns = buildBracket(rounds, groupNames, rules);
  const final = columns[columns.length - 1].cells[0];
  const champion = final ? cellWinner(final) : null;
  const line = "border-gray-300";

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-stretch p-5">
        {columns.map((col, ci) => {
          const isFirst = ci === 0;
          const schedule = col.round ? formatSchedule(col.round) : null;
          return (
            <div key={ci} className="flex w-72 flex-col">
              <div className="mx-4 mb-2 flex h-12 flex-col justify-center border-b pb-2 text-center">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-400">{col.title}</div>
                <div className="mt-0.5 text-[10px] text-gray-400">
                  {schedule ?? (col.cells.length === 1 ? "Partita secca" : "Andata e ritorno")}
                </div>
              </div>
              <div className="flex flex-1 flex-col">
                {col.cells.map((cell, i) => {
                  const topOfPair = i % 2 === 0;
                  return (
                    <div key={i} className="relative flex flex-1 items-center px-4 py-2">
                      {/* linea in entrata dal turno precedente */}
                      {!isFirst && <div className={`absolute left-0 top-1/2 w-4 border-t-2 ${line}`} />}
                      {/* linea in uscita verso il turno successivo (anche la
                          finale, verso la coppa) */}
                      <div className={`absolute right-0 top-1/2 w-4 border-t-2 ${line}`} />
                      {col.cells.length > 1 && (
                        <div
                          className={`absolute right-0 border-r-2 ${line} ${topOfPair ? "top-1/2 bottom-0" : "top-0 bottom-1/2"}`}
                        />
                      )}
                      <div className="w-full">
                        {cell.kind === "tie" ? (
                          <TieCard
                            tie={cell.tie}
                            label={cell.label}
                            slotMatchdays={col.round?.slotMatchdays ?? {}}
                            currentUserId={currentUserId}
                            rules={rules}
                          />
                        ) : (
                          <PlannedTieCard
                            cell={cell}
                            slotMatchdays={col.round?.slotMatchdays ?? {}}
                            currentUserId={currentUserId}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Vincitore */}
        <div className="flex w-52 flex-col">
          <div className="mx-4 mb-2 flex h-12 flex-col justify-center border-b pb-2 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Vincitore</div>
          </div>
          <div className="relative flex flex-1 items-center px-4 py-2">
            <div className={`absolute left-0 top-1/2 w-4 border-t-2 ${line}`} />
            <div
              className={`w-full rounded-xl border-2 p-4 text-center ${
                champion ? "border-yellow-400 bg-yellow-50" : "border-dashed border-gray-200 bg-white"
              }`}
            >
              <div className="text-3xl">{"🏆"}</div>
              <div
                className={`mt-1 truncate text-sm font-bold ${
                  champion ? (champion.id === currentUserId ? "text-green-700" : "text-yellow-800") : "text-gray-300"
                }`}
              >
                {champion ? champion.name : "?"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sfida non ancora sorteggiata: squadre previste (o "Vincente Q1") e quando
// si gioca, se il turno ha gia' le giornate.
function PlannedTieCard({
  cell,
  slotMatchdays,
  currentUserId,
}: {
  cell: Extract<BracketCell, { kind: "planned" }>;
  slotMatchdays: Record<number, number | null>;
  currentUserId: number;
}) {
  const isMine = cell.team1.id === currentUserId || cell.team2.id === currentUserId;
  const row = (s: Slot) => (
    <div className="flex items-center justify-between bg-white px-3 py-2">
      <span
        className={`max-w-[180px] truncate ${
          s.placeholder ? "italic text-gray-400" : s.id === currentUserId ? "font-medium text-green-700" : "font-medium text-gray-700"
        }`}
      >
        {s.name}
      </span>
      <span className="ml-2 font-bold text-gray-300">–</span>
    </div>
  );
  const legs = cell.twoLegs ? [1, 2] : [1];
  return (
    <div
      className={`overflow-hidden rounded-xl border border-dashed text-sm ${isMine ? "border-green-300" : "border-gray-300"}`}
    >
      <div className="border-b bg-gray-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {cell.label}
      </div>
      <div className="border-b">{row(cell.team1)}</div>
      {row(cell.team2)}
      <div className="space-y-0.5 border-t bg-gray-50 px-3 py-1.5">
        {legs.map((slot) => {
          const md = slotMatchdays[slot];
          return (
            <div key={slot} className="text-[11px] text-gray-400">
              {cell.twoLegs ? (slot === 1 ? "Andata" : "Ritorno") : "Partita secca"}
              {md != null && <span> · G{md}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Etichetta "quando si gioca" per un turno/girone: giornata di campionato
// e/o data, solo informativa (nessun calcolo automatico dal punteggio).
function formatSchedule(round: CupRound): string | null {
  const parts: string[] = [];
  const isBracket = round.type !== "girone" && round.matches.some((m) => m.bracketPos !== null);
  const legSlots = [...new Set(round.matches.map((m) => m.roundSlot ?? 1))].sort((a, b) => a - b);
  if (isBracket && legSlots.some((s) => round.slotMatchdays[s] != null)) {
    const mds = legSlots.map((s) => round.slotMatchdays[s]).filter((n): n is number => n != null);
    parts.push(mds.length > 1 ? `Giornate ${mds.join(" e ")}` : `Giornata ${mds[0]}`);
  } else if (round.matchdayNumber !== null) parts.push(`Giornata ${round.matchdayNumber}`);
  if (round.playDate) {
    const d = new Date(round.playDate);
    if (!isNaN(d.getTime())) {
      parts.push(d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }));
    }
  }
  return parts.length > 0 ? parts.join(" " + String.fromCharCode(183) + " ") : null;
}

// Risultato di una partita, decisi dalle STESSE regole di lega (distacco
// minimo per vincere, bonus gol per fascia) invece che dal confronto diretto
// dei due punteggi - vedi computeCupMatchResult in app/lib/cupStandings.ts.
function getMatchResult(m: CupMatch, rules: CupRules): { result: CupMatchResult; played: boolean; homeWins: boolean; awayWins: boolean; draw: boolean } {
  const result = computeCupMatchResult(m.homeScore, m.awayScore, rules, m);
  const played = result.homePoints !== null;
  const homeWins = played && result.homePoints === 3;
  const awayWins = played && result.awayPoints === 3;
  const draw = played && result.homePoints === 1;
  return { result, played, homeWins, awayWins, draw };
}

// Sfida del tabellone: andata e ritorno (o partita secca), risultato
// complessivo e chi passa il turno.
function TieCard({
  tie: t,
  label,
  slotMatchdays,
  currentUserId,
  rules,
}: {
  tie: KnockoutTie;
  label: string;
  slotMatchdays: Record<number, number | null>;
  currentUserId: number;
  rules: CupRules;
}) {
  const isMine = t.team1Id === currentUserId || t.team2Id === currentUserId;
  const anyPlayed = t.legs.some((l) => l.homeScore !== null || l.homeForfeit || l.awayForfeit);
  const row = (id: number, name: string, goals: number) => {
    const won = t.winnerId === id;
    const lost = t.winnerId !== null && !won;
    return (
      <div className={`flex items-center justify-between px-3 py-2 ${won ? "bg-green-50" : lost ? "bg-red-50" : "bg-white"}`}>
        <span className={`font-medium truncate max-w-[150px] ${id === currentUserId ? "text-green-700" : won ? "text-green-800" : "text-gray-700"}`}>
          {won && "🏆 "}
          {name}
        </span>
        <span className={`font-bold tabular-nums ml-2 ${won ? "text-green-700" : anyPlayed ? "text-gray-700" : "text-gray-300"}`}>
          {anyPlayed ? goals : "–"}
        </span>
      </div>
    );
  };
  return (
    <div className={`rounded-xl border overflow-hidden text-sm shadow-sm ${isMine ? "border-green-300 shadow-green-100" : "border-gray-200"}`}>
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 border-b">{label}</div>
      <div className="border-b">{row(t.team1Id, t.team1, t.team1Goals)}</div>
      {row(t.team2Id, t.team2, t.team2Goals)}
      <div className="px-3 py-1.5 border-t bg-gray-50 space-y-0.5">
        {t.legs.map((l) => {
          const r = computeCupMatchResult(l.homeScore, l.awayScore, rules, l);
          const played = r.homeGoals !== null && r.awayGoals !== null;
          const md = slotMatchdays[l.roundSlot ?? 1];
          const legName = t.twoLegs ? ((l.roundSlot ?? 1) === 1 ? "Andata" : "Ritorno") : "Partita";
          return (
            <div key={l.id} className="flex justify-between gap-2 text-[11px] text-gray-500">
              <span>
                {legName}
                {md != null && <span className="text-gray-400"> · G{md}</span>}
              </span>
              <span
                className="tabular-nums truncate text-right"
                title={played && l.homeScore !== null ? `${l.homeScore.toFixed(1)} a ${l.awayScore?.toFixed(1)}` : undefined}
              >
                {played ? `${l.homeTeam} ${r.homeGoals}-${r.awayGoals} ${l.awayTeam}` : `${l.homeTeam} – ${l.awayTeam}`}
                {(l.homeForfeit || l.awayForfeit) && " ⚖️"}
              </span>
            </div>
          );
        })}
        {t.winnerId !== null && t.decidedBy !== "gol" && (
          <div className="text-[11px] text-green-700">
            {t.decidedBy === "fantapunti"
              ? `Passa per fantapunti (${t.team1Score.toFixed(1)} a ${t.team2Score.toFixed(1)})`
              : "Passa la testa di serie"}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCard({
  match: m,
  currentUserId,
  rules,
}: {
  match: CupMatch;
  currentUserId: number;
  rules: CupRules;
}) {
  const { result, played, homeWins, awayWins, draw } = getMatchResult(m, rules);
  const isMyMatch = m.homeUserId === currentUserId || m.awayUserId === currentUserId;

  return (
    <div
      className={`rounded-xl border overflow-hidden text-sm shadow-sm ${
        isMyMatch ? "border-green-300 shadow-green-100" : "border-gray-200"
      }`}
    >
      {/* Home team */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b ${
          homeWins ? "bg-green-50" : draw ? "bg-gray-50" : played ? "bg-red-50" : "bg-white"
        }`}
      >
        <span
          className={`font-medium truncate max-w-[120px] ${
            m.homeUserId === currentUserId
              ? "text-green-700"
              : homeWins
              ? "text-green-800"
              : "text-gray-700"
          }`}
        >
          {homeWins && "🏆 "}
          {m.homeTeam}
        </span>
        <span className="flex items-baseline gap-1.5 ml-2 shrink-0">
          <span className={`font-bold ${homeWins ? "text-green-700" : played ? "text-gray-700" : "text-gray-300"}`}>
            {!played ? "–" : result.homeGoals !== null ? result.homeGoals : m.homeScore?.toFixed(1)}
          </span>
          {played && result.homeGoals !== null && m.homeScore !== null && (
            <span className={`text-xs tabular-nums ${homeWins ? "text-green-600" : "text-gray-400"}`}>
              ({m.homeScore?.toFixed(1)})
            </span>
          )}
        </span>
      </div>

      {/* Away team */}
      <div
        className={`flex items-center justify-between px-3 py-2 ${
          awayWins ? "bg-green-50" : draw ? "bg-gray-50" : played ? "bg-red-50" : "bg-white"
        }`}
      >
        <span
          className={`font-medium truncate max-w-[120px] ${
            m.awayUserId === currentUserId
              ? "text-green-700"
              : awayWins
              ? "text-green-800"
              : "text-gray-700"
          }`}
        >
          {awayWins && "🏆 "}
          {m.awayTeam}
        </span>
        <span className="flex items-baseline gap-1.5 ml-2 shrink-0">
          <span className={`font-bold ${awayWins ? "text-green-700" : played ? "text-gray-700" : "text-gray-300"}`}>
            {!played ? "–" : result.awayGoals !== null ? result.awayGoals : m.awayScore?.toFixed(1)}
          </span>
          {played && result.awayGoals !== null && m.awayScore !== null && (
            <span className={`text-xs tabular-nums ${awayWins ? "text-green-600" : "text-gray-400"}`}>
              ({m.awayScore?.toFixed(1)})
            </span>
          )}
        </span>
      </div>
      {(m.homeForfeit || m.awayForfeit) && (
        <div className="px-3 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border-t border-amber-200">
          ⚖️ Risultato a tavolino
        </div>
      )}
    </div>
  );
}

// Elenco di sola lettura delle partite di un girone, raggruppate per turno
// interno (Turno 1, 2, ...) come in admin - cosi' anche chi non e' admin
// vede il risultato di ogni singola partita, non solo la classifica finale.
function GroupMatches({
  round,
  currentUserId,
  rules,
}: {
  round: CupRound;
  currentUserId: number;
  rules: CupRules;
}) {
  if (round.matches.length === 0) return null;

  // Nome squadra per ogni id (serve per calcolare chi riposa in ogni turno
  // interno: la squadra del girone che quel turno non compare fra i due
  // team di nessuna partita) - stessa logica di groupMatchesBySlot in
  // AdminCoppeClient.tsx, qui riusata anche lato pubblico.
  const teamNames = new Map<number, string>();
  for (const m of round.matches) {
    teamNames.set(m.homeUserId, m.homeTeam);
    teamNames.set(m.awayUserId, m.awayTeam);
  }
  const allTeamIds = [...teamNames.keys()];

  const bySlot = new Map<number, CupMatch[]>();
  for (const m of round.matches) {
    const slot = m.roundSlot ?? 0;
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot)!.push(m);
  }
  const slots = [...bySlot.entries()].sort((a, b) => a[0] - b[0]);
  const showSlots = round.matches.every((m) => m.roundSlot !== null) && slots.length > 1;

  const restingIn = (slotMatches: CupMatch[]): string[] => {
    const playingIds = new Set<number>();
    for (const m of slotMatches) {
      playingIds.add(m.homeUserId);
      playingIds.add(m.awayUserId);
    }
    return allTeamIds.filter((id) => !playingIds.has(id)).map((id) => teamNames.get(id) as string);
  };

  const renderRow = (m: CupMatch) => {
    const { result, played, homeWins, awayWins } = getMatchResult(m, rules);
    const isMyMatch = m.homeUserId === currentUserId || m.awayUserId === currentUserId;
    return (
      <div
        key={m.id}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
          isMyMatch ? "bg-green-50/60" : "bg-white"
        }`}
      >
        <span className={`flex-1 text-right truncate ${homeWins ? "font-semibold text-green-700" : "text-gray-600"}`}>
          {m.homeTeam}
        </span>
        <span className="shrink-0 flex flex-col items-center px-1 min-w-[64px]">
          <span
            className={`font-bold tabular-nums px-2 py-0.5 rounded text-xs text-center ${
              !played
                ? "text-gray-300"
                : homeWins || awayWins
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {played
              ? result.homeGoals !== null && result.awayGoals !== null
                ? `${result.homeGoals}-${result.awayGoals}`
                : `${m.homeScore?.toFixed(1)}-${m.awayScore?.toFixed(1)}`
              : "vs"}
          </span>
          {m.homeForfeit || m.awayForfeit ? (
            <span className="text-[10px] font-semibold text-amber-700 mt-0.5">⚖️ tavolino</span>
          ) : played && result.homeGoals !== null && (
            <span className="text-[10px] text-gray-400 tabular-nums mt-0.5">
              ({m.homeScore?.toFixed(1)} a {m.awayScore?.toFixed(1)})
            </span>
          )}
        </span>
        <span className={`flex-1 truncate ${awayWins ? "font-semibold text-green-700" : "text-gray-600"}`}>
          {m.awayTeam}
        </span>
      </div>
    );
  };

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Risultati
      </div>
      <div className="p-3 space-y-3">
        {showSlots
          ? slots.map(([slot, matches]) => {
              const resting = restingIn(matches);
              return (
                <div key={slot}>
                  <p className="text-[11px] mb-1">
                    <span className="font-semibold text-amber-700">Turno {slot}</span>
                    {resting.length > 0 && (
                      <span className="text-gray-400"> — riposa: {resting.join(", ")}</span>
                    )}
                  </p>
                  <div className="space-y-1">{matches.map(renderRow)}</div>
                </div>
              );
            })
          : <div className="space-y-1">{round.matches.map(renderRow)}</div>}
      </div>
    </div>
  );
}

function GroupStandings({
  round,
  currentUserId,
  rules,
}: {
  round: CupRound;
  currentUserId: number;
  rules: CupRules;
}) {
  const standings = computeGroupStandings(round.matches, rules);
  const qualifyCount = Math.min(4, standings.length);

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 border-b">
        <h3 className="font-semibold text-gray-700 text-sm">{round.name}</h3>
        {formatSchedule(round) && (
          <p className="text-xs text-gray-400 mt-0.5">{formatSchedule(round)}</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide">
              <th className="text-left font-medium px-3 py-2">#</th>
              <th className="text-left font-medium px-3 py-2">Squadra</th>
              <th className="text-center font-medium px-2 py-2">PG</th>
              <th className="text-center font-medium px-2 py-2">V</th>
              <th className="text-center font-medium px-2 py-2">N</th>
              <th className="text-center font-medium px-2 py-2">P</th>
              <th className="text-center font-medium px-2 py-2">DR</th>
              <th className="text-center font-medium px-3 py-2">Pt</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const qualified = i < qualifyCount;
              const isMe = s.userId === currentUserId;
              return (
                <tr
                  key={s.userId}
                  className={`border-t ${qualified ? "bg-green-50" : ""} ${isMe ? "font-semibold" : ""}`}
                >
                  <td className={`px-3 py-2 ${qualified ? "text-green-700" : "text-gray-400"}`}>{i + 1}</td>
                  <td className={`px-3 py-2 truncate max-w-[160px] ${isMe ? "text-green-700" : "text-gray-700"}`}>
                    {s.teamName}
                  </td>
                  <td className="text-center px-2 py-2 text-gray-500">{s.played}</td>
                  <td className="text-center px-2 py-2 text-gray-500">{s.wins}</td>
                  <td className="text-center px-2 py-2 text-gray-500">{s.draws}</td>
                  <td className="text-center px-2 py-2 text-gray-500">{s.losses}</td>
                  <td className="text-center px-2 py-2 text-gray-500 tabular-nums">
                    {s.diff > 0 ? `+${s.diff.toFixed(1)}` : s.diff.toFixed(1)}
                  </td>
                  <td className="text-center px-3 py-2 font-bold text-gray-800">{s.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {qualifyCount > 0 && (
        <div className="px-4 py-2 border-t bg-green-50/60 text-xs text-green-700">
          {"\u2713"} Le prime {qualifyCount} passano il turno
        </div>
      )}
    </div>
  );
}
