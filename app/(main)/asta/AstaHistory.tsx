"use client";

import { useState } from "react";

type HistoryBid = { playerName: string; mantraRole: string; amount: number; status: string };
type HistoryRound = { roundId: number; roundName: string; resolvedAt: string; bids: HistoryBid[] };

function fmt(dt: string) {
  return new Date(dt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AstaHistory({ history }: { history: HistoryRound[] }) {
  const [expanded, setExpanded] = useState<number | null>(history[0]?.roundId ?? null);

  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h2 className="font-semibold text-gray-700">Storico buste - le tue offerte</h2>
        <p className="text-xs text-gray-400 mt-0.5">Solo le tue offerte passate: gli importi degli altri utenti restano segreti.</p>
      </div>
      <div className="divide-y">
        {history.map((r) => {
          const won = r.bids.filter((b) => b.status === "won");
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
                    chiuso il {fmt(r.resolvedAt)} - {won.length} vinte su {r.bids.length} offerte
                  </p>
                </div>
                <span className="text-gray-400 text-sm">{isOpen ? "^" : "v"}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 uppercase">
                        <th className="py-1 pr-2">Giocatore</th>
                        <th className="py-1 pr-2">Ruolo</th>
                        <th className="py-1 pr-2 text-right">Offerta</th>
                        <th className="py-1"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {r.bids.map((b, i) => (
                        <tr key={i} className={b.status === "won" ? "bg-green-50" : ""}>
                          <td className="py-1.5 pr-2 font-medium">{b.playerName}</td>
                          <td className="py-1.5 pr-2 text-gray-500">{b.mantraRole}</td>
                          <td className="py-1.5 pr-2 text-right font-mono">{b.amount}</td>
                          <td className="py-1.5 text-xs">
                            {b.status === "won" ? (
                              <span className="text-green-700 font-semibold">vinta</span>
                            ) : (
                              <span className="text-gray-400">persa</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}