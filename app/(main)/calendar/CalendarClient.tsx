"use client";

import { useState, useRef } from "react";
import Link from "next/link";

type MatchRow = {
  id: number;
  homeScore: number | null;
  awayScore: number | null;
  homePoints: number | null;
  homeUser: { id: number; teamName: string; logoUrl: string | null };
  awayUser: { id: number; teamName: string; logoUrl: string | null };
};

type MatchdayData = {
  id: number;
  number: number;
  matches: MatchRow[];
};

function TeamAvatarSmall({ teamName, logoUrl }: { teamName: string; logoUrl: string | null }) {
  const initials = teamName.slice(0, 2).toUpperCase();
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={teamName} className="w-6 h-6 rounded-full object-cover border border-gray-200 shrink-0" />;
  }
  return (
    <div className="w-6 h-6 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

function MatchdayCard({
  md,
  currentUserId,
}: {
  md: MatchdayData;
  currentUserId: number;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
        <span className="text-sm font-semibold text-gray-700">Giornata {md.number}</span>
      </div>
      <div className="divide-y">
        {md.matches.map((m) => {
          const isMyMatch = m.homeUser.id === currentUserId || m.awayUser.id === currentUserId;
          const played = m.homeScore !== null;
          const homeWon = (m.homePoints ?? -1) === 3;
          const awayWon = (m.homePoints ?? -1) === 0;
          const isDraw = (m.homePoints ?? -1) === 1;

          return (
            <Link
              key={m.id}
              href={`/calendar/${m.id}`}
              className={`flex items-center px-4 py-3 gap-3 hover:bg-gray-50/80 transition-colors ${
                isMyMatch
                  ? "border-l-4 border-blue-500 bg-blue-50/30"
                  : "border-l-4 border-transparent"
              }`}
            >
              {/* Home team */}
              <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                <span
                  className={`text-sm font-semibold truncate ${
                    isMyMatch && m.homeUser.id === currentUserId
                      ? "text-blue-700"
                      : played
                      ? homeWon
                        ? "text-gray-800"
                        : "text-gray-400"
                      : "text-gray-700"
                  }`}
                >
                  {m.homeUser.teamName}
                </span>
                <TeamAvatarSmall logoUrl={m.homeUser.logoUrl} teamName={m.homeUser.teamName} />
              </div>

              {/* Score / VS */}
              <div className="flex items-center gap-1.5 shrink-0 min-w-[100px] justify-center">
                {played ? (
                  <>
                    <span
                      className={`text-base font-bold w-10 text-right ${
                        homeWon ? "text-green-600" : isDraw ? "text-gray-500" : "text-red-400"
                      }`}
                    >
                      {m.homeScore?.toFixed(1)}
                    </span>
                    <span className="text-gray-300 text-sm">—</span>
                    <span
                      className={`text-base font-bold w-10 text-left ${
                        awayWon ? "text-green-600" : isDraw ? "text-gray-500" : "text-red-400"
                      }`}
                    >
                      {m.awayScore?.toFixed(1)}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-300 font-semibold text-sm tracking-widest">VS</span>
                )}
              </div>

              {/* Away team */}
              <div className="flex items-center gap-2 flex-1 justify-start min-w-0">
                <TeamAvatarSmall logoUrl={m.awayUser.logoUrl} teamName={m.awayUser.teamName} />
                <span
                  className={`text-sm font-semibold truncate ${
                    isMyMatch && m.awayUser.id === currentUserId
                      ? "text-blue-700"
                      : played
                      ? awayWon
                        ? "text-gray-800"
                        : "text-gray-400"
                      : "text-gray-700"
                  }`}
                >
                  {m.awayUser.teamName}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarClient({
  matchdays,
  currentUserId,
  seasonName,
  initialIndex,
}: {
  matchdays: MatchdayData[];
  currentUserId: number;
  seasonName: string;
  initialIndex: number;
}) {
  const [activeIdx, setActiveIdx] = useState(
    Math.max(0, Math.min(initialIndex, matchdays.length - 1))
  );
  const touchStartX = useRef<number | null>(null);

  const go = (idx: number) => {
    setActiveIdx(Math.max(0, Math.min(idx, matchdays.length - 1)));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) go(activeIdx + 1);
    else go(activeIdx - 1);
  };

  const md = matchdays[activeIdx];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">
        Calendario — <span className="text-green-700">{seasonName}</span>
      </h1>

      {/* Matchday pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {matchdays.map((m, idx) => {
          const hasPlayed = m.matches.some((mm) => mm.homeScore !== null);
          return (
            <button
              key={m.id}
              onClick={() => go(idx)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                idx === activeIdx
                  ? "bg-green-600 text-white shadow-sm"
                  : hasPlayed
                  ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  : "bg-blue-50 text-blue-600 hover:bg-blue-100"
              }`}
            >
              G{m.number}
            </button>
          );
        })}
      </div>

      {/* Swipeable card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="select-none"
      >
        {md && <MatchdayCard md={md} currentUserId={currentUserId} />}
      </div>

      {/* Prev / Next */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => go(activeIdx - 1)}
          disabled={activeIdx === 0}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 disabled:opacity-30 hover:text-gray-800 transition-colors"
        >
          ← {matchdays[activeIdx - 1] ? `G${matchdays[activeIdx - 1].number}` : ""}
        </button>
        <span className="text-xs text-gray-400">
          {activeIdx + 1} / {matchdays.length}
        </span>
        <button
          onClick={() => go(activeIdx + 1)}
          disabled={activeIdx === matchdays.length - 1}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 disabled:opacity-30 hover:text-gray-800 transition-colors"
        >
          {matchdays[activeIdx + 1] ? `G${matchdays[activeIdx + 1].number}` : ""} →
        </button>
      </div>
    </div>
  );
}
