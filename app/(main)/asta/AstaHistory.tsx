"use client";

import { useState, Fragment } from "react";

type HistoryBid = {
  playerId: number;
  playerName: string;
  mantraRole: string;
  teamName: string;
  amount: number;
  status: string;
  releasedPlayerName: string | null;
  unsoldReason: string | null;
};
type HistoryRound = { roundId: number; roundName: string; resolvedAt: string; bids: HistoryBid[] };

function fmt(dt: string) {
  return new Date(dt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Raggruppa le offerte di un round per giocatore (stessa logica di
// /admin/asta): un giocatore e' rimasto svincolato se nessuna delle sue
// offerte e' "won".
function groupBidsByPlayer(bids: HistoryBid[]) {
  const map = new Map<number, { playerId: number; playerName: string; bids: HistoryBid[] }>();
  for (const b of bids) {
    if (!map.has(b.playerId)) map.set(b.playerId, { playerId: b.playerId, playerName: b.playerName, bids: [] });
    map.get(b.playerId)!.bids.push(b);
  }
  return Array.from(map.values());
}

// Storico completo delle aste a buste: visibile a tutti i partecipanti (non
// solo all'admin), con le offerte di ogni squadra una volta che il round e
// chiuso - prima di allora restano segrete (questo componente riceve solo
// round gia risolti). Le righe della propria squadra sono evidenziate.
export default function AstaHistory({ history, myTeamName }: { history: HistoryRound[]; myTeamName: string }) {
  const [expanded, setExpanded] = useState<number | null>(history[0]?.roundId ?? null);

  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h2 className="font-semibold text-gray-700">Storico buste</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Tutte le offerte dei round gia chiusi, di ogni squadra. Le tue sono evidenziate.
        </p>
      </div>
      <div className="divide-y">
        {history.map((r) => {
          const won = r.bids.filter((b) => b.status === "won");
          const playerGroups = groupBidsByPlayer(r.bids);
          const isOpen = expanded === r.roundId;
          return (
            <div key={r.roundId}>
              <button
                onClick={() => setExpanded(isOpen ? null : r.roundId)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">{r.roundName}</p>
                  <p className="text-xs text-gray-400">
                    chiuso il {fmt(r.resolvedAt)} - {won.length} assegnati su {r.bids.length} offerte
                  </p>
                </div>
                <span className="text-gray-400 text-sm">{isOpen ? "^" : "v"}</span>
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
                              {g.bids.map((b, i) => {
                                const mine = b.teamName === myTeamName;
                                return (
                                  <tr
                                    key={i}
                                    className={
                                      b.status === "won"
                                        ? "bg-green-50"
                                        : mine
                                          ? "bg-orange-50"
                                          : ""
                                    }
                                  >
                                    <td className="py-1.5 pr-2 font-medium">{b.playerName}</td>
                                    <td className={`py-1.5 pr-2 ${mine ? "text-orange-700 font-semibold" : "text-gray-500"}`}>
                                      {b.teamName}
                                      {mine ? " (tu)" : ""}
                                    </td>
                                    <td className="py-1.5 pr-2 text-right font-mono">{b.amount}</td>
                                    <td className="py-1.5 text-xs">
                                      {b.status === "won" ? (
                                        <div>
                                          <span className="text-green-700 font-semibold">vinta</span>
                                          {b.releasedPlayerName && (
                                            <div className="text-gray-400 font-normal mt-0.5">
                                              svincolato {b.releasedPlayerName}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">persa</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                              {!sold && (
                                <tr className="bg-amber-50">
                                  <td colSpan={4} className="py-1.5 pr-2 pl-2 text-xs text-amber-700 font-medium">
                                    Rimasto svincolato
                                    {(() => {
                                      const reason = g.bids.find((b) => b.unsoldReason)?.unsoldReason;
                                      return reason
                                        ? `: ${reason}.`
                                        : ": nessuna offerta e andata a buon fine.";
                                    })()}
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
  );
}
