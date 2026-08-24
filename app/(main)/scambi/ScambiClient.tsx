"use client";

import { useState, useActionState } from "react";
import { proposeTrade, acceptTrade, rejectTrade, cancelTrade } from "@/app/actions/trades";
import { teamColor, teamInitials } from "@/app/lib/teamColor";

type Player = { id: number; name: string; mantraRole: string; realTeam: string };
type OtherUser = { id: number; teamName: string; username: string; roster: Player[] };
type Trade = {
  id: number; status: string; note: string; createdAt: string;
  fromUserId: number; toUserId: number; fromTeam: string; toTeam: string;
  offeredPlayerName: string; offeredPlayerRole: string;
  requestedPlayerName: string; requestedPlayerRole: string;
};

const ROLE_COLORS: Record<string, string> = {
  POR: "bg-yellow-100 text-yellow-800",
  DC: "bg-blue-100 text-blue-800", TER: "bg-indigo-100 text-indigo-800",
  M: "bg-green-100 text-green-800", OFF: "bg-teal-100 text-teal-800",
  ATT: "bg-red-100 text-red-800",
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:   { label: "In attesa",  cls: "bg-amber-100 text-amber-800" },
  accepted:  { label: "Accettato",  cls: "bg-green-100 text-green-800" },
  rejected:  { label: "Rifiutato",  cls: "bg-red-100 text-red-800" },
  cancelled: { label: "Annullato",  cls: "bg-gray-100 text-gray-500" },
};

