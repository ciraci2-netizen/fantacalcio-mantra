"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type MatchRow = {
  id: number;
  homeScore: number | null;
  awayScore: number | null;
  homePoints: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeUser: { id: number; teamName: string; logoUrl: string | null };
  awayUser: { id: number; teamName: string; logoUrl: string | null };
  /** Badge: formazione d'ufficio (non consegnata) per casa/ospite */
  homeNotSubmitted?: boolean;
  awayNotSubmitted?: boolean;
  /** Badge: risultato a tavolino */
  forfeit?: boolean;
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
    return <img src={logoUrl} alt={teamName} className="w-6 h-6 rounded-full object-cover border border-gray-200 shrink-0" loading="lazy" decoding="async" />;
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
    <div className="bg-gray-100 rounded-xl shadow-md border border-gray-300 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-300 bg-gray-200 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
        <span className="text-sm font-semibold text-gray-700">Giornata {md.number}</span>
      </div>
      {md.matches.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-gray-400">
          Calendario non ancora generato per questa giornata.
        </div>
      )}
      <div className="divide-y">
        {(() => {
          // 🔥 alla partita (o alle partite a pari merito) con piu gol della giornata
          const goalsOf = (x: MatchRow) =>
            x.homeScore !== null && x.homeGoals !== null && x.awayGoals !== null && !x.forfeit ? x.homeGoals + x.awayGoals : -1;
          const maxGoals = Math.max(-1, ...md.matches.map(goalsOf));
          return md.matches.map((m) => {
          const isTopGoals = maxGoals > 0 && goalsOf(m) === maxGoals;
          const notSubmittedTeams = [
            m.homeNotSubmitted ? m.homeUser.teamName : null,
            m.awayNotSubmitted ? m.awayUser.teamName : null,
          ].filter(Boolean) as string[];
          const hasBadges = isTopGoals || m.forfeit || notSubmittedTeams.length > 0;
          const isMyMatch = m.homeUser.id === currentUserId || m.awayUser.id === currentUserId;
          const played = m.homeScore !== null;
          const homeWon = (m.homePoints ?? -1) === 3;
          const awayWon = (m.homePoints ?? -1) === 0;
          const isDraw = (m.homePoints ?? -1) === 1;

          return (
            <Link
              key={m.id}
              href={`/calendar/${m.id}`}
              className={`flex flex-wrap items-center px-4 py-3 gap-x-3 gap-y-1.5 hover:bg-gray-50/80 transition-colors ${
                isMyMatch
                  ? "border-l-4 border-green-500 bg-green-50/30"
                  : "border-l-4 border-transparent"
              }`}
            >
              {/* Home team */}
              <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                <span
                  className={`text-sm font-semibold truncate ${
                    isMyMatch && m.homeUser.id === currentUserId
                      ? "text-green-700"
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
              <div className="flex items-center gap-1.5 shrink-0 min-w-[110px] justify-center">
                {played ? (
                  <div className="text-center">
                    {/* Goals (primary) or raw scores */}
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-base font-bold w-8 text-right tabular-nums ${
                          homeWon ? "text-green-600" : isDraw ? "text-gray-500" : "text-red-400"
                        }`}
                      >
                        {m.homeGoals !== null ? m.homeGoals : m.homeScore?.toFixed(1)}
                      </span>
                      <span className="text-gray-300 text-sm">—</span>
                      <span
                        className={`text-base font-bold w-8 text-left tabular-nums ${
                          awayWon ? "text-green-600" : isDraw ? "text-gray-500" : "text-red-400"
                        }`}
                      >
                        {m.awayGoals !== null ? m.awayGoals : m.awayScore?.toFixed(1)}
                      </span>
                    </div>
                    {/* Secondary: raw scores when goals are shown */}
                    {m.homeGoals !== null && (
                      <div className="text-[10px] text-gray-400 text-center mt-0.5 tabular-nums">
                        {m.homeScore?.toFixed(1)} – {m.awayScore?.toFixed(1)}
                      </div>
                    )}
                  </div>
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
                      ? "text-green-700"
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

              {/* Badge: tavolino, formazione non consegnata, partita con piu gol */}
              {hasBadges && (
                <div className="basis-full flex flex-wrap justify-center gap-1.5">
                  {m.forfeit && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">⚖️ Tavolino</span>
                  )}
                  {notSubmittedTeams.map((t) => (
                    <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      ⚠️ {t}: non consegnata
                    </span>
                  ))}
                  {isTopGoals && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">🔥 Più gol</span>
                  )}
                </div>
              )}
            </Link>
          );
        });
        })()}
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

  const [fading, setFading] = useState(false);
  const pillsRef = useRef<HTMLDivElement>(null);

  // Tiene la pillola della giornata attiva visibile scorrendo la barra in
  // automatico (con 36 giornate la barra non entra tutta e senza questo la
  // selezione poteva "sparire" fuori dallo schermo senza nessun indizio).
  useEffect(() => {
    const container = pillsRef.current;
    if (!container) return;
    const activeBtn = container.children[activeIdx] as HTMLElement | undefined;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeIdx]);

  const go = (idx: number) => {
    const next = Math.max(0, Math.min(idx, matchdays.length - 1));
    if (next === activeIdx) return;
    setFading(true);
    setTimeout(() => {
      setActiveIdx(next);
      setFading(false);
    }, 120);
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
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => pillsRef.current?.scrollBy({ left: -160, behavior: "smooth" })}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white border text-gray-500 text-sm shadow-sm hover:bg-gray-50"
          aria-label="Scorri indietro"
        >
          {"\u2039"}
        </button>
        <div ref={pillsRef} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth">
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
                    : "bg-green-50 text-green-700 hover:bg-green-100"
                }`}
              >
                G{m.number}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => pillsRef.current?.scrollBy({ left: 160, behavior: "smooth" })}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white border text-gray-500 text-sm shadow-sm hover:bg-gray-50"
          aria-label="Scorri avanti"
        >
          {"\u203a"}
        </button>
      </div>

      {/* Swipeable card con fade transition */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="select-none max-w-2xl mx-auto"
        style={{ transition: "opacity 0.12s ease", opacity: fading ? 0 : 1 }}
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
