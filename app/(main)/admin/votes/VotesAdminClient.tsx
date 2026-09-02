"use client";

import { useActionState, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { importVotes, calculateAllScores, updatePlayerVote } from "@/app/actions/votes";
import { lockAndAdvanceMatchday, setMatchdayDeadline } from "@/app/actions/schedule";
import { setPlayerStatus } from "@/app/actions/settings";
import DeadlineTimer from "@/app/components/DeadlineTimer";

interface Matchday {
  id: number;
  number: number;
  votesImported: boolean;
  isLocked: boolean;
  deadline: string | null;
}

interface LineupSubmission {
  userId: number;
  teamName: string;
  submitted: boolean;
  score: number | null;
  isAutomatic?: boolean;
  substitutions?: number;
}

interface PlayerStatus {
  playerId: number;
  playerName: string;
  status: string;
}

interface Player {
  id: number;
  name: string;
  realTeam: string;
  mantraRole: string;
}

interface VoteRow {
  playerId: number;
  name: string;
  realTeam: string;
  mantraRole: string;
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

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  ok: { label: "Disponibile", color: "bg-green-100 text-green-700", icon: "✓" },
  inj: { label: "Infortunato", color: "bg-red-100 text-red-700", icon: "🤕" },
  sus: { label: "Squalificato", color: "bg-amber-100 text-amber-700", icon: "🟨" },
};

export default function VotesAdminClient({
  seasonId,
  seasonName,
  currentMatchday,
  currentMatchdayId,
  currentMatchdayTotal,
  currentMatchdayDeadline,
  matchdays,
  lineupSubmissions,
  playerStatuses,
  allPlayers,
}: {
  seasonId: number;
  seasonName: string;
  currentMatchday: number;
  currentMatchdayId: number | null;
  currentMatchdayTotal: number;
  currentMatchdayDeadline: string | null;
  matchdays: Matchday[];
  lineupSubmissions: LineupSubmission[];
  playerStatuses: PlayerStatus[];
  allPlayers: Player[];
}) {
  const [importResult, importAction, importPending] = useActionState(importVotes, null);
  // Riconosce l'esito "giornata fantapiu3 diversa da quella importata" (vedi
  // MISMATCH_PREFIX in app/lib/voteImporter.ts) per offrire la scelta esplicita
  // di importare comunque, invece di un messaggio d'errore generico.
  const mismatchDetected = importResult?.match(/^MISMATCH_GIORNATA:(\d+)$/)?.[1] ?? null;
  const [calcResult, calcAction, calcPending] = useActionState(calculateAllScores, null);
  const [advanceResult, advanceAction, advancePending] = useActionState(lockAndAdvanceMatchday, null);
  const [, statusAction] = useActionState(setPlayerStatus, null);
  const [deadlineResult, deadlineAction, deadlinePending] = useActionState(setMatchdayDeadline, null);

  const [selectedMatchday, setSelectedMatchday] = useState(
    matchdays.find((m) => m.number === currentMatchday) ?? matchdays[0]
  );
  const [playerSearch, setPlayerSearch] = useState("");
  const [showAvailability, setShowAvailability] = useState(false);

  /* ── Correzione manuale voti importati ────────────────────── */
  const [showVotesEdit, setShowVotesEdit] = useState(false);
  const [votesData, setVotesData] = useState<VoteRow[] | null>(null);
  const [votesLoading, setVotesLoading] = useState(false);
  const [votesFetchError, setVotesFetchError] = useState("");
  const [voteSearch, setVoteSearch] = useState("");
  const [editingVotePlayerId, setEditingVotePlayerId] = useState<number | null>(null);

  const fetchVotes = useCallback(async (matchdayId: number) => {
    setEditingVotePlayerId(null);
    setVotesLoading(true);
    setVotesFetchError("");
    try {
      const res = await fetch(`/api/admin/votes?matchdayId=${matchdayId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVotesData(data.votes ?? []);
    } catch {
      setVotesFetchError("Impossibile caricare i voti. Riprova.");
    } finally {
      setVotesLoading(false);
    }
  }, []);

  // Ricarica se l'admin cambia giornata mentre il pannello voti è aperto
  // (agganciato al click del selettore giornata più sotto, non a un effect,
  // per non ri-fetchare a ogni render)
  const selectMatchday = (md: Matchday) => {
    setSelectedMatchday(md);
    if (showVotesEdit) fetchVotes(md.id);
  };

  const submitted = lineupSubmissions.filter((l) => l.submitted).length;
  const canAdvance = currentMatchdayId !== null && currentMatchday < currentMatchdayTotal;

  // Mappa playerId → status corrente
  const statusMap = new Map(playerStatuses.map((s) => [s.playerId, s.status]));

  const filteredPlayers = allPlayers.filter(
    (p) =>
      p.name.includes(playerSearch.toUpperCase()) ||
      p.realTeam.includes(playerSearch.toUpperCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Gestione Giornata</h1>
      <p className="text-gray-500 text-sm">
        Stagione: <strong>{seasonName}</strong> — Fonte: Fantapiu3.com Premier League
      </p>

      {/* ── Formazioni inviate ─────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-700">
            Formazioni G{currentMatchday} — {submitted}/{lineupSubmissions.length} inviate
          </h2>
          {canAdvance && (
            <form action={advanceAction}>
              <input type="hidden" name="seasonId" value={seasonId} />
              <input type="hidden" name="matchdayId" value={currentMatchdayId!} />
              <input type="hidden" name="nextNumber" value={currentMatchday + 1} />
              <button
                type="submit"
                disabled={advancePending}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {advancePending ? "..." : `🔒 Blocca G${currentMatchday} e avanza a G${currentMatchday + 1}`}
              </button>
            </form>
          )}
        </div>

        {advanceResult && (
          <div className="mb-3 px-3 py-2 rounded text-sm bg-red-50 border border-red-200 text-red-700">
            {advanceResult}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {lineupSubmissions.map((l) => (
            <div
              key={l.userId}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border ${
                l.submitted
                  ? l.isAutomatic
                    ? "bg-amber-50 border-amber-200"
                    : "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <span className={`font-medium ${l.submitted ? (l.isAutomatic ? "text-amber-800" : "text-green-800") : "text-red-700"}`}>
                {l.submitted ? (l.isAutomatic ? "🤖" : "✓") : "✗"} {l.teamName}
              </span>
              <div className="flex items-center gap-2">
                {l.score !== null && (
                  <span className="font-bold text-gray-700">{l.score.toFixed(1)}</span>
                )}
                {(l.substitutions ?? 0) > 0 && (
                  <span className="text-xs text-gray-400">↔{l.substitutions}</span>
                )}
                {currentMatchdayId && (!l.submitted || l.isAutomatic) && (
                  <Link
                    href={`/admin/lineup?matchdayId=${currentMatchdayId}&userId=${l.userId}`}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    🛠️ {l.submitted ? "correggi" : "inserisci"}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-2">
          ✓ = inviata manualmente &nbsp;·&nbsp; 🤖 = generata automaticamente &nbsp;·&nbsp; ↔N = N sostituzioni
        </p>
      </div>

      {/* ── Scadenza consegna formazioni ─────────────────── */}
      {currentMatchdayId && (
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">⏰ Scadenza consegna G{currentMatchday}</h2>

          {/* Preview timer come lo vedono i giocatori */}
          <DeadlineTimer deadline={currentMatchdayDeadline} isLocked={false} />

          {/* Form set deadline */}
          <form action={deadlineAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="matchdayId" value={currentMatchdayId} />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Imposta scadenza (data e ora locale)
              </label>
              <input
                type="datetime-local"
                name="deadline"
                defaultValue={currentMatchdayDeadline ?? ""}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              type="submit"
              disabled={deadlinePending}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {deadlinePending ? "Salvataggio..." : "Imposta scadenza"}
            </button>
            {currentMatchdayDeadline && (
              <button
                type="submit"
                name="deadline"
                value=""
                disabled={deadlinePending}
                className="text-xs text-red-500 hover:underline"
              >
                Rimuovi scadenza
              </button>
            )}
          </form>
          {deadlineResult && (
            <p className="text-red-600 text-sm">{deadlineResult}</p>
          )}
        </div>
      )}

      {/* ── Disponibilità giocatori ────────────────────────── */}
      {currentMatchdayId && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold text-gray-700">
              Disponibilità giocatori G{currentMatchday}
            </h2>
            <button
              type="button"
              onClick={() => setShowAvailability(!showAvailability)}
              className="text-sm text-green-600 hover:underline"
            >
              {showAvailability ? "Chiudi" : "Gestisci"}
            </button>
          </div>

          {/* Riepilogo squalificati/infortunati */}
          {playerStatuses.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {playerStatuses.map((s) => (
                <span
                  key={s.playerId}
                  className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_LABELS[s.status]?.color}`}
                >
                  {STATUS_LABELS[s.status]?.icon} {s.playerName}
                </span>
              ))}
            </div>
          )}
          {playerStatuses.length === 0 && !showAvailability && (
            <p className="text-gray-400 text-sm">Tutti i giocatori sono disponibili per questa giornata.</p>
          )}

          {showAvailability && (
            <div className="mt-3 border-t pt-3 space-y-3">
              <input
                type="text"
                placeholder="Cerca giocatore..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="max-h-72 overflow-y-auto space-y-1">
                {filteredPlayers.slice(0, 50).map((p) => {
                  const currentStatus = statusMap.get(p.id) ?? "ok";
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-gray-50">
                      <span className="text-xs text-gray-400 w-8">{p.mantraRole}</span>
                      <span className="text-sm flex-1">{p.name}</span>
                      <span className="text-xs text-gray-400">{p.realTeam}</span>
                      <form action={statusAction} className="flex gap-1">
                        <input type="hidden" name="playerId" value={p.id} />
                        <input type="hidden" name="matchdayId" value={currentMatchdayId} />
                        {(["ok", "inj", "sus"] as const).map((s) => (
                          <button
                            key={s}
                            type="submit"
                            name="status"
                            value={s}
                            className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                              currentStatus === s
                                ? STATUS_LABELS[s].color + " border-current font-medium"
                                : "bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-400"
                            }`}
                          >
                            {STATUS_LABELS[s].icon}
                          </button>
                        ))}
                      </form>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Import voti ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Seleziona giornata</h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2 mb-4">
          {matchdays.map((md) => (
            <button
              key={md.id}
              type="button"
              onClick={() => selectMatchday(md)}
              className={`text-center p-2 rounded-lg border text-xs font-medium transition-colors ${
                selectedMatchday?.id === md.id
                  ? "bg-green-600 text-white border-green-600"
                  : md.votesImported
                  ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
              }`}
            >
              G{md.number}
              {md.votesImported && <div>✓</div>}
              {md.isLocked && <div>🔒</div>}
            </button>
          ))}
        </div>

        {selectedMatchday && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${selectedMatchday.votesImported ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {selectedMatchday.votesImported ? "✓ Voti importati" : "Voti non ancora importati"}
              </div>
              {selectedMatchday.isLocked && (
                <div className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                  🔒 Giornata bloccata
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <form action={importAction}>
                <input type="hidden" name="matchdayId" value={selectedMatchday.id} />
                <input type="hidden" name="matchdayNumber" value={selectedMatchday.number} />
                <button
                  type="submit"
                  disabled={importPending}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {importPending ? "⏳ Importazione..." : `📥 Importa voti G${selectedMatchday.number}`}
                </button>
              </form>

              {selectedMatchday.votesImported && (
                <form action={calcAction}>
                  <input type="hidden" name="matchdayId" value={selectedMatchday.id} />
                  <button
                    type="submit"
                    disabled={calcPending}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    {calcPending ? "Calcolo..." : "⚡ Calcola punteggi"}
                  </button>
                </form>
              )}
            </div>

            {mismatchDetected && (
              <div className="px-4 py-3 rounded-lg text-sm bg-amber-50 border border-amber-200 text-amber-800 space-y-2">
                <p>
                  ⚠️ Il sito fantapiu3 mostra al momento la <strong>Giornata {mismatchDetected}</strong>, non
                  la Giornata {selectedMatchday.number}. Il sito non permette di consultare giornate passate:
                  puoi aspettare che mostri la Giornata {selectedMatchday.number}, oppure importare comunque
                  i dati della Giornata {mismatchDetected} come Giornata {selectedMatchday.number}.
                </p>
                <form action={importAction}>
                  <input type="hidden" name="matchdayId" value={selectedMatchday.id} />
                  <input type="hidden" name="matchdayNumber" value={selectedMatchday.number} />
                  <input type="hidden" name="force" value="1" />
                  <button
                    type="submit"
                    disabled={importPending}
                    className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    {importPending
                      ? "⏳ Importazione..."
                      : `Importa comunque Giornata ${mismatchDetected} → G${selectedMatchday.number}`}
                  </button>
                </form>
              </div>
            )}
            {importResult && !mismatchDetected && (
              <div className={`px-4 py-3 rounded-lg text-sm ${importResult.startsWith("Errore") || importResult.startsWith("Non") ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
                {importResult}
              </div>
            )}
            {calcResult && (
              <div className="px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
                {calcResult}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Correzione manuale voti importati ─────────────────── */}
      {selectedMatchday?.votesImported && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-gray-700">
                📝 Voti importati G{selectedMatchday.number} — correggi voto/malus/bonus
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Utile se un voto è sbagliato o un evento (gol, ammonizione, ecc.) manca. Dopo aver corretto,
                ricorda di rilanciare <strong>Calcola punteggi</strong> qui sopra per aggiornare rose e classifica.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !showVotesEdit;
                setShowVotesEdit(next);
                if (next) fetchVotes(selectedMatchday.id);
              }}
              className="text-sm text-green-600 hover:underline shrink-0"
            >
              {showVotesEdit ? "Chiudi" : "Mostra/Modifica"}
            </button>
          </div>

          {showVotesEdit && (
            <div className="border-t pt-3 space-y-3">
              <input
                type="text"
                placeholder="Cerca giocatore o squadra..."
                value={voteSearch}
                onChange={(e) => setVoteSearch(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-green-500"
              />

              {votesLoading && <p className="text-sm text-gray-400">Caricamento voti...</p>}
              {votesFetchError && <p className="text-sm text-red-600">{votesFetchError}</p>}

              {votesData && !votesLoading && (
                <div className="max-h-[32rem] overflow-y-auto divide-y border rounded-lg">
                  {votesData
                    .filter(
                      (v) =>
                        v.name.includes(voteSearch.toUpperCase()) ||
                        v.realTeam.includes(voteSearch.toUpperCase())
                    )
                    .map((v) =>
                      editingVotePlayerId === v.playerId ? (
                        <VoteEditRow
                          key={v.playerId}
                          matchdayId={selectedMatchday.id}
                          row={v}
                          onDone={() => fetchVotes(selectedMatchday.id)}
                        />
                      ) : (
                        <div key={v.playerId} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                          <span className="text-xs text-gray-400 w-8 shrink-0">{v.mantraRole}</span>
                          <span className="flex-1 min-w-0 truncate">{v.name}</span>
                          <span className="text-xs text-gray-400 w-24 shrink-0 truncate">{v.realTeam}</span>
                          <span className="w-14 text-center shrink-0 tabular-nums text-gray-600">
                            {v.vote !== null ? v.vote.toFixed(1) : <span className="text-gray-300">sv</span>}
                          </span>
                          <span className="w-16 text-center shrink-0 tabular-nums font-semibold text-gray-700">
                            {v.fantavoto !== null ? v.fantavoto.toFixed(2) : "—"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingVotePlayerId(v.playerId)}
                            className="text-blue-600 hover:text-blue-800 text-xs shrink-0"
                          >
                            ✏️
                          </button>
                        </div>
                      )
                    )}
                  {votesData.length === 0 && (
                    <p className="text-sm text-gray-400 px-3 py-4 text-center">
                      Nessun voto importato per questa giornata.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Flusso giornata:</strong>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li>Segna giocatori infortunati/squalificati nel pannello Disponibilità</li>
          <li>Verifica che le formazioni siano state inviate</li>
          <li>Seleziona la giornata e clicca <strong>Importa voti</strong></li>
          <li>Se qualche voto manca o è sbagliato, correggilo in <strong>Voti importati</strong> qui sopra</li>
          <li>Clicca <strong>Calcola punteggi</strong> — auto-genera formazioni mancanti + applica soglie gol</li>
          <li>Clicca <strong>Blocca G{currentMatchday}</strong> per passare alla giornata successiva</li>
        </ol>
      </div>
    </div>
  );
}

function VoteEditRow({
  matchdayId,
  row,
  onDone,
}: {
  matchdayId: number;
  row: VoteRow;
  onDone: () => void;
}) {
  const [error, action, pending] = useActionState(updatePlayerVote, null);
  const submittedRef = useRef(false);

  // Quando il submit in corso finisce (pending torna false) e non c'è
  // errore, l'azione ha salvato con successo: chiudiamo la riga e
  // ricarichiamo i dati aggiornati (fantavoto ricalcolato) dal server.
  useEffect(() => {
    if (submittedRef.current && !pending) {
      submittedRef.current = false;
      if (!error) onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, error]);

  const [vote, setVote] = useState(row.vote !== null ? String(row.vote) : "");
  const [fantavoto, setFantavoto] = useState(row.fantavoto !== null ? String(row.fantavoto) : "");
  const [gfGs, setGfGs] = useState(String(row.gfGs));
  const [gsr, setGsr] = useState(String(row.gsr));
  const [amm, setAmm] = useState(String(row.amm));
  const [esp, setEsp] = useState(String(row.esp));
  const [rpRs, setRpRs] = useState(String(row.rpRs));
  const [aut, setAut] = useState(String(row.aut));
  const [ass, setAss] = useState(String(row.ass));
  const [adf, setAdf] = useState(String(row.adf));

  const num = (label: string, name: string, value: string, setValue: (v: string) => void, step = 1) => (
    <div>
      <label className="text-[10px] font-medium text-gray-400 block">{label}</label>
      <input
        name={name}
        type="number"
        step={step}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full border rounded px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <div className="px-3 py-3 bg-blue-50/40">
      <form action={action} onSubmit={() => { submittedRef.current = true; }}>
        <input type="hidden" name="matchdayId" value={matchdayId} />
        <input type="hidden" name="playerId" value={row.playerId} />
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-400 w-8 shrink-0">{row.mantraRole}</span>
          <span className="text-sm font-medium flex-1 min-w-0 truncate">{row.name}</span>
          <span className="text-xs text-gray-400 shrink-0">{row.realTeam}</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {num("Voto", "vote", vote, setVote, 0.5)}
          {num("Fantavoto (se sv)", "fantavoto", fantavoto, setFantavoto, 0.5)}
          {num("Gol +/-", "gfGs", gfGs, setGfGs)}
          {num("Gol rig.", "gsr", gsr, setGsr)}
          {num("Ammon.", "amm", amm, setAmm)}
          {num("Espuls.", "esp", esp, setEsp)}
          {num("Rigore p/s", "rpRs", rpRs, setRpRs)}
          {num("Autogol", "aut", aut, setAut)}
          {num("Assist", "ass", ass, setAss)}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mt-2">
          {num("Assist fermo", "adf", adf, setAdf)}
        </div>

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

        <div className="flex items-center gap-3 mt-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-3 py-1.5 rounded text-xs font-medium"
          >
            {pending ? "Salvataggio..." : "💾 Salva"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="text-gray-500 hover:text-gray-700 text-xs"
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
