import type { Metadata } from "next";
import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import LineupForm from "./LineupForm";
import DeadlineTimer from "@/app/components/DeadlineTimer";
import LiveScorePreview from "@/app/components/LiveScorePreview";

export const metadata: Metadata = { title: "Formazione" };
import Link from "next/link";

export default async function LineupPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const seasonRes = await db.execute(
    `SELECT id, currentMatchday FROM "Season" WHERE isActive = 1 LIMIT 1`
  );
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nessuna stagione attiva. Attendi che l&apos;admin configuri il campionato.
      </div>
    );
  }

  const matchdayRes = await db.execute({
    sql: `SELECT id, number, isLocked, deadline, votesImported FROM "Matchday" WHERE seasonId = ? AND number = ? LIMIT 1`,
    args: [season.id, season.currentMatchday],
  });
  const matchday = matchdayRes.rows[0] ?? null;

  if (!matchday) {
    return <div className="text-center py-12 text-gray-500">Giornata non trovata.</div>;
  }

  // Deadline — la colonna potrebbe non esistere ancora
  let deadline: string | null = null;
  try {
    deadline = (matchday.deadline as string | null) ?? null;
  } catch { /* colonna non migrata */ }

  // Partita di lega corrente
  let leagueMatch: { opponentName: string } | null = null;
  try {
    const lmRes = await db.execute({
      sql: `SELECT hu.teamName as homeTeam, au.teamName as awayTeam, m.homeUserId, m.awayUserId
            FROM "Match" m
            JOIN "User" hu ON hu.id = m.homeUserId
            JOIN "User" au ON au.id = m.awayUserId
            WHERE m.matchdayId = ? AND (m.homeUserId = ? OR m.awayUserId = ?)
            LIMIT 1`,
      args: [matchday.id, session.userId, session.userId],
    });
    if (lmRes.rows.length > 0) {
      const row = lmRes.rows[0];
      const isHome = (row.homeUserId as number) === session.userId;
      leagueMatch = { opponentName: (isHome ? row.awayTeam : row.homeTeam) as string };
    }
  } catch { /* ignore */ }

  // Partite coppa pendenti per l'utente (homeScore IS NULL) che si giocano
  // PROPRIO in questa giornata di campionato: la giornata di un turno di
  // coppa e' quella del singolo turno interno del girone (CupRoundSlot),
  // o in mancanza quella dell'intero turno/girone (CupRound.matchdayNumber)
  // per i turni a eliminazione diretta. Senza questo filtro comparivano
  // TUTTE le partite di coppa ancora da giocare, anche quelle di giornate
  // future - la formazione di oggi non vale per quelle.
  let cupMatches: { cupName: string; roundName: string; opponentName: string }[] = [];
  const currentMatchdayNumber = matchday.number as number;
  try {
    const cmRes = await db.execute({
      sql: `SELECT c.name as cupName, cr.name as roundName,
                   cr.matchdayNumber as roundMatchday, crs.matchdayNumber as slotMatchday,
                   hu.teamName as homeTeam, au.teamName as awayTeam,
                   cm.homeUserId, cm.awayUserId
            FROM "CupMatch" cm
            JOIN "CupRound" cr ON cr.id = cm.cupRoundId
            JOIN "Cup" c ON c.id = cr.cupId
            JOIN "User" hu ON hu.id = cm.homeUserId
            JOIN "User" au ON au.id = cm.awayUserId
            LEFT JOIN "CupRoundSlot" crs ON crs.cupRoundId = cr.id AND crs.slot = cm.roundSlot
            WHERE c.seasonId = ? AND cm.homeScore IS NULL
              AND (cm.homeUserId = ? OR cm.awayUserId = ?)`,
      args: [season.id, session.userId, session.userId],
    });
    cupMatches = cmRes.rows
      .filter((row) => {
        const effectiveMatchday = (row.slotMatchday as number | null) ?? (row.roundMatchday as number | null);
        return effectiveMatchday === currentMatchdayNumber;
      })
      .map((row) => {
        const isHome = (row.homeUserId as number) === session.userId;
        return {
          cupName: row.cupName as string,
          roundName: row.roundName as string,
          opponentName: (isHome ? row.awayTeam : row.homeTeam) as string,
        };
      });
  } catch {
    // CupRoundSlot / roundSlot non ancora migrati: ripiega sulla sola
    // giornata dell'intero turno (funziona per l'eliminazione diretta,
    // non distingue i turni interni di un girone).
    try {
      const cmRes = await db.execute({
        sql: `SELECT c.name as cupName, cr.name as roundName, cr.matchdayNumber as roundMatchday,
                     hu.teamName as homeTeam, au.teamName as awayTeam,
                     cm.homeUserId, cm.awayUserId
              FROM "CupMatch" cm
              JOIN "CupRound" cr ON cr.id = cm.cupRoundId
              JOIN "Cup" c ON c.id = cr.cupId
              JOIN "User" hu ON hu.id = cm.homeUserId
              JOIN "User" au ON au.id = cm.awayUserId
              WHERE c.seasonId = ? AND cm.homeScore IS NULL
                AND (cm.homeUserId = ? OR cm.awayUserId = ?)`,
        args: [season.id, session.userId, session.userId],
      });
      cupMatches = cmRes.rows
        .filter((row) => (row.roundMatchday as number | null) === currentMatchdayNumber)
        .map((row) => {
          const isHome = (row.homeUserId as number) === session.userId;
          return {
            cupName: row.cupName as string,
            roundName: row.roundName as string,
            opponentName: (isHome ? row.awayTeam : row.homeTeam) as string,
          };
        });
    } catch { /* cups table might not exist */ }
  }

  const rosterRes = await db.execute({
    sql: `SELECT p.id, p.name, p.realTeam, p.mantraRole,
                 COALESCE(ps.status, 'ok') as availability
          FROM "Roster" r
          JOIN "Player" p ON p.id = r.playerId
          LEFT JOIN "PlayerStatus" ps ON ps.playerId = p.id AND ps.matchdayId = ?
          WHERE r.userId = ?
          ORDER BY p.mantraRole ASC, p.name ASC`,
    args: [matchday.id, session.userId],
  });

  const existingLineupRes = await db.execute({
    sql: `SELECT id, formation FROM "Lineup" WHERE userId = ? AND matchdayId = ? LIMIT 1`,
    args: [session.userId, matchday.id],
  });
  const existingLineup = existingLineupRes.rows[0] ?? null;

  let existingLineupData = null;
  if (existingLineup) {
    const slotsRes = await db.execute({
      sql: `SELECT playerId, isStarter FROM "LineupSlot" WHERE lineupId = ? ORDER BY isStarter DESC, position ASC`,
      args: [existingLineup.id],
    });
    existingLineupData = {
      formation: existingLineup.formation as string,
      starters: slotsRes.rows.filter((s) => Number(s.isStarter) === 1).map((s) => s.playerId as number),
      reserves: slotsRes.rows.filter((s) => Number(s.isStarter) === 0).map((s) => s.playerId as number),
    };
  }

  const isLocked = Boolean(matchday.isLocked);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">
          Formazione — G{matchday.number as number}
        </h1>
        <Link href="/lineup/history" className="text-green-600 text-sm hover:underline">
          📋 Storico →
        </Link>
      </div>

      {/* Countdown timer */}
      <DeadlineTimer deadline={deadline} isLocked={isLocked} />

      {/* Live score preview (shown when votes are available) */}
      <LiveScorePreview
        matchdayId={matchday.id as number}
        votesImported={Boolean(matchday.votesImported)}
      />

      {/* Competizioni di giornata */}
      <div className="bg-gray-100 rounded-xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Questa formazione vale per:
        </p>
        <div className="space-y-3">
          {/* Lega */}
          <div className="flex items-start gap-3 text-sm">
            <span className="text-base shrink-0">⚽</span>
            <div className="min-w-0">
              <span className="font-semibold text-gray-700 break-words">Lega — Giornata {matchday.number as number}</span>
              {leagueMatch ? (
                <span className="text-gray-500 block break-words">vs {leagueMatch.opponentName}</span>
              ) : (
                <span className="text-gray-400 block italic">nessuna partita assegnata</span>
              )}
            </div>
          </div>

          {/* Coppe pendenti */}
          {cupMatches.map((cm, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="text-base shrink-0">🏆</span>
              <div className="min-w-0">
                <span className="font-semibold text-gray-700 break-words">{cm.cupName} — {cm.roundName}</span>
                <span className="text-gray-500 block break-words">vs {cm.opponentName}</span>
              </div>
            </div>
          ))}

          {cupMatches.length === 0 && (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="text-base">🏅</span>
              <span>Nessuna coppa in corso</span>
            </div>
          )}
        </div>
      </div>

      {/* Lineup form */}
      <LineupForm
        matchdayId={matchday.id as number}
        matchdayNumber={matchday.number as number}
        isLocked={isLocked}
        roster={rosterRes.rows.map((r) => ({
          id: r.id as number,
          name: r.name as string,
          realTeam: r.realTeam as string,
          mantraRole: r.mantraRole as string,
          availability: r.availability as string,
        }))}
        existingLineup={existingLineupData}
      />
    </div>
  );
}
