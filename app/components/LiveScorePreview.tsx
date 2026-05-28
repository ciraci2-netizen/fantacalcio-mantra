"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface PreviewData {
  estimated: number | null;
  votedStarters: number;
  totalStarters: number;
  subsUsed: number;
  isComplete: boolean;
  reason?: string;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export default function LiveScorePreview({
  matchdayId,
  votesImported,
}: {
  matchdayId: number;
  votesImported: boolean;
}) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [animating, setAnimating] = useState(false);
  const prevScoreRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/score-preview?matchdayId=${matchdayId}`);
      if (!res.ok) return;
      const json: PreviewData = await res.json();

      // Trigger pop animation when score changes
      if (
        json.estimated !== null &&
        prevScoreRef.current !== null &&
        json.estimated !== prevScoreRef.current
      ) {
        setAnimating(true);
        setTimeout(() => setAnimating(false), 450);
      }
      prevScoreRef.current = json.estimated;

      setData(json);
      setLastUpdated(new Date());
    } catch {
      // network error — silently ignore
    } finally {
      setLoading(false);
    }
  }, [matchdayId]);

  useEffect(() => {
    if (!votesImported) {
      setLoading(false);
      return;
    }
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData, votesImported]);

  if (!votesImported) return null;

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3 animate-pulse">
        <div className="w-5 h-5 rounded-full bg-blue-200" />
        <div className="h-4 w-40 rounded bg-blue-200" />
      </div>
    );
  }

  if (!data || data.estimated === null) return null;

  const pct =
    data.totalStarters > 0
      ? Math.round((data.votedStarters / data.totalStarters) * 100)
      : 0;

  const scoreColor =
    data.estimated >= 70
      ? "text-green-700"
      : data.estimated >= 55
      ? "text-blue-700"
      : "text-red-600";

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <span className="text-sm font-semibold text-blue-800">
            Punteggio stimato
          </span>
          {!data.isComplete && (
            <span className="text-xs text-blue-500 animate-pulse">
              • live
            </span>
          )}
        </div>
        <span
          className={`text-2xl font-bold ${scoreColor} inline-block ${
            animating ? "animate-score-pop" : ""
          }`}
        >
          {data.estimated.toFixed(1)} pt
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-blue-600">
          <span>
            {data.votedStarters}/{data.totalStarters} giocatori con voto
            {data.subsUsed > 0 && ` · ${data.subsUsed} sostituz.`}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {lastUpdated && (
        <p className="text-xs text-blue-400">
          Aggiornato alle{" "}
          {lastUpdated.toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
