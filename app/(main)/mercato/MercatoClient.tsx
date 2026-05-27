"use client";

import { useState, useActionState } from "react";
import { submitOffer, deleteOffer } from "@/app/actions/market";

type Offer = {
  id: number;
  price: number;
  note: string;
  status: string;
  createdAt: string;
  fromUserId: number;
  fromTeam: string;
  toTeam: string | null;
  playerName: string;
  mantraRole: string;
  realTeam: string;
};

type Market = {
  id: number;
  name: string;
  isOpen: boolean;
  budget: number;
  offers: Offer[];
};

type RosterPlayer = {
  rosterId: number;
  playerId: number;
  name: string;
  mantraRole: string;
  realTeam: string;
  purchasePrice: number;
};

export default function MercatoClient({
  markets,
  myRoster,
  currentUserId,
  isAdmin,
  seasonName,
}: {
  markets: Market[];
  myRoster: RosterPlayer[];
  currentUserId: number;
  isAdmin: boolean;
  seasonName: string;
}) {
  const [selectedMarket, setSelectedMarket] = useState<number | null>(markets.find((m) => m.isOpen)?.id ?? markets[0]?.id ?? null);
  const [offerState, offerAction, offerPending] = useActionState(submitOffer, null);
  const [deleteState, deleteAction] = useActionState(deleteOffer, null);

  const market = markets.find((m) => m.id === selectedMarket);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      accepted: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    const labels: Record<string, string> = { pending: "In attesa", accepted: "Accettata", rejected: "Rifiutata" };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>{labels[status] ?? status}</span>;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">
        Mercato — <span className="text-green-700">{seasonName}</span>
      </h1>

      {markets.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nessun mercato configurato per questa stagione.</div>
      ) : (
        <>
          {/* Market selector */}
          {markets.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {markets.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMarket(m.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${selectedMarket === m.id ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-700 border-gray-200 hover:border-green-400"}`}
                >
                  {m.name} {m.isOpen ? <span className="text-green-300">●</span> : <span className="text-gray-400">●</span>}
                </button>
              ))}
            </div>
          )}

          {market && (
            <div className="space-y-6">
              {/* Status banner */}
              <div className={`rounded-lg px-4 py-3 flex items-center gap-2 ${market.isOpen ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}>
                <span className={`w-3 h-3 rounded-full ${market.isOpen ? "bg-green-500" : "bg-gray-400"}`} />
                <span className="font-medium text-sm">{market.name} — {market.isOpen ? "Aperto" : "Chiuso"}</span>
                {market.budget > 0 && <span className="ml-auto text-sm text-gray-500">Budget per squadra: <strong>{market.budget} crediti</strong></span>}
              </div>

              {/* Submit offer form */}
              {market.isOpen && myRoster.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <h2 className="font-semibold text-gray-700 mb-3">Metti in vendita un giocatore</h2>
                  <form action={offerAction} className="flex flex-wrap gap-3 items-end">
                    <input type="hidden" name="marketId" value={market.id} />
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs text-gray-500 mb-1">Giocatore</label>
                      <select name="playerId" required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none">
                        {myRoster.map((p) => (
                          <option key={p.playerId} value={p.playerId}>{p.name} ({p.mantraRole} — {p.realTeam})</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-28">
                      <label className="block text-xs text-gray-500 mb-1">Prezzo (crediti)</label>
                      <input type="number" name="price" min={0} defaultValue={0} required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-xs text-gray-500 mb-1">Note (opzionale)</label>
                      <input type="text" name="note" placeholder="es. cerco difensore in cambio" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                    </div>
                    <button type="submit" disabled={offerPending} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
                      Metti in vendita
                    </button>
                  </form>
                  {offerState?.error && <p className="text-red-600 text-sm mt-2">{offerState.error}</p>}
                  {offerState?.success && <p className="text-green-600 text-sm mt-2">Offerta inviata.</p>}
                </div>
              )}

              {/* Offers list */}
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-4 py-3 border-b font-semibold text-gray-700">
                  Offerte ({market.offers.length})
                </div>
                {market.offers.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">Nessuna offerta ancora.</div>
                ) : (
                  <div className="divide-y">
                    {market.offers.map((offer) => (
                      <div key={offer.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[160px]">
                          <p className="font-medium text-sm">{offer.playerName}</p>
                          <p className="text-xs text-gray-400">{offer.mantraRole} — {offer.realTeam}</p>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-500">Da:</span> <strong>{offer.fromTeam}</strong>
                        </div>
                        <div className="text-sm font-semibold text-green-700">{offer.price} cr</div>
                        {offer.note && <div className="text-xs text-gray-500 italic flex-1">{offer.note}</div>}
                        {statusBadge(offer.status)}
                        {offer.status === "pending" && offer.fromUserId === currentUserId && (
                          <form action={deleteAction}>
                            <input type="hidden" name="offerId" value={offer.id} />
                            <button type="submit" className="text-xs text-red-500 hover:text-red-700">Ritira</button>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
