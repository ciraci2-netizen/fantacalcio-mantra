"use client";

import { useActionState, useState } from "react";
import { submitBid, withdrawBid } from "@/app/actions/auction";
import DeadlineTimer from "@/app/components/DeadlineTimer";

const ROLE_COLORS: Record<string, string> = {
  POR: "bg-yellow-100 text-yellow-800",
  DC: "bg-blue-100 text-blue-800",
  TER: "bg-indigo-100 text-indigo-800",
  M: "bg-green-100 text-green-800",
  OFF: "bg-teal-100 text-teal-800",
  ATT: "bg-red-100 text-red-800",
};

type Player = { id: number; name: string; realTeam: string; mantraRole: string; bidCount: number };
type MyBid = { bidId: number; amount: number; releasePlayerId: number | null };
type RosterPlayer = { id: number; name: string; mantraRole: string };

function BidRow({
  roundId,
  player,
  myBid,
  remainingBudget,
  poolFull,
  releaseOptions,
}: {
  roundId: number;
  player: Player;
  myBid: MyBid | undefined;
  remainingBudget: number;
  poolFull: boolean;
  releaseOptions: RosterPlayer[];
}) {
  const [bidError, bidAction, bidPending] = useActionState(submitBid, null);
  const [, withdrawAction, withdrawPending] = useActionState(withdrawBid, null);
  const [amount, setAmount] = useState(myBid ? String(myBid.amount) : "");
  const [releasePlayerId, setReleasePlayerId] = useState(myBid?.releasePlayerId ? String(myBid.releasePlayerId) : "");

  const showReleasePicker = poolFull || Boolean(myBid?.releasePlayerId);
  const releasedName = releaseOptions.find((r) => String(r.id) === releasePlayerId)?.name;

  return (
    <li className="px-4 py-2.5 hover:bg-gray-50">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">{player.name}</p>
          <p className="text-xs text-gray-400">
            {player.realTeam}
            {player.bidCount > 0 && (
              <span className="ml-2 text-amber-600">
                · {player.bidCount} offert{player.bidCount === 1 ? "a" : "e"} ricevut{player.bidCount === 1 ? "a" : "e"}
              </span>
            )}
          </p>
        </div>

        <form action={bidAction} className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          <input type="hidden" name="roundId" value={roundId} />
          <input type="hidden" name="playerId" value={player.id} />
          {showReleasePicker && releaseOptions.length > 0 && (
            <select
              name="releasePlayerId"
              value={releasePlayerId}
              onChange={(e) => setReleasePlayerId(e.target.value)}
              className="border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 max-w-[9rem]"
              title="Giocatore da svincolare se l'offerta vince"
            >
              <option value="">- nessuno svincolo -</option>
              {releaseOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          <input
            name="amount"
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="crediti"
            className="w-20 border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            type="submit"
            disabled={bidPending || !amount}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs px-2 py-1.5 rounded font-medium whitespace-nowrap"
          >
            {bidPending ? "..." : myBid ? "Aggiorna" : "Offri"}
          </button>
        </form>

        {myBid && (
          <form action={withdrawAction}>
            <input type="hidden" name="bidId" value={myBid.bidId} />
            <button
              type="submit"
              disabled={withdrawPending}
              className="text-red-400 hover:text-red-600 text-xs shrink-0"
              title="Ritira offerta"
            >
              ✕
            </button>
          </form>
        )}
      </div>

      {showReleasePicker && releaseOptions.length === 0 && (
        <p className="text-xs text-amber-600 mt-1">Slot pieni e nessun giocatore disponibile da svincolare in questo ruolo.</p>
      )}
      {poolFull && releaseOptions.length > 0 && !releasePlayerId && (
        <p className="text-xs text-amber-600 mt-1">Slot pieni: scegli chi svincolare per fare posto, altrimenti l&apos;offerta verra rifiutata.</p>
      )}
      {myBid && (
        <p className="text-xs text-green-700 mt-1">
          Hai offerto <strong>{myBid.amount}</strong> crediti (segreta, visibile solo a te finche il round e aperto)
          {releasedName && (
            <>
              {" "}- se vinci, svincolerai <strong>{releasedName}</strong> per fare posto (promessa: se non vinci, resta in rosa)
            </>
          )}
        </p>
      )}
      {bidError && <p className="text-xs text-red-600 mt-1">{bidError}</p>}
      {!myBid && Number(amount) > remainingBudget && (
        <p className="text-xs text-amber-600 mt-1">Superi il tuo budget residuo ({remainingBudget})</p>
      )}
    </li>
  );
}

export default function AstaClient({
  round,
  notStarted,
  players,
  myBids,
  myRoster,
  remainingBudget,
  slotsUsed,
  limits,
  countByRole,
  roleLabel,
  roles,
}: {
  round: { id: number; name: string; startDate: string | null; endDate: string };
  notStarted: boolean;
  players: Player[];
  myBids: Record<number, MyBid>;
  myRoster: RosterPlayer[];
  remainingBudget: number;
  slotsUsed: { por: number; mov: number };
  limits: { numPortieri: number; numMovimento: number };
  countByRole: Record<string, number>;
  roleLabel: Record<string, string>;
  roles: string[];
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("tutti");

  const porFull = slotsUsed.por >= limits.numPortieri;
  const movFull = slotsUsed.mov >= limits.numMovimento;
  const porOptions = myRoster.filter((r) => r.mantraRole === "POR");
  const movOptions = myRoster.filter((r) => r.mantraRole !== "POR");

  const filtered = players.filter(
    (p) =>
      (roleFilter === "tutti" || p.mantraRole === roleFilter) &&
      (search === "" ||
        p.name.toUpperCase().includes(search.toUpperCase()) ||
        p.realTeam.toUpperCase().includes(search.toUpperCase()))
  );

  const byRole: Record<string, Player[]> = {};
  for (const p of filtered) {
    if (!byRole[p.mantraRole]) byRole[p.mantraRole] = [];
    byRole[p.mantraRole].push(p);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🔨 {round.name}</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Fai un&apos;offerta segreta per gli svincolati che vuoi — nessuno vedrà quanto hai offerto finché il round
          non si chiude. Alla chiusura vince l&apos;offerta più alta per ciascun giocatore.
        </p>
      </div>

      <DeadlineTimer
        deadline={notStarted ? round.startDate : round.endDate}
        isLocked={false}
        label={notStarted ? "L'asta apre tra:" : "Offerte chiuse tra:"}
        expiredLabel="Asta in chiusura — aggiorna la pagina"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Budget residuo</p>
          <p className="text-2xl font-bold text-gray-800">
            {remainingBudget} <span className="text-sm font-normal text-gray-400">crediti</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Include già le offerte in corso non ancora assegnate.</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Slot rosa</p>
          <p className="text-sm text-gray-700 mt-1">
            Portieri: <strong>{slotsUsed.por}/{limits.numPortieri}</strong> · Movimento:{" "}
            <strong>{slotsUsed.mov}/{limits.numMovimento}</strong>
          </p>
        </div>
      </div>

      {notStarted ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-6 text-center text-sm">
          L&apos;asta non è ancora iniziata: potrai fare offerte a partire dall&apos;orario indicato sopra.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Cerca per nome o squadra..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-80 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm focus:outline-none"
            >
              <option value="tutti">Tutti i ruoli</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r} ({countByRole[r] ?? 0})
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
              <div className="text-3xl mb-2">🔍</div>
              <p>Nessun giocatore trovato.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {roles
                .filter((r) => byRole[r]?.length > 0)
                .map((role) => (
                  <div key={role} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className={`px-4 py-2.5 flex items-center justify-between ${ROLE_COLORS[role]} border-b`}>
                      <span className="font-bold text-sm">{role}</span>
                      <span className="text-xs opacity-70">
                        {roleLabel[role]} · {byRole[role].length}
                      </span>
                    </div>
                    <ul className="divide-y">
                      {byRole[role].map((p) => {
                        const isPor = p.mantraRole === "POR";
                        return (
                          <BidRow
                            key={p.id}
                            roundId={round.id}
                            player={p}
                            myBid={myBids[p.id]}
                            remainingBudget={remainingBudget}
                            poolFull={isPor ? porFull : movFull}
                            releaseOptions={isPor ? porOptions : movOptions}
                          />
                        );
                      })}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