function RoleChip({ role }: { role: string }) {
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[role] ?? "bg-gray-100"}`}>{role}</span>;
}

function TeamAvatar({ name }: { name: string }) {
  const { bg, text } = teamColor(name);
  return (
    <div className={`w-8 h-8 rounded-full ${bg} ${text} flex items-center justify-center text-xs font-bold shrink-0`}>
      {teamInitials(name)}
    </div>
  );
}

/* ── Single trade card ───────────────────────────────────────────────────── */
function TradeCard({ trade, myUserId }: { trade: Trade; myUserId: number }) {
  const isIncoming = trade.toUserId === myUserId;
  const [acceptState, acceptAction, acceptPending] = useActionState(acceptTrade, null);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectTrade, null);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelTrade, null);

  const cfg = STATUS_CFG[trade.status] ?? { label: trade.status, cls: "bg-gray-100 text-gray-500" };
  const done = acceptState === "ok" || rejectState === "ok" || cancelState === "ok";

  if (done) return null; // hide after action

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${isIncoming && trade.status === "pending" ? "border-amber-300 ring-1 ring-amber-200" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isIncoming ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
            {isIncoming ? "⬇ Ricevuta" : "⬆ Inviata"}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
        </div>
        <span className="text-xs text-gray-400">{trade.createdAt.slice(0, 10)}</span>
      </div>

      {/* Swap visual */}
      <div className="flex items-center gap-3">
        {/* From */}
        <div className="flex-1 bg-gray-50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <TeamAvatar name={trade.fromTeam} />
            <span className="text-xs font-semibold text-gray-600 truncate">{trade.fromTeam}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <RoleChip role={trade.offeredPlayerRole} />
            <span className="text-sm font-medium text-gray-800 truncate">{trade.offeredPlayerName}</span>
          </div>
        </div>

        {/* Arrow */}
        <div className="shrink-0 flex flex-col items-center">
          <span className="text-xl">⇄</span>
        </div>

        {/* To */}
        <div className="flex-1 bg-gray-50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <TeamAvatar name={trade.toTeam} />
            <span className="text-xs font-semibold text-gray-600 truncate">{trade.toTeam}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <RoleChip role={trade.requestedPlayerRole} />
            <span className="text-sm font-medium text-gray-800 truncate">{trade.requestedPlayerName}</span>
          </div>
        </div>
      </div>

      {/* Note */}
      {trade.note && (
        <p className="text-xs text-gray-500 italic mt-2 px-1">💬 {trade.note}</p>
      )}

      {/* Actions */}
      {trade.status === "pending" && (
        <div className="flex gap-2 mt-3">
          {isIncoming ? (
            <>
              <form action={acceptAction} className="flex-1">
                <input type="hidden" name="tradeId" value={trade.id} />
                <button type="submit" disabled={acceptPending}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-xl transition-colors">
                  {acceptPending ? "..." : "✓ Accetta"}
                </button>
              </form>
              <form action={rejectAction} className="flex-1">
                <input type="hidden" name="tradeId" value={trade.id} />
                <button type="submit" disabled={rejectPending}
                  className="w-full bg-red-100 hover:bg-red-200 text-red-700 text-sm font-semibold py-2 rounded-xl transition-colors">
                  {rejectPending ? "..." : "✕ Rifiuta"}
                </button>
              </form>
            </>
          ) : (
            <form action={cancelAction} className="flex-1">
              <input type="hidden" name="tradeId" value={trade.id} />
              <button type="submit" disabled={cancelPending}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium py-2 rounded-xl transition-colors">
                {cancelPending ? "..." : "Annulla proposta"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Error feedback */}
      {(acceptState && acceptState !== "ok") && <p className="text-xs text-red-500 mt-2">{acceptState}</p>}
      {(rejectState && rejectState !== "ok") && <p className="text-xs text-red-500 mt-2">{rejectState}</p>}
      {(cancelState && cancelState !== "ok") && <p className="text-xs text-red-500 mt-2">{cancelState}</p>}
    </div>
  );
}

/* ── Propose trade form ──────────────────────────────────────────────────── */
function ProposeForm({ myRoster, otherUsers, myTeamName }: {
  myRoster: Player[];
  otherUsers: OtherUser[];
  myTeamName: string;
}) {
  const [state, action, pending] = useActionState(proposeTrade, null);
  const [selectedUser, setSelectedUser] = useState<OtherUser | null>(null);
  const [mySearch, setMySearch] = useState("");
  const [theirSearch, setTheirSearch] = useState("");
  const [offeredId, setOfferedId] = useState<number | null>(null);
  const [requestedId, setRequestedId] = useState<number | null>(null);

  const filteredMine = myRoster.filter(p =>
    p.name.toUpperCase().includes(mySearch.toUpperCase()) ||
    p.mantraRole.includes(mySearch.toUpperCase())
  );
  const filteredTheirs = (selectedUser?.roster ?? []).filter(p =>
    p.name.toUpperCase().includes(theirSearch.toUpperCase()) ||
    p.mantraRole.includes(theirSearch.toUpperCase())
  );

  const offeredPlayer = myRoster.find(p => p.id === offeredId);
  const requestedPlayer = selectedUser?.roster.find(p => p.id === requestedId);

  const success = state === "ok";

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-green-700 font-semibold">Proposta inviata!</p>
        <p className="text-green-600 text-sm mt-1">L&apos;altro utente riceverà la notifica.</p>
        <button onClick={() => window.location.reload()} className="mt-3 text-xs text-green-600 underline">Ricarica</button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
      <h2 className="font-semibold text-gray-800">🔄 Proponi uno scambio</h2>

      {/* Step 1: select target user */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">1. Con quale squadra?</label>
        <div className="flex flex-wrap gap-2 mt-2">
          {otherUsers.map(u => {
            const { bg, text } = teamColor(u.teamName);
            return (
              <button key={u.id} type="button"
                onClick={() => { setSelectedUser(u); setRequestedId(null); setTheirSearch(""); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors ${
                  selectedUser?.id === u.id ? `${bg} ${text} border-transparent` : "border-gray-200 hover:border-gray-300"
                }`}>
                <TeamAvatar name={u.teamName} />
                {u.teamName}
              </button>
            );
          })}
        </div>
      </div>

      {selectedUser && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* My player */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">2. Il tuo giocatore</label>
            <input type="text" placeholder="Cerca..." value={mySearch}
              onChange={e => setMySearch(e.target.value)}
              className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 mb-2 focus:outline-none focus:ring-2 focus:ring-green-400" />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredMine.map(p => (
                <button key={p.id} type="button"
                  onClick={() => setOfferedId(p.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors border ${
                    offeredId === p.id ? "border-green-500 bg-green-50" : "border-transparent hover:bg-gray-50"
                  }`}>
                  <RoleChip role={p.mantraRole} />
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{p.realTeam}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Their player */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">3. Il loro giocatore</label>
            <input type="text" placeholder="Cerca..." value={theirSearch}
              onChange={e => setTheirSearch(e.target.value)}
              className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredTheirs.map(p => (
                <button key={p.id} type="button"
                  onClick={() => setRequestedId(p.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors border ${
                    requestedId === p.id ? "border-blue-500 bg-blue-50" : "border-transparent hover:bg-gray-50"
                  }`}>
                  <RoleChip role={p.mantraRole} />
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{p.realTeam}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview + submit */}
      {offeredPlayer && requestedPlayer && selectedUser && (
        <form action={action} className="space-y-3">
          <input type="hidden" name="offeredPlayerId" value={offeredId!} />
          <input type="hidden" name="requestedPlayerId" value={requestedId!} />
          <input type="hidden" name="toUserId" value={selectedUser.id} />

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">Riepilogo proposta:</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-center">
                <RoleChip role={offeredPlayer.mantraRole} />
                <p className="font-semibold text-sm mt-1">{offeredPlayer.name}</p>
                <p className="text-xs text-gray-400">{myTeamName}</p>
              </div>
              <span className="text-2xl">⇄</span>
              <div className="flex-1 text-center">
                <RoleChip role={requestedPlayer.mantraRole} />
                <p className="font-semibold text-sm mt-1">{requestedPlayer.name}</p>
                <p className="text-xs text-gray-400">{selectedUser.teamName}</p>
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Messaggio (opzionale)</label>
            <input name="note" type="text" placeholder="Es. Proposta paritaria, considera!" maxLength={200}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          {state && state !== "ok" && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state}</p>
          )}

          <button type="submit" disabled={pending}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
            {pending ? "Invio..." : "📤 Invia proposta"}
          </button>
        </form>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function ScambiClient({
  myUserId, myTeamName, myRoster, otherUsers, trades,
}: {
  myUserId: number;
  myTeamName: string;
  myRoster: Player[];
  otherUsers: OtherUser[];
  trades: Trade[];
}) {
  const incoming = trades.filter(t => t.toUserId === myUserId && t.status === "pending");
  const outgoing = trades.filter(t => t.fromUserId === myUserId && t.status === "pending");
  const history  = trades.filter(t => t.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">🔄 Scambi diretti</h1>
        {incoming.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
            {incoming.length} {incoming.length === 1 ? "proposta" : "proposte"} in arrivo
          </span>
        )}
      </div>

      {/* Incoming */}
      {incoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700">⬇ Proposte ricevute</h2>
          {incoming.map(t => <TradeCard key={t.id} trade={t} myUserId={myUserId} />)}
        </div>
      )}

      {/* Propose new */}
      <ProposeForm myRoster={myRoster} otherUsers={otherUsers} myTeamName={myTeamName} />

      {/* Outgoing */}
      {outgoing.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700">⬆ Proposte inviate</h2>
          {outgoing.map(t => <TradeCard key={t.id} trade={t} myUserId={myUserId} />)}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm text-gray-400">Storico</h2>
          {history.map(t => <TradeCard key={t.id} trade={t} myUserId={myUserId} />)}
        </div>
      )}

      {trades.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🤝</p>
          <p className="font-medium">Nessuno scambio ancora</p>
          <p className="text-sm mt-1">Proponi il primo scambio con un altro manager!</p>
        </div>
      )}
    </div>
  );
}
