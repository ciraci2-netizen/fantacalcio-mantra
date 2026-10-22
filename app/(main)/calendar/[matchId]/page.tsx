import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import TeamLogo from "@/app/components/TeamLogo";
import Confetti from "@/app/components/Confetti";
import { roleBadgeClass } from "@/app/lib/roles";
import { computeAutoSubstitutions, fantavotoBreakdown, type BonusItem } from "@/app/lib/scoring";
import { setMatchForfeit } from "@/app/actions/forfeit";

const HARD_MAX_SUBSTITUTIONS = 5;

// Usa la stessa logica di sostituzione automatica di calculateScoresCore
// (app/lib/voteImporter.ts) - vedi computeAutoSubstitutions in
// app/lib/scoring.ts, unica fonte di verita condivisa dai due file. Qui
// serve solo per capire QUALI riserve sono effettivamente entrate in campo
// e QUALI titolari sono usciti, per evidenziarli nel tabellino.
function computeSubstitutionIds(
  slots: PlayerSlot[],
  maxSubstitutions: number
): { inIds: Set<number>; outIds: Set<number> } {
  const starters = slots.filter((s) => s.isStarter);
  const reserves = slots.filter((s) => !s.isStarter);
  const inIds = new Set<number>();
  const outIds = new Set<number>();

  const reserveForStarter = computeAutoSubstitutions(starters, reserves, maxSubstitutions);
  reserveForStarter.forEach((rIdx, si) => {
    if (rIdx !== null) {
      inIds.add(reserves[rIdx].playerId);
      outIds.add(starters[si].playerId);
    }
  });

  return { inIds, outIds };
}

type PlayerSlot = {
  playerId: number;
  name: string;
  mantraRole: string;
  vote: number | null;
  fantavoto: number | null;
  isStarter: boolean;
  bonuses: BonusItem[];
};

// Ricostruisce SOLO quali giocatori sono stati considerati per il
// modificatore difensivo (portiere + 3 migliori difensori titolari, per
// VOTO - mai fantavoto, vedi calculateDefenseModifier in app/lib/scoring.ts),
// per renderlo verificabile nel tabellino. Il malus vero resta quello gia
// salvato su Match (calcolato da calculateScoresCore): qui non lo si
// ricalcola, si mostra solo la composizione usata per arrivarci.
type DefenseConsidered = { gk: PlayerSlot; defenders: PlayerSlot[] } | null;

