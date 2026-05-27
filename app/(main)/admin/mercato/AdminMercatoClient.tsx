"use client";

import { useActionState } from "react";
import { createMarket, toggleMarket, resolveOffer } from "@/app/actions/market";

type Offer = { id: number; price: number; note: string; status: string; createdAt: string; fromUserId: number; fromTeam: string; playerName: string; mantraRole: string; realTeam: string };
type Market = { id: number; name: string; isOpen: boolean; budget: number; offers: Offer[] };
type User = { id: number; teamName: string };

export default function AdminMercatoClient({ markets, users, seasonName }: { markets: Market[]; users: User[]; seasonName: string | null }) {
  const [createState, createAction, createPending] = useActionState(createMarket, null);
  const [toggleState, toggleAction] = useActionState(toggleMarket, null);
  const [resolveState, resolveAction, resolvePending] = useActionState(resolveOffer, null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Admin Mercato {seasonName ? `— ${seasonName}` : ""}</h1>

      {/* Create market */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h2 className="font-semibold text-gray-700 mb-3">Nuovo Mercato</h2>
        <form action={createAction} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-500 mb-1">Nome</label>
            <input type="text" name="name" required placeholder="es. Mercato Invernale 2025" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
          </div>
          <div className="w-32">
            <label className="block text-xs text-gray-500 mb-1">Budget per squadra</label>
            <input type="number" name="budget" min={0} defaultValue={0} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
          </div>
          <button type="submit" disabled={createPending} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
            Crea
          </button>
        </form>
        {createState?.error && <p className="text-red-600 text-sm mt-2">{createState.error}</p>}
        {createState?.success && <p className="text-green-600 text-sm mt-2">Mercato creato.</p>}
      </div>

      {/* Markets */}
      {markets.map((market) => (
        <div key={market.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className={`px-4 py-3 flex items-center justify-between ${market.isOpen ? "bg-green-700" : "bg-gray-600"} text-white`}>
            <div>
              <span className="font-bold">{market.name}</span>
              <span className="ml-2 text-sm opacity-80">{market.isOpen ? "● Aperto" : "● Chiuso"}</span>
            </div>
            <form action={toggleAction}>
              <input type="hidden" name="marketId" value={market.id} />
              <button type="submit" className={`px-3 py-1 rounded text-sm font-medium ${market.isOpen ? "bg-red-600 hover:bg-red-700" : "bg-green-500 hover:bg-green-600"}`}>
                {market.isOpen ? "Chiudi" : "Apri"}
              </button>
            </form>
          </div>

          {/* Pending offers */}
          <div className="divide-y">
            {market.offers.filter((o) => o.status === "pending").length === 0 ? (
              <div className="p-4 text-sm text-gray-400">Nessuna offerta in attesa.</div>
            ) : (
              market.offers
                .filter((o) => o.status === "pending")
                .map((offer) => (
                  <div key={offer.id} className="px-4 py-3 flex flex-wrap items-center gap-3 bg-yellow-50">
                    <div className="flex-1 min-w-[140px]">
                      <p className="font-medium text-sm">{offer.playerName}</p>
                      <p className="text-xs text-gray-400">{offer.mantraRole} — {offer.realTeam}</p>
                      {offer.note && <p className="text-xs text-gray-500 italic mt-0.5">{offer.note}</p>}
                    </div>
                    <div className="text-sm"><span className="text-gray-500">Da:</span> <strong>{offer.fromTeam}</strong></div>
                    <div className="text-sm font-semibold text-green-700">{offer.price} cr</div>

                    {/* Resolve */}
                    <form action={resolveAction} className="flex gap-2 items-center">
                      <input type="hidden" name="offerId" value={offer.id} />
                      <select name="toUserId" className="border rounded px-2 py-1 text-xs focus:outline-none">
                        <option value="">— Svincolo libero —</option>
                        {users.filter((u) => u.id !== offer.fromUserId).map((u) => (
                          <option key={u.id} value={u.id}>{u.teamName}</option>
                        ))}
                      </select>
                      <button name="action" value="accept" type="submit" disabled={resolvePending} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">✓ Accetta</button>
                      <button name="action" value="reject" type="submit" disabled={resolvePending} className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">✗ Rifiuta</button>
                    </form>
                  </div>
                ))
            )}

            {/* Resolved offers */}
            {market.offers.filter((o) => o.status !== "pending").length > 0 && (
              <details className="group">
                <summary className="px-4 py-2 text-xs text-gray-500 cursor-pointer hover:bg-gray-50">
                  Offerte processate ({market.offers.filter((o) => o.status !== "pending").length})
                </summary>
                <div className="divide-y">
                  {market.offers
                    .filter((o) => o.status !== "pending")
                    .map((offer) => (
                      <div key={offer.id} className="px-4 py-2 flex flex-wrap items-center gap-3 opacity-60">
                        <div className="flex-1 text-sm"><span className="font-medium">{offer.playerName}</span> <span className="text-xs text-gray-400">({offer.mantraRole})</span></div>
                        <div className="text-sm">{offer.fromTeam} — {offer.price} cr</div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${offer.status === "accepted" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {offer.status === "accepted" ? "Accettata" : "Rifiutata"}
                        </span>
                      </div>
                    ))}
                </div>
              </details>
            )}
          </div>
        </div>
      ))}

      {markets.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Nessun mercato. Creane uno sopra.</p>}
    </div>
  );
}
