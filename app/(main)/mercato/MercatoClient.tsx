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

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:  { label: "In attesa",  cls: "bg-amber-100 text-amber-800" },
  accepted: { label: "Accettata",  cls: "bg-green-100 text-green-800" },
  rejected: { label: "Rifiutata",  cls: "bg-red-100 text-red-800" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export default function MercatoClient({
  markets,
  myRoster,
  currentUserId,
  seasonName,
}: {
  markets: Market[];
  myRoster: RosterPlayer[];
  currentUserId: number;
  isAdmin: boolean;
  seasonName: string;
}) {
  const [tab, setTab] = useState<"active" | "history">("active");
  const [selectedMarket, setSelectedMarket] = useState<number | null>(
    markets.find((m) => m.isOpen)?.id ?? markets[0]?.id ?? null
  );
  const [offerState, offerAction, offerPending] = useActionState(submitOffer, null);
  const [, deleteAction] = useActionState(deleteOffer, null);

  const market = markets.find((m) => m.id === selectedMarket);

  // Flatten all offers for the history tab
  const allOffers = markets.flatMap((m) =>
    m.offers
      .filter((o) => o.status !== "pending")
      .map((o) => ({ ...o, marketName: m.name }))
  );
  const allPending = markets.flatMap((m) =>
    m.offers
      .filter((o) => o.status === "pending")
      .map((o) => ({ ...o, marketName: m.name }))
  );

  // Stats
  const totalAccepted = allOffers.filter((o) => o.status === "accepted").length;
  const totalRejected = allOffers.filter((o) => o.status === "rejected").length;
  const totalVolume = allOffers
    .filter((o) => o.status === "accepted")
    .reduce((sum, o) => sum + o.price, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">
          Mercato — <span className="text-green-700">{seasonName}</span>
        </h1>
        {/* Open market indicator */}
        {markets.some((m) => m.isOpen) ? (
          <span className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Mercato aperto
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Mercato chiuso
          </span>
        )}
      </div>

      {markets.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="text-4xl mb-3">🔄</div>
          <p className="text-gray-500">Nessun mercato configurato per questa stagione.</p>
          <p className="text-gray-400 text-sm mt-1">L&apos;admin aprirà il mercato quando necessario.</p>
        </div>
      ) : (
        <>
          {/* ── Tabs ─────────────────────────────────────────── */}
          <div className="flex border-b border-gray-200 gap-0">
            <button
              onClick={() => setTab("active")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === "active"
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              🔄 Mercato attivo
              {allPending.length > 0 && (
                <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                  {allPending.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("history")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === "history"
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              📜 Storico trasferimenti
              {allOffers.length > 0 && (
                <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                  {allOffers.length}
                </span>
              )}
            </button>
          </div>

          {/* ── Active market tab ─────────────────────────── */}
          {tab === "active" && (
            <div className="space-y-5">
              {/* Market selector (if multiple) */}
              {markets.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {markets.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMarket(m.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        selectedMarket === m.id
                          ? "bg-green-700 text-white border-green-700"
                          : "bg-white text-gray-700 border-gray-200 hover:border-green-400"
                      }`}
                    >
                      {m.name}
                      <span className={`ml-1.5 ${m.isOpen ? "text-green-400" : "text-gray-400"}`}>●</span>
                    </button>
                  ))}
                </div>
              )}

              {market && (
                <div className="space-y-5">
                  {/* Status header */}
                  <div
                    className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
                      market.isOpen
                        ? "bg-green-50 border border-green-200"
                        : "bg-gray-50 border border-gray-200"
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${market.isOpen ? "bg-green-500" : "bg-gray-400"}`} />
                    <span className="font-semibold text-sm">
                      {market.name} — {market.isOpen ? "🟢 Aperto" : "⚫ Chiuso"}
                    </span>
                    {market.budget > 0 && (
                      <span className="ml-auto text-sm text-gray-500">
                        Budget: <strong>{market.budget} cr</strong>
                      </span>
                    )}
                  </div>

                  {/* Submit offer */}
                  {market.isOpen && myRoster.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border p-5">
                      <h2 className="font-semibold text-gray-700 mb-3">✍️ Metti in vendita un giocatore</h2>
                      <form action={offerAction} className="flex flex-wrap gap-3 items-end">
                        <input type="hidden" name="marketId" value={market.id} />
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-xs text-gray-500 mb-1">Giocatore</label>
                          <select
                            name="playerId"
                            required
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                          >
                            {myRoster.map((p) => (
                              <option key={p.playerId} value={p.playerId}>
                                {p.name} ({p.mantraRole} — {p.realTeam})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-28">
                          <label className="block text-xs text-gray-500 mb-1">Prezzo</label>
                          <input
                            type="number"
                            name="price"
                            min={0}
                            defaultValue={0}
                            required
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex-1 min-w-[150px]">
                          <label className="block text-xs text-gray-500 mb-1">Note (opzionale)</label>
                          <input
                            type="text"
                            name="note"
                            placeholder="es. cerco difensore in cambio"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={offerPending}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium"
                        >
                          {offerPending ? "Invio..." : "Metti in vendita"}
                        </button>
                      </form>
                      {offerState?.error && (
                        <p className="text-red-600 text-sm mt-2">{offerState.error}</p>
                      )}
                      {offerState?.success && (
                        <p className="text-green-600 text-sm mt-2">✓ Offerta inviata con successo.</p>
                      )}
                    </div>
                  )}

                  {/* Pending offers table */}
                  <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                      <span className="font-semibold text-gray-700">Offerte in corso</span>
                      <span className="text-xs text-gray-400">
                        {market.offers.filter((o) => o.status === "pending").length} in attesa
                      </span>
                    </div>
                    {market.offers.filter((o) => o.status === "pending").length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-sm">
                        Nessuna offerta in corso.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {market.offers
                          .filter((o) => o.status === "pending")
                          .map((offer) => (
                            <OfferRow
                              key={offer.id}
                              offer={offer}
                              currentUserId={currentUserId}
                              deleteAction={deleteAction}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── History tab ──────────────────────────────────── */}
          {tab === "history" && (
            <div className="space-y-5">
              {/* Stats bar */}
              {allOffers.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{totalAccepted}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Trasferimenti completati</div>
                  </div>
                  <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{totalRejected}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Offerte rifiutate</div>
                  </div>
                  <div className="bg-white rounded-xl border shadow-sm p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">{totalVolume}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Crediti scambiati</div>
                  </div>
                </div>
              )}

              {allOffers.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                  <div className="text-4xl mb-3">📜</div>
                  <p className="text-gray-500">Nessuna transazione ancora completata.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <span className="font-semibold text-gray-700">Storico trasferimenti</span>
                    <span className="text-xs text-gray-400 ml-2">({allOffers.length} movimenti)</span>
                  </div>
                  <div className="divide-y">
                    {allOffers.map((offer) => (
                      <div key={offer.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                        {/* Player + role */}
                        <div className="flex-1 min-w-[160px]">
                          <p className="font-medium text-sm">{offer.playerName}</p>
                          <p className="text-xs text-gray-400">
                            {offer.mantraRole} — {offer.realTeam}
                          </p>
                        </div>

                        {/* Transfer arrow */}
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500 text-xs">{offer.fromTeam}</span>
                          {offer.status === "accepted" && offer.toTeam ? (
                            <>
                              <span className="text-green-500 font-bold">→</span>
                              <span className="text-gray-700 text-xs font-medium">{offer.toTeam}</span>
                            </>
                          ) : offer.status === "accepted" ? (
                            <>
                              <span className="text-orange-500 font-bold">→</span>
                              <span className="text-orange-600 text-xs">Svincolato</span>
                            </>
                          ) : null}
                        </div>

                        {/* Price */}
                        {offer.price > 0 && (
                          <span className="text-sm font-semibold text-green-700 shrink-0">
                            {offer.price} cr
                          </span>
                        )}

                        {/* Market name chip */}
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full shrink-0">
                          {"marketName" in offer ? (offer as typeof offer & { marketName: string }).marketName : ""}
                        </span>

                        <StatusBadge status={offer.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OfferRow({
  offer,
  currentUserId,
  deleteAction,
}: {
  offer: Offer;
  currentUserId: number;
  deleteAction: (payload: FormData) => void;
}) {
  return (
    <div className="px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[160px]">
        <p className="font-medium text-sm">{offer.playerName}</p>
        <p className="text-xs text-gray-400">
          {offer.mantraRole} — {offer.realTeam}
        </p>
      </div>
      <div className="text-sm">
        <span className="text-gray-500">Da:</span> <strong>{offer.fromTeam}</strong>
      </div>
      <div className="text-sm font-semibold text-green-700">{offer.price} cr</div>
      {offer.note && (
        <div className="text-xs text-gray-500 italic flex-1 min-w-[80px]">
          &quot;{offer.note}&quot;
        </div>
      )}
      <StatusBadge status={offer.status} />
      {offer.status === "pending" && offer.fromUserId === currentUserId && (
        <form action={deleteAction}>
          <input type="hidden" name="offerId" value={offer.id} />
          <button
            type="submit"
            className="text-xs text-red-500 hover:text-red-700 hover:underline"
          >
            Ritira
          </button>
        </form>
      )}
    </div>
  );
}