function pickDefenseConsidered(slots: PlayerSlot[]): DefenseConsidered {
  const starters = slots.filter((s) => s.isStarter);
  const gk = starters.find((s) => s.mantraRole === "POR");
  if (!gk || gk.vote === null) return null;
  const defenders = starters.filter((s) => s.mantraRole === "TER" || s.mantraRole === "DC");
  if (defenders.length < 4 || defenders.some((d) => d.vote === null)) return null;
  const bestThree = [...defenders].sort((a, b) => (b.vote as number) - (a.vote as number)).slice(0, 3);
  return { gk, defenders: bestThree };
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const id = parseInt(matchId);
  if (isNaN(id)) notFound();

  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  // Get match with both team names and matchday info
  let matchRes;
  try {
    matchRes = await db.execute({
      sql: `SELECT m.id, m.homeUserId, m.awayUserId,
                   m.homeScore, m.awayScore, m.homePoints, m.awayPoints,
                   m.homeGoals, m.awayGoals,
                   m.homeDefenseAvg, m.homeDefenseMalus, m.awayDefenseAvg, m.awayDefenseMalus,
                   hu.teamName as homeTeamName, hu.username as homeUsername,
                   au.teamName as awayTeamName, au.username as awayUsername,
                   md.number as matchdayNumber, md.id as matchdayId, md.seasonId as seasonId
            FROM "Match" m
            JOIN "User" hu ON hu.id = m.homeUserId
            JOIN "User" au ON au.id = m.awayUserId
            JOIN "Matchday" md ON md.id = m.matchdayId
            WHERE m.id = ?
            LIMIT 1`,
      args: [id],
    });
  } catch {
    // Colonne del modificatore difensivo non ancora migrate
    matchRes = await db.execute({
      sql: `SELECT m.id, m.homeUserId, m.awayUserId,
                   m.homeScore, m.awayScore, m.homePoints, m.awayPoints,
                   m.homeGoals, m.awayGoals,
                   hu.teamName as homeTeamName, hu.username as homeUsername,
                   au.teamName as awayTeamName, au.username as awayUsername,
                   md.number as matchdayNumber, md.id as matchdayId, md.seasonId as seasonId
            FROM "Match" m
            JOIN "User" hu ON hu.id = m.homeUserId
            JOIN "User" au ON au.id = m.awayUserId
            JOIN "Matchday" md ON md.id = m.matchdayId
            WHERE m.id = ?
            LIMIT 1`,
      args: [id],
    });
  }

  // Load logos
  const logoMap: Record<number, string | null> = {};
  try {
    const logoRes = await db.execute(`SELECT id, logoUrl FROM "User" WHERE isParticipant = 1`);
    for (const row of logoRes.rows) {
      logoMap[row.id as number] = (row.logoUrl as string | null) ?? null;
    }
  } catch { /* not yet migrated */ }

  if (matchRes.rows.length === 0) notFound();
  const match = matchRes.rows[0];

  const homeUserId = match.homeUserId as number;
  const awayUserId = match.awayUserId as number;
  const matchdayId = match.matchdayId as number;

  // Sconfitta a tavolino decisa dall'admin (colonne opzionali)
  let homeForfeit = false;
  let awayForfeit = false;
  try {
    const fRes = await db.execute({
      sql: `SELECT homeForfeit, awayForfeit FROM "Match" WHERE id = ?`,
      args: [id],
    });
    homeForfeit = Number(fRes.rows[0]?.homeForfeit) === 1;
    awayForfeit = Number(fRes.rows[0]?.awayForfeit) === 1;
  } catch { /* colonne tavolino non ancora presenti */ }
  const forfeitValue = homeForfeit && awayForfeit ? "both" : homeForfeit ? "home" : awayForfeit ? "away" : "none";

  // Vantaggio campo configurato per la stagione (mostrato nel tabellino sotto,
  // se diverso da zero) - vedi calculateScoresCore in app/lib/voteImporter.ts,
  // dove viene sommato al punteggio della squadra di casa prima del confronto.
  let homeAdvantage = 0;
  let maxSubstitutions = 3;
  try {
    const seasonId = match.seasonId as number | undefined;
    if (seasonId) {
      const settingsRes = await db.execute({
        sql: `SELECT homeAdvantage, maxSubstitutions FROM "LeagueSettings" WHERE seasonId = ?`,
        args: [seasonId],
      });
      homeAdvantage = (settingsRes.rows[0]?.homeAdvantage as number) ?? 0;
      const rawMaxSubs = settingsRes.rows[0]?.maxSubstitutions as number | undefined;
      if (rawMaxSubs !== undefined) {
        maxSubstitutions = Math.min(rawMaxSubs, HARD_MAX_SUBSTITUTIONS);
      }
    }
  } catch { /* tabella impostazioni non ancora migrata */ }

  // Head-to-head history (past matches between same two teams)
  const h2hRes = await db.execute({
    sql: `SELECT m.id, m.homeUserId, m.homeScore, m.awayScore, m.homePoints,
                 m.homeGoals, m.awayGoals, md.number as matchdayNumber
          FROM "Match" m
          JOIN "Matchday" md ON md.id = m.matchdayId
          WHERE m.id != ?
            AND ((m.homeUserId = ? AND m.awayUserId = ?) OR (m.homeUserId = ? AND m.awayUserId = ?))
            AND m.homeScore IS NOT NULL
          ORDER BY md.number DESC
          LIMIT 5`,
    args: [id, homeUserId, awayUserId, awayUserId, homeUserId],
  });
  type H2HRow = { id: number; homeUserId: number; homeScore: number; awayScore: number; homePoints: number; homeGoals: number | null; awayGoals: number | null; matchdayNumber: number };
  const h2h: H2HRow[] = h2hRes.rows.map((r) => ({
    id: r.id as number,
    homeUserId: r.homeUserId as number,
    homeScore: r.homeScore as number,
    awayScore: r.awayScore as number,
    homePoints: r.homePoints as number,
    homeGoals: r.homeGoals !== undefined ? (r.homeGoals as number | null) : null,
    awayGoals: r.awayGoals !== undefined ? (r.awayGoals as number | null) : null,
    matchdayNumber: r.matchdayNumber as number,
  }));

  // Get both lineups with player slots + votes in one query
  const slotsRes = await db.execute({
    sql: `SELECT ls.lineupId, l.userId, l.isAutomatic,
                 ls.isStarter, ls.position,
                 p.id as playerId, p.name, p.mantraRole,
                 pv.vote, pv.fantavoto,
                 pv.gfGs, pv.gsr, pv.amm, pv.esp, pv.rpRs, pv.aut, pv.ass, pv.adf
          FROM "LineupSlot" ls
          JOIN "Lineup" l ON l.id = ls.lineupId
          JOIN "Player" p ON p.id = ls.playerId
          LEFT JOIN "PlayerVote" pv ON pv.playerId = ls.playerId AND pv.matchdayId = ?
          WHERE l.matchdayId = ? AND l.userId IN (?, ?)
          ORDER BY l.userId ASC, ls.isStarter DESC, ls.position ASC`,
    args: [matchdayId, matchdayId, homeUserId, awayUserId],
  });

  const homeSlots: PlayerSlot[] = [];
  const awaySlots: PlayerSlot[] = [];
  // Formazione d'ufficio = non consegnata (riproposta l'ultima)
  let homeNotSubmitted = false;
  let awayNotSubmitted = false;

  for (const row of slotsRes.rows) {
    const slot: PlayerSlot = {
      playerId: row.playerId as number,
      name: row.name as string,
      mantraRole: row.mantraRole as string,
      vote: row.vote as number | null,
      fantavoto: row.fantavoto as number | null,
      isStarter: Boolean(row.isStarter),
      // Bonus/malus (gol, assist, cartellini...) solo se il giocatore ha voto
      bonuses:
        row.vote === null || row.vote === undefined
          ? []
          : fantavotoBreakdown(
              {
                gfGs: Number(row.gfGs ?? 0),
                gsr: Number(row.gsr ?? 0),
                amm: Number(row.amm ?? 0),
                esp: Number(row.esp ?? 0),
                rpRs: Number(row.rpRs ?? 0),
                aut: Number(row.aut ?? 0),
                ass: Number(row.ass ?? 0),
                adf: Number(row.adf ?? 0),
              },
              row.mantraRole as string
            ),
    };
    const automatic = Number(row.isAutomatic) === 1;
    if ((row.userId as number) === homeUserId) {
      homeSlots.push(slot);
      if (automatic) homeNotSubmitted = true;
    } else {
      awaySlots.push(slot);
      if (automatic) awayNotSubmitted = true;
    }
  }

  // Riserve entrate e titolari usciti per sostituzione automatica (titolare
  // senza voto), da evidenziare nel tabellino.
  const homeSubs = computeSubstitutionIds(homeSlots, maxSubstitutions);
  const awaySubs = computeSubstitutionIds(awaySlots, maxSubstitutions);

  // Solo per il riquadro "Modificatore difensivo" qui sotto: chi e stato
  // considerato (portiere + 3 migliori difensori titolari, per voto).
  const homeDefenseConsidered = pickDefenseConsidered(homeSlots);
  const awayDefenseConsidered = pickDefenseConsidered(awaySlots);

  const played = match.homeScore !== null;
  const homeWon = (match.homePoints as number) === 3;
  const awayWon = (match.awayPoints as number) === 3;

  // Confetti if current user won
  const iWon =
    played &&
    ((homeUserId === session.userId && homeWon) ||
      (awayUserId === session.userId && awayWon));

  return (
    <div className="space-y-6">
      {iWon && <Confetti />}
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/calendar" className="text-green-600 hover:underline text-sm">
          ← Calendario
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-500 text-sm">Giornata {match.matchdayNumber as number}</span>
      </div>

      {/* Match scoreboard */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className={`px-6 py-5 ${played ? (homeWon || awayWon ? "bg-blue-600" : "bg-slate-600") : "bg-gray-700"}`}>
          <p className="text-xs text-center text-blue-200 uppercase tracking-widest mb-4 font-medium">
            Giornata {match.matchdayNumber as number}
          </p>
          <div className="flex items-center justify-between gap-2">
            {/* Home team */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <TeamLogo logoUrl={logoMap[homeUserId] ?? null} teamName={match.homeTeamName as string} size="lg" />
              <p className={`text-base font-bold text-center truncate w-full ${homeUserId === session.userId ? "text-yellow-300" : "text-white"}`}>
                {match.homeTeamName as string}
              </p>
              <p className="text-blue-200 text-xs">{match.homeUsername as string}</p>
            </div>

            {/* Score */}
            <div className="shrink-0 text-center px-2 sm:px-6">
              {played ? (
                <>
                  <div className="text-4xl font-bold text-white tracking-tight tabular-nums">
                    <span className={homeWon ? "text-white" : "text-blue-300"}>
                      {match.homeGoals !== null
                        ? (match.homeGoals as number)
                        : (match.homeScore as number).toFixed(1)}
                    </span>
                    <span className="text-blue-300 mx-2 text-2xl">–</span>
                    <span className={awayWon ? "text-white" : "text-blue-300"}>
                      {match.awayGoals !== null
                        ? (match.awayGoals as number)
                        : (match.awayScore as number).toFixed(1)}
                    </span>
                  </div>
                  {match.homeGoals !== null && (
                    <p className="text-xs text-blue-300 mt-1 tabular-nums">
                      {(match.homeScore as number).toFixed(1)} – {(match.awayScore as number).toFixed(1)} pt
                    </p>
                  )}
                  <p className="text-xs text-blue-200 mt-1">
                    {homeWon ? "Vittoria casa" : awayWon ? "Vittoria ospiti" : "Pareggio"}
                  </p>
                  {forfeitValue !== "none" && (
                    <p className="text-xs font-semibold text-amber-300 mt-1">⚖️ Risultato a tavolino</p>
                  )}
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold text-blue-300">VS</span>
                  <p className="text-xs text-blue-200 mt-1.5">In programma</p>
                </>
              )}
            </div>

            {/* Away team */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <TeamLogo logoUrl={logoMap[awayUserId] ?? null} teamName={match.awayTeamName as string} size="lg" />
              <p className={`text-base font-bold text-center truncate w-full ${awayUserId === session.userId ? "text-yellow-300" : "text-white"}`}>
                {match.awayTeamName as string}
              </p>
              <p className="text-blue-200 text-xs">{match.awayUsername as string}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tavolino: decisione admin */}
      {forfeitValue !== "none" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-sm">
          ⚖️ <strong>Risultato a tavolino</strong> -{" "}
          {forfeitValue === "both"
            ? "nessuna delle due squadre ha consegnato: 0-0, zero punti a entrambe."
            : `${forfeitValue === "home" ? (match.homeTeamName as string) : (match.awayTeamName as string)} perde 3-0 a tavolino per mancata consegna della formazione.`}{" "}
          I fantapunti restano quelli realmente fatti.
        </div>
      )}

      {session.isAdmin && (
        <form action={setMatchForfeit} className="bg-white rounded-xl shadow-sm border px-4 py-3 flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="matchId" value={id} />
          <span className="font-semibold text-gray-700">⚖️ Admin - tavolino:</span>
          <select name="forfeit" defaultValue={forfeitValue} className="border rounded px-2 py-1">
            <option value="none">Nessuno (risultato normale)</option>
            <option value="home">0-3: perde {match.homeTeamName as string}</option>
            <option value="away">3-0: perde {match.awayTeamName as string}</option>
            <option value="both">Entrambe: 0-0, zero punti</option>
          </select>
          <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded">
            Salva
          </button>
          <span className="text-xs text-gray-400 w-full">
            {played
              ? "Partita gia calcolata: salvando, la giornata viene ricalcolata subito."
              : "Verra applicato quando calcoli la giornata."}
          </span>
        </form>
      )}

      {/* Modificatore difensivo */}
      {played && (match.homeDefenseMalus != null || match.awayDefenseMalus != null) && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-3 border-b bg-cyan-50 flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <span className="font-semibold text-gray-700 text-sm">Modificatore difensivo</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            {match.homeDefenseMalus != null && (
              <div className="text-gray-600">
                <p>
                  Difesa <strong>{match.homeTeamName as string}</strong>: media{" "}
                  <strong>{(match.homeDefenseAvg as number).toFixed(2)}</strong> {"\u2192"}{" "}
                  <span className="text-red-600 font-semibold">
                    {match.homeDefenseMalus as number} a {match.awayTeamName as string}
                  </span>
                </p>
                {homeDefenseConsidered && (
                  <p className="text-xs text-gray-400 mt-1">
                    Voti considerati (portiere + 3 migliori difensori titolari): {homeDefenseConsidered.gk.name}{" "}
                    {(homeDefenseConsidered.gk.vote as number).toFixed(1)}, {homeDefenseConsidered.defenders
                      .map((d) => `${d.name} ${(d.vote as number).toFixed(1)}`)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}
            {match.awayDefenseMalus != null && (
              <div className="text-gray-600">
                <p>
                  Difesa <strong>{match.awayTeamName as string}</strong>: media{" "}
                  <strong>{(match.awayDefenseAvg as number).toFixed(2)}</strong> {"\u2192"}{" "}
                  <span className="text-red-600 font-semibold">
                    {match.awayDefenseMalus as number} a {match.homeTeamName as string}
                  </span>
                </p>
                {awayDefenseConsidered && (
                  <p className="text-xs text-gray-400 mt-1">
                    Voti considerati (portiere + 3 migliori difensori titolari): {awayDefenseConsidered.gk.name}{" "}
                    {(awayDefenseConsidered.gk.vote as number).toFixed(1)}, {awayDefenseConsidered.defenders
                      .map((d) => `${d.name} ${(d.vote as number).toFixed(1)}`)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vantaggio campo */}
      {played && homeAdvantage !== 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-3 border-b bg-amber-50 flex items-center gap-2">
            <span className="font-semibold text-gray-700 text-sm">Vantaggio campo</span>
          </div>
          <div className="p-4 text-sm text-gray-600">
            <strong>{match.homeTeamName as string}</strong> gioca in casa:{" "}
            <span className={`font-semibold ${homeAdvantage > 0 ? "text-green-600" : "text-red-600"}`}>
              {homeAdvantage > 0 ? "+" : ""}
              {homeAdvantage} pt
            </span>{" "}
            applicati al punteggio prima del confronto con {match.awayTeamName as string}.
          </div>
        </div>
      )}

      {/* Head-to-head history */}
      {h2h.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
            <span className="text-base">⚔️</span>
            <span className="font-semibold text-gray-700 text-sm">Precedenti</span>
            <span className="text-xs text-gray-400 ml-1">
              {match.homeTeamName as string} vs {match.awayTeamName as string}
            </span>
          </div>
          <div className="divide-y">
            {h2h.map((row) => {
              // Determine which side is home for this past match
              const pastHomeIsCurrentHome = row.homeUserId === homeUserId;
              const displayHomeScore = pastHomeIsCurrentHome ? (row.homeGoals ?? row.homeScore) : (row.awayGoals ?? row.awayScore);
              const displayAwayScore = pastHomeIsCurrentHome ? (row.awayGoals ?? row.awayScore) : (row.homeGoals ?? row.homeScore);
              const homeWonPast = pastHomeIsCurrentHome ? row.homePoints === 3 : row.homePoints === 0;
              const awayWonPast = pastHomeIsCurrentHome ? row.homePoints === 0 : row.homePoints === 3;
              const drawPast = row.homePoints === 1;
              return (
                <Link key={row.id} href={`/calendar/${row.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors text-sm">
                  <span className="text-xs text-gray-400 w-6 shrink-0">G{row.matchdayNumber}</span>
                  <span className={`flex-1 text-right font-semibold truncate ${homeWonPast ? "text-green-700" : drawPast ? "text-gray-500" : "text-gray-400"}`}>
                    {match.homeTeamName as string}
                  </span>
                  <span className="font-bold tabular-nums px-2 shrink-0 text-gray-700">
                    {row.homeGoals !== null
                      ? `${displayHomeScore}–${displayAwayScore}`
                      : `${(pastHomeIsCurrentHome ? row.homeScore : row.awayScore).toFixed(1)}–${(pastHomeIsCurrentHome ? row.awayScore : row.homeScore).toFixed(1)}`}
                  </span>
                  <span className={`flex-1 font-semibold truncate ${awayWonPast ? "text-green-700" : drawPast ? "text-gray-500" : "text-gray-400"}`}>
                    {match.awayTeamName as string}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Lineups side by side */}
      {(homeSlots.length > 0 || awaySlots.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LineupCard
            teamName={match.homeTeamName as string}
            slots={homeSlots}
            isCurrentUser={homeUserId === session.userId}
            score={played ? (match.homeScore as number) : null}
            goals={match.homeGoals !== null ? (match.homeGoals as number) : null}
            won={homeWon}
            subbedInIds={homeSubs.inIds}
            subbedOutIds={homeSubs.outIds}
            notSubmitted={homeNotSubmitted}
          />
          <LineupCard
            teamName={match.awayTeamName as string}
            slots={awaySlots}
            isCurrentUser={awayUserId === session.userId}
            score={played ? (match.awayScore as number) : null}
            goals={match.awayGoals !== null ? (match.awayGoals as number) : null}
            won={awayWon}
            subbedInIds={awaySubs.inIds}
            subbedOutIds={awaySubs.outIds}
            notSubmitted={awayNotSubmitted}
          />
        </div>
      )}

      {homeSlots.length === 0 && awaySlots.length === 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-gray-400">
          <div className="text-3xl mb-2">📋</div>
          <p>Nessuna formazione inviata per questa partita.</p>
        </div>
      )}
    </div>
  );
}

function LineupCard({
  teamName,
  slots,
  isCurrentUser,
  score,
  goals,
  won,
  subbedInIds,
  subbedOutIds,
  notSubmitted,
}: {
  teamName: string;
  slots: PlayerSlot[];
  isCurrentUser: boolean;
  score: number | null;
  goals: number | null;
  won: boolean;
  subbedInIds: Set<number>;
  subbedOutIds: Set<number>;
  notSubmitted: boolean;
}) {
  const starters = slots.filter((s) => s.isStarter);
  const reserves = slots.filter((s) => !s.isStarter);

  const headerBg = won
    ? "bg-green-700"
    : score !== null
    ? "bg-gray-700"
    : "bg-gray-600";

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className={`${headerBg} text-white px-4 py-3 flex items-center justify-between`}>
        <span className={`font-semibold truncate ${isCurrentUser ? "text-green-200" : ""}`}>
          {teamName}
          {isCurrentUser && <span className="ml-1.5 text-xs opacity-70">(tu)</span>}
        </span>
        {score !== null && (
          <div className="text-right shrink-0 ml-2">
            {goals !== null && (
              <div className="text-xl font-bold tabular-nums">{goals} gol</div>
            )}
            <div className={`tabular-nums ${goals !== null ? "text-sm opacity-75" : "text-xl font-bold"}`}>
              {score.toFixed(1)} pt
            </div>
          </div>
        )}
      </div>

      {notSubmitted && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm px-4 py-2">
          ⚠️ <strong>Formazione non consegnata</strong> - schierata d&apos;ufficio l&apos;ultima formazione inviata.
        </div>
      )}

      <div className="p-4">
        {starters.length > 0 ? (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Titolari ({starters.length})
              {subbedOutIds.size > 0 && (
                <span className="ml-1.5 text-red-500 normal-case tracking-normal font-medium">
                  - {subbedOutIds.size} uscit{subbedOutIds.size === 1 ? "o" : "i"} per sostituzione
                </span>
              )}
            </p>
            <div className="space-y-1">
              {starters.map((s) => (
                <SlotRow key={s.playerId} slot={s} subbedOut={subbedOutIds.has(s.playerId)} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">Formazione non inviata</p>
        )}

        {reserves.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Riserve ({reserves.length})
              {subbedInIds.size > 0 && (
                <span className="ml-1.5 text-green-600 normal-case tracking-normal font-medium">
                  - {subbedInIds.size} entrat{subbedInIds.size === 1 ? "a" : "e"} in campo
                </span>
              )}
            </p>
            <div className="space-y-1">
              {reserves.map((s) => (
                <SlotRow key={s.playerId} slot={s} subbedIn={subbedInIds.has(s.playerId)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  subbedIn = false,
  subbedOut = false,
}: {
  slot: PlayerSlot;
  subbedIn?: boolean;
  subbedOut?: boolean;
}) {
  const fv = slot.fantavoto;
  const fvColor =
    fv === null ? "text-gray-400" :
    fv >= 8 ? "text-green-600 font-bold" :
    fv >= 6 ? "text-blue-600 font-semibold" :
    "text-red-500";

  // Riserva entrata effettivamente in campo (sostituzione automatica di un
  // titolare senza voto): evidenziata in verde e non affievolita come le
  // altre riserve rimaste in panchina. Il titolare uscito al posto suo viene
  // evidenziato in rosso, cosi si vede subito la coppia entrata/uscita.
  const rowClass = subbedIn
    ? "flex items-center gap-2 py-1.5 pl-1.5 -ml-1.5 border-l-2 border-green-500 bg-green-50 rounded-r"
    : subbedOut
    ? "flex items-center gap-2 py-1.5 pl-1.5 -ml-1.5 border-l-2 border-red-400 bg-red-50 rounded-r"
    : !slot.isStarter
    ? "flex items-center gap-2 py-1.5 opacity-60"
    : "flex items-center gap-2 py-1.5";

  return (
    <div className={rowClass}>
      <span
        className={`text-xs px-1.5 py-0.5 rounded font-bold shrink-0 ${
          roleBadgeClass(slot.mantraRole) ?? "bg-gray-100 text-gray-700"
        }`}
      >
        {slot.mantraRole}
      </span>
      {subbedIn && (
        <span
          title="Entrato dalla panchina"
          className="text-[10px] font-bold text-white bg-green-600 rounded px-1 py-0.5 shrink-0 leading-none"
        >
          IN
        </span>
      )}
      {subbedOut && (
        <span
          title="Uscito, sostituito dalla panchina"
          className="text-[10px] font-bold text-white bg-red-500 rounded px-1 py-0.5 shrink-0 leading-none"
        >
          OUT
        </span>
      )}
      <Link
        href={`/giocatore/${slot.playerId}`}
        className={`text-sm flex-1 truncate hover:text-blue-600 hover:underline transition-colors ${
          subbedIn ? "text-green-800 font-medium" : subbedOut ? "text-red-700" : "text-gray-700"
        }`}
      >
        {slot.name}
      </Link>
      {slot.vote !== null && slot.bonuses.length > 0 && (
        <span className="flex flex-wrap justify-end gap-1 shrink min-w-0">
          {slot.bonuses.map((b) => (
            <span
              key={b.key}
              title={`${b.label}: ${b.value > 0 ? "+" : ""}${b.value}`}
              className={`text-[11px] leading-none px-1 py-0.5 rounded tabular-nums whitespace-nowrap ${
                b.value > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
              }`}
            >
              {b.icon}
              {b.value > 0 ? "+" : ""}
              {Number.isInteger(b.value) ? b.value : b.value.toFixed(1)}
            </span>
          ))}
        </span>
      )}
      {slot.vote !== null && (
        <span className="text-xs text-gray-400 shrink-0 tabular-nums" title="Voto (prima di bonus/malus)">
          v.{slot.vote.toFixed(1)}
        </span>
      )}
      <span className={`text-sm shrink-0 tabular-nums ${fvColor}`} title="Fantavoto (voto + bonus/malus)">
        {fv !== null ? fv.toFixed(1) : <span className="text-gray-300 text-xs">sv</span>}
      </span>
    </div>
  );
}
