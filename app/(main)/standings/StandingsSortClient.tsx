"use client";

import { useState } from "react";
import TeamLogo from "@/app/components/TeamLogo";

type StandingRow = {
  userId: number;
  teamName: string;
  username: string;
  logoUrl: string | null;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  played: number;
  gf: number;
  ga: number;
  gd: number;
  totalFantapoints: number;
  form: ("W" | "D" | "L")[];
};

type SortKey = "points" | "wins" | "gf" | "gd";

const FORM_STYLES: Record<"W" | "D" | "L", string> = {
  W: "bg-green-100 text-green-700 font-bold",
  D: "bg-gray-100 text-gray-600 font-semibold",
  L: "bg-red-100 text-red-600 font-semibold",
};

const POSITION_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-600"];

export default function StandingsSortClient({
  standings: initialStandings,
  myUserId,
}: {
  standings: StandingRow[];
  myUserId: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const toggle = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const standings = [...initialStandings].sort((a, b) => {
    const diff = b[sortKey] - a[sortKey];
    return sortDir === "desc" ? diff : -diff;
  });

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggle(k)}
      className={`flex items-center justify-center gap-0.5 w-full h-full transition-colors hover:text-gray-800 ${
        sortKey === k ? "text-blue-600 font-bold" : "text-gray-400"
      }`}
    >
      {label}
      {sortKey === k && <span className="text-[10px]">{sortDir === "desc" ? "↓" : "↑"}</span>}
    </button>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Column headers */}
      <div className="hidden sm:grid grid-cols-[3rem_1fr_5rem_repeat(9,3.5rem)] px-4 py-2 border-b bg-gray-50 text-xs uppercase tracking-wide">
        <div />
        <div />
        <div className="text-center text-gray-400">forma</div>
        <div className="text-center text-gray-400">g</div>
        <div className="text-center"><SortBtn k="wins" label="V" /></div>
        <div className="text-center text-gray-400">N</div>
        <div className="text-center text-gray-400">P</div>
        <div className="text-center"><SortBtn k="gf" label="G+" /></div>
        <div className="text-center text-gray-400">G-</div>
        <div className="text-center"><SortBtn k="gd" label="DR" /></div>
        <div className="text-center"><SortBtn k="points" label="PT" /></div>
        <div className="text-center text-gray-400">tot fp</div>
      </div>

      <div className="divide-y">
        {standings.map((s, i) => {
          const isMe = s.userId === myUserId;
          return (
            <div
              key={s.userId}
              className={`flex sm:grid sm:grid-cols-[3rem_1fr_5rem_repeat(9,3.5rem)] items-center gap-2 sm:gap-0 px-4 py-3 transition-colors ${
                isMe ? "border-l-4 border-blue-500 bg-blue-50/40" : "border-l-4 border-transparent hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-center w-8 sm:w-auto">
                <span className={`text-lg font-bold leading-none ${POSITION_COLORS[i] ?? "text-gray-400"}`}>{i + 1}</span>
              </div>
              <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none">
                <TeamLogo logoUrl={s.logoUrl} teamName={s.teamName} size="sm" />
                <div className="min-w-0">
                  <p className={`font-semibold text-sm leading-tight truncate ${isMe ? "text-blue-700" : "text-blue-600"}`}>{s.teamName}</p>
                  <p className="text-gray-400 text-xs leading-tight truncate hidden sm:block">{s.username}</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center justify-center gap-0.5">
                {s.form.length === 0 ? <span className="text-gray-300 text-xs">—</span> : s.form.map((r, idx) => (
                  <span key={idx} className={`w-5 h-5 rounded text-[10px] flex items-center justify-center ${FORM_STYLES[r]}`}>{r}</span>
                ))}
              </div>
              <div className="hidden sm:contents text-sm text-gray-600 text-center">
                <div className="flex items-center justify-center">{s.played}</div>
                <div className="flex items-center justify-center text-green-600 font-medium">{s.wins}</div>
                <div className="flex items-center justify-center">{s.draws}</div>
                <div className="flex items-center justify-center text-red-500">{s.losses}</div>
                <div className="flex items-center justify-center">{s.gf}</div>
                <div className="flex items-center justify-center">{s.ga}</div>
                <div className="flex items-center justify-center">{s.gd > 0 ? `+${s.gd}` : s.gd}</div>
                <div className="flex items-center justify-center font-bold text-blue-600 text-base">{s.points}</div>
                <div className="flex items-center justify-center text-gray-500 text-xs font-medium">{s.totalFantapoints}</div>
              </div>
              <div className="sm:hidden ml-auto flex items-center gap-2">
                {/* Gol fatti/subiti e differenza reti, visibili anche su
                    mobile (prima erano solo nella tabella "sm:" e in su). */}
                <div className="flex flex-col items-end text-[10px] leading-tight text-gray-400 shrink-0">
                  <span className="font-medium text-gray-500">{s.gf}<span className="text-gray-300">-</span>{s.ga}</span>
                  <span>{s.gd > 0 ? `+${s.gd}` : s.gd} dr</span>
                </div>
                <div className="flex gap-0.5">
                  {s.form.slice(0, 3).map((r, idx) => (
                    <span key={idx} className={`w-4 h-4 rounded text-[9px] flex items-center justify-center ${FORM_STYLES[r]}`}>{r}</span>
                  ))}
                </div>
                <span className="font-bold text-blue-600 text-lg">{s.points}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
        <span>g=giocate - v=vinte - n=nulle - p=perse - dr=differenza - <strong className="text-gray-500">pt=punti lega</strong> - tot fp=fantapunti totali</span>
        <span className="text-blue-500">Clicca V, G+, DR, PT per ordinare</span>
      </div>
    </div>
  );
}
