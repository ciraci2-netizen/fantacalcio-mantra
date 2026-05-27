"use client";

import { useState } from "react";
import PitchView, { type PitchPlayer } from "@/app/components/PitchView";

interface Slot {
  playerId: number;
  name: string;
  mantraRole: string;
  fantavoto: number | null;
  isStarter: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  Por: "bg-yellow-100 text-yellow-800",
  Dc: "bg-blue-100 text-blue-800",
  Dd: "bg-blue-100 text-blue-800",
  Ds: "bg-blue-100 text-blue-800",
  M: "bg-green-100 text-green-800",
  C: "bg-green-100 text-green-800",
  T: "bg-green-100 text-green-800",
  W: "bg-green-100 text-green-800",
  A: "bg-red-100 text-red-800",
  Pc: "bg-red-100 text-red-800",
};

export default function HistoryPitchToggle({
  lineupId,
  matchdayNumber,
  formation,
  totalScore,
  starters,
  reserves,
}: {
  lineupId: number;
  matchdayNumber: number;
  formation: string;
  totalScore: number;
  starters: Slot[];
  reserves: Slot[];
}) {
  const [view, setView] = useState<"lista" | "campo">("lista");

  const pitchStarters: PitchPlayer[] = starters.map((s) => ({
    id: s.playerId,
    name: s.name,
    role: s.mantraRole,
    fv: s.fantavoto,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Header */}
      <div className="bg-green-700 text-white px-4 py-2.5 flex items-center justify-between">
        <span className="font-semibold">Giornata {matchdayNumber}</span>
        <div className="flex items-center gap-3">
          <span className="text-green-200 text-sm">{formation}</span>
          <span className="text-xl font-bold">{totalScore.toFixed(1)} pt</span>
          <a
            href={`/api/lineup-share/${lineupId}`}
            download={`formazione-g${matchdayNumber}.png`}
            className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded transition-colors"
            title="Scarica PNG"
          >
            📸 Condividi
          </a>
          {/* View toggle */}
          <div className="flex rounded overflow-hidden border border-white/30 text-xs font-medium">
            <button
              type="button"
              onClick={() => setView("lista")}
              className={`px-2 py-1 transition-colors ${view === "lista" ? "bg-white text-green-700" : "hover:bg-white/20"}`}
            >
              📋
            </button>
            <button
              type="button"
              onClick={() => setView("campo")}
              className={`px-2 py-1 transition-colors ${view === "campo" ? "bg-white text-green-700" : "hover:bg-white/20"}`}
            >
              🏟️
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      {view === "campo" ? (
        <div className="p-2">
          <PitchView
            formation={formation}
            starters={pitchStarters}
            showScores={true}
          />
        </div>
      ) : (
        <div className="p-4">
          {starters.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Titolari ({starters.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {starters.map((s) => (
                  <PlayerRow key={s.playerId} slot={s} />
                ))}
              </div>
            </>
          )}

          {reserves.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Riserve ({reserves.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 opacity-70">
                {reserves.map((s) => (
                  <PlayerRow key={s.playerId} slot={s} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlayerRow({ slot }: { slot: Slot }) {
  const fv = slot.fantavoto;
  const scoreColor =
    fv === null
      ? "text-gray-400"
      : fv >= 7
      ? "text-green-600 font-bold"
      : fv >= 6
      ? "text-gray-700"
      : "text-red-500";

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
      <span
        className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
          ROLE_COLORS[slot.mantraRole] ?? "bg-gray-100 text-gray-700"
        }`}
      >
        {slot.mantraRole}
      </span>
      <span className="text-sm flex-1 truncate">{slot.name}</span>
      <span className={`text-sm shrink-0 ${scoreColor}`}>
        {fv !== null ? fv.toFixed(1) : "sv"}
      </span>
    </div>
  );
}
