"use client";

import { useState, useEffect } from "react";

interface TimeLeft {
  d: number;
  h: number;
  m: number;
  s: number;
  total: number;
}

function calcTimeLeft(deadline: string): TimeLeft | null {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff % 86_400_000) / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1_000),
    total: diff,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function DeadlineTimer({
  deadline,
  isLocked,
}: {
  deadline: string | null;
  isLocked: boolean;
}) {
  const [tl, setTl] = useState<TimeLeft | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!deadline) return;

    const tick = () => setTl(calcTimeLeft(deadline));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [deadline]);

  // ── Giornata bloccata ──────────────────────────────────────
  if (isLocked) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
        <span className="text-base">🔒</span>
        <span>Giornata bloccata — invii chiusi</span>
      </div>
    );
  }

  // ── Nessuna scadenza ──────────────────────────────────────
  if (!deadline) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 text-sm">
        <span className="text-base">⏰</span>
        <span>Scadenza non ancora impostata dall&apos;admin</span>
      </div>
    );
  }

  // ── Scaduta ───────────────────────────────────────────────
  if (mounted && tl === null) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-bold">
        <span className="text-base">⏰</span>
        <span>Scadenza raggiunta — formazione non più inviabile</span>
      </div>
    );
  }

  if (!mounted || !tl) return null;

  // ── Colori in base al tempo rimanente ─────────────────────
  const isUrgent  = tl.total < 6 * 3_600_000;   // < 6 ore
  const isWarning = tl.total < 24 * 3_600_000;   // < 24 ore

  const bg    = isUrgent  ? "bg-red-600"    : isWarning  ? "bg-amber-500"    : "bg-green-600";
  const pulse = isUrgent  ? "animate-pulse"  : "";

  return (
    <div className={`${bg} ${pulse} text-white rounded-xl px-4 py-3 flex flex-wrap items-center gap-3`}>
      <span className="text-base shrink-0">⏰</span>
      <span className="text-sm font-medium shrink-0">Scadenza consegna:</span>

      {/* Countdown blocks */}
      <div className="flex items-center gap-1.5 font-mono">
        {tl.d > 0 && (
          <>
            <Block value={tl.d} label="g" />
            <Sep />
          </>
        )}
        <Block value={tl.h} label="h" />
        <Sep />
        <Block value={tl.m} label="m" />
        <Sep />
        <Block value={tl.s} label="s" />
      </div>

      {/* Human-readable deadline */}
      <span className="text-xs opacity-75 ml-auto shrink-0">
        entro{" "}
        {new Date(deadline).toLocaleString("it-IT", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}

function Block({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="text-xl font-bold tabular-nums">{pad(value)}</span>
      <span className="text-xs opacity-70 mt-0.5">{label}</span>
    </div>
  );
}

function Sep() {
  return <span className="text-xl font-bold opacity-60 pb-3">:</span>;
}
