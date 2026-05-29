"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function calcLeft(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    h: Math.floor(diff / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    total: diff,
  };
}

export default function DeadlineChip({
  deadline,
  isLocked,
  lineupSubmitted,
}: {
  deadline: string | null;
  isLocked: boolean;
  lineupSubmitted?: boolean;
}) {
  const [tl, setTl] = useState<{ h: number; m: number; total: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!deadline) return;
    const tick = () => setTl(calcLeft(deadline));
    tick();
    const id = setInterval(tick, 60_000); // update every minute
    return () => clearInterval(id);
  }, [deadline]);

  if (!mounted) return null; // skip SSR to avoid hydration mismatch

  if (isLocked) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
        <span>🔒</span>
        <span>Formazioni bloccate per questa giornata</span>
      </div>
    );
  }

  // No deadline or deadline passed
  if (!deadline || tl === null) return null;

  // Already submitted — show low-key reminder with countdown
  if (lineupSubmitted) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
        <span>✓</span>
        <span className="font-medium">Formazione inviata</span>
        <span className="text-green-500 text-xs ml-auto">
          scadenza tra {tl.h > 0 ? `${tl.h}h ${tl.m}m` : `${tl.m}m`}
        </span>
        <Link href="/lineup" className="text-green-600 text-xs font-semibold hover:underline ml-1">
          Modifica →
        </Link>
      </div>
    );
  }

  const isUrgent = tl.total < 6 * 3_600_000;   // < 6h
  const isWarning = tl.total < 24 * 3_600_000;  // < 24h

  const timeStr = tl.h > 0 ? `${tl.h}h ${tl.m}m` : `${tl.m}m`;

  if (isUrgent) {
    return (
      <Link
        href="/lineup"
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold animate-pulse hover:bg-red-700 transition-colors"
      >
        <span>⚠️</span>
        <span>Solo {timeStr} al blocco formazioni!</span>
        <span className="ml-auto text-xs opacity-90">Schiera ora →</span>
      </Link>
    );
  }

  if (isWarning) {
    return (
      <Link
        href="/lineup"
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors"
      >
        <span>⏱</span>
        <span><strong>{timeStr}</strong> al blocco formazioni</span>
        <span className="ml-auto text-xs text-amber-600">Invia formazione →</span>
      </Link>
    );
  }

  // Plenty of time — subtle chip
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-sm">
      <span>⏱</span>
      <span>Scadenza formazione tra <strong className="text-gray-800">{timeStr}</strong></span>
      <Link href="/lineup" className="ml-auto text-xs text-green-600 hover:underline font-medium">
        Vai alla formazione →
      </Link>
    </div>
  );
}
