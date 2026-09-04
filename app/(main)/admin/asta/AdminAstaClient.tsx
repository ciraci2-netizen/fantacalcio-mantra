"use client";

import { useActionState, useState, Fragment } from "react";
import { openAuctionRound, closeAuctionRoundNow } from "@/app/actions/auction";

interface CurrentRound {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string;
  bidCount: number;
  notStarted: boolean;
}

interface PastRoundBid {
  playerId: number;
  playerName: string;
  teamName: string;
  amount: number;
  status: string;
}

interface PastRound {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string;
  resolvedAt: string;
  bids: PastRoundBid[];
}

function fmt(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Raggruppa le offerte di un round per giocatore, nell'ordine in cui
// arrivano (gia' playerId ASC, amount DESC dalla query). Un giocatore e'
// rimasto svincolato in quel round se nessuna delle sue offerte e' 'won'
// (es. l'unica offerta superava il budget/gli slot residui di chi l'ha
// fatta): prima si vedeva identico a una "persa" qualunque, ora si segnala.
function groupBidsByPlayer(bids: PastRoundBid[]) {
  const map = new Map<number, { playerId: number; playerName: string; bids: PastRoundBid[] }>();
  for (const b of bids) {
    if (!map.has(b.playerId)) map.set(b.playerId, { playerId: b.playerId, playerName: b.playerName, bids: [] });
    map.get(b.playerId)!.bids.push(b);
  }
  return Array.from(map.values());
}

export default function AdminAstaClient({
  seasonName,
  currentRound,
  pastRounds,
  freeCount,
}: {
  seasonName: string;
  currentRound: CurrentRound | null;
  pastRounds: PastRound[];
  freeCount: number;
}) {
  const [openError, openAction, openPending] = useActionState(openAuctionRound, null);
  const [closeResult, closeAction, closePending] = useActionState(closeAuctionRoundNow, null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const notStarted = currentRound?.notStarted ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🔨 Asta a buste — Svincolati</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Stagione: <strong>{seasonName}</strong> · {freeCount} giocatori svincolati disponibili
        </p>
      </div>

      {currentRound ? (
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-gray-700">{currentRound.name}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {currentRound.startDate ? `Dal ${fmt(currentRound.startDate)} ` : ""}
                al {fmt(currentRound.endDate)}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                notStarted ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
              }`}
            >
              {notStarted ? "⏳ Non ancora iniziata" : "🟢 Aperta"}
            </span>
          </div>

          <p className="text-sm text-gray-600">
            {currentRound.bidCount} offerte pendenti (segrete — vedrai chi ha offerto cosa solo alla chiusura).
          </p>

          <form action={closeAction}>
            <input type="hidden" name="roundId" value={currentRound.id} />
            <button
              type="submit"
              disabled={closePending}
              onClick={(e) => {
                if (!confirm("Chiudere subito il round e assegnare i giocatori alle offerte più alte?")) e.preventDefault();
              }}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {closePending ? "Chiusura..." : "🔒 Chiudi ora e assegna"}
            </button>
          </form>

          {closeResult && (
            <pre className="text-xs whitespace-pre-wrap bg-gray-50 border rounded-lg p-3 text-gray-700">{closeResult}</pre>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3">Apri un nuovo round</h2>
          <form action={openAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-gray-500">Nome (opzionale)</label>
              <input
                name="name"
                placeholder="Asta svincolati"
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Inizio (opzionale — subito se vuoto)</label>
              <input
                type="datetime-local"
                name="startDate"
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Fine *</label>
              <input
                type="datetime-local"
                name="endDate"
                required
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            {openError && <div className="col-span-full text-red-600 text-sm">{openError}</div>}
            <div className="col-span-full">
              <button
                type="submit"
                disabled={openPending}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {openPending ? "Apertura..." : "Apri round"}
              </button>
            </div>
          </form>
          <p className="text-xs text-gray-400 mt-3">
            Ogni partecipante potrà fare un&apos;offerta segreta per gli svincolati che vuole. Alla chiusura (data di
            fine, o manuale) vince l&apos;offerta più alta per ciascun giocatore — a parità, chi ha offerto per primo.
          </p>
        </div>
      )}

      {pastRounds.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-700">Storico round</h2>
          </div>
          <div className="divide-y">
            {pastRounds.map((r) => {
              const won = r.bids.filter((b) => b.status === "won");
              const playerGroups = groupBidsByPlayer(r.bids);
              const unsoldGroups = playerGroups.filter((g) => !g.bids.some((b) => b.status === "won"));
              const isOpen = expanded === r.id;
              return (
                <div key={r.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-700">{r.name}</p>
                      <p className="text-xs text-gray-400">
                        chiuso il {fmt(r.resolvedAt)} {"\u00b7"} {won.length} giocatori assegnati
                        {unsoldGroups.length > 0 && `\u00b7 ${unsoldGroups.length} rimasti svincolati`}
                        {" "}{"\u00b7"} {r.bids.length} offerte totali
                      </p>
                    </div>
                    <span className="text-gray-400 text-sm">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      {r.bids.length === 0 ? (
                        <p className="text-sm text-gray-400">Nessuna offerta ricevuta.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-gray-400 uppercase">
                              <th className="py-1 pr-2">Giocatore</th>
                              <th className="py-1 pr-2">Squadra</th>
                              <th className="py-1 pr-2 text-right">Offerta</th>
                              <th className="py-1"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {playerGroups.map((g) => {
                              const sold = g.bids.some((b) => b.status === "won");
                              return (
                                <Fragment key={g.playerId}>
                                  {g.bids.map((b, i) => (
                                    <tr key={i} className={b.status === "won" ? "bg-green-50" : ""}>
                                      <td className="py-1.5 pr-2 font-medium">{b.playerName}</td>
                                      <td className="py-1.5 pr-2 text-gray-500">{b.teamName}</td>
                                      <td className="py-1.5 pr-2 text-right font-mono">{b.amount}</td>
                                      <td className="py-1.5 text-xs">
                                        {b.status === "won" ? (
                                          <span className="text-green-700 font-semibold">{"\u2713"} vinta</span>
                                        ) : (
                                          <span className="text-gray-400">persa</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                  {!sold && (
                                    <tr className="bg-amber-50">
                                      <td colSpan={4} className="py-1.5 pr-2 pl-2 text-xs text-amber-700 font-medium">
                                        {"\u26a0"} Rimasto svincolato: nessuna offerta e andata a buon fine.
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
