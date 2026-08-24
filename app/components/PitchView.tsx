"use client";

export interface PitchPlayer {
  id: number;
  name: string;
  role: string;
  fv?: number | null;
  availability?: string; // "ok" | "inj" | "sus"
}

// Role → display group (0=GK, 1=DEF, 2=MID, 3=ATT)
const ROLE_ORDER: Record<string, number> = {
  POR: 0,
  DC: 1, TER: 1,
  M: 2, OFF: 2,
  ATT: 3,
};

const ROLE_BG: Record<string, string> = {
  POR: "#fde68a",
  DC: "#93c5fd", TER: "#a5b4fc",
  M:  "#86efac", OFF: "#5eead4",
  ATT: "#fca5a5",
};

/** "Mario Rossi" → "M. Rossi" (capped at 10 chars) */
function abbrev(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0, 10);
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`.slice(0, 12);
}

/** Parse "4-3-3" → [4, 3, 3] */
function parseParts(formation: string): number[] {
  return formation.split("-").map(Number);
}

/**
 * Build rows from formation + starters.
 * Starters are sorted by role group then assigned sequentially to rows:
 *   row0 = [GK ×1], row1 = [DEF ×N1], row2 = [MID ×N2], …
 */
function buildRows(
  formation: string,
  starters: (PitchPlayer | null)[]
): (PitchPlayer | null)[][] {
  const counts = [1, ...parseParts(formation)]; // e.g. [1,4,3,3]

  // Sort by role group: GK → DEF → MID → ATT
  const sorted = [...starters].sort((a, b) => {
    const ga = a ? (ROLE_ORDER[a.role] ?? 2) : 99;
    const gb = b ? (ROLE_ORDER[b.role] ?? 2) : 99;
    return ga - gb;
  });

  const rows: (PitchPlayer | null)[][] = [];
  let idx = 0;
  for (const count of counts) {
    const row: (PitchPlayer | null)[] = [];
    for (let j = 0; j < count; j++) {
      row.push(sorted[idx++] ?? null);
    }
    rows.push(row);
  }
  return rows;
}

interface PitchViewProps {
  formation: string;
  starters: (PitchPlayer | null)[];
  /** Show fantavoto scores under player names */
  showScores?: boolean;
  className?: string;
}

export default function PitchView({
  formation,
  starters,
  showScores = false,
  className = "",
}: PitchViewProps) {
  const rows = buildRows(formation, starters);
  // Display: ATT at top → GK at bottom
  const displayRows = [...rows].reverse();

  return (
    <div
      className={`relative rounded-xl overflow-hidden select-none ${className}`}
      style={{
        background:
          "linear-gradient(180deg,#166534 0%,#15803d 22%,#14532d 49%,#166534 49.5%,#14532d 50%,#15803d 51%,#15803d 78%,#166534 100%)",
        minHeight: 400,
      }}
    >
      {/* ── Field markings ─────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Outer boundary */}
        <div className="absolute inset-[6px] border border-white/20 rounded" />
        {/* Centre line */}
        <div className="absolute left-[6px] right-[6px] border-t border-white/25" style={{ top: "50%" }} />
        {/* Centre circle */}
        <div
          className="absolute border border-white/20 rounded-full"
          style={{ width: 64, height: 64, top: "calc(50% - 32px)", left: "calc(50% - 32px)" }}
        />
        {/* Top penalty area */}
        <div
          className="absolute border border-white/15"
          style={{ width: "55%", height: "14%", top: 6, left: "22.5%" }}
        />
        {/* Bottom penalty area */}
        <div
          className="absolute border border-white/15"
          style={{ width: "55%", height: "14%", bottom: 6, left: "22.5%" }}
        />
      </div>

      {/* ── Players ────────────────────────────────────────────── */}
      <div
        className="relative z-10 flex flex-col"
        style={{ minHeight: 400, padding: "8px 4px" }}
      >
        {displayRows.map((row, ri) => (
          <div
            key={ri}
            className="flex items-center justify-around flex-1"
          >
            {row.map((player, pi) => (
              <PlayerDot
                key={pi}
                player={player}
                showScore={showScores}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerDot({
  player,
  showScore,
}: {
  player: PitchPlayer | null;
  showScore: boolean;
}) {
  if (!player) {
    return (
      <div className="flex flex-col items-center" style={{ width: 56 }}>
        <div className="w-10 h-10 rounded-full bg-white/10 border border-dashed border-white/30" />
      </div>
    );
  }

  const roleBg = ROLE_BG[player.role] ?? "#e5e7eb";
  const fv = player.fv;
  const fvColor =
    !showScore || fv === null || fv === undefined
      ? ""
      : fv >= 7
      ? "text-yellow-300"
      : fv >= 6
      ? "text-white"
      : "text-red-300";

  const isOut =
    player.availability === "inj" || player.availability === "sus";

  return (
    <div className="flex flex-col items-center" style={{ width: 60 }}>
      {/* Circle */}
      <div className="relative">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shadow-lg border-2 border-white/50"
          style={{ background: roleBg, color: "#1e293b" }}
        >
          {player.role}
        </div>
        {isOut && (
          <span
            className="absolute -top-1 -right-1 text-xs leading-none"
            title={player.availability === "inj" ? "Infortunato" : "Squalificato"}
          >
            {player.availability === "inj" ? "🤕" : "🟨"}
          </span>
        )}
      </div>

      {/* Name */}
      <div
        className="text-white text-center mt-0.5 font-medium leading-tight"
        style={{ fontSize: 9, maxWidth: 56 }}
      >
        <div className="truncate">{abbrev(player.name)}</div>
        {showScore && fv !== null && fv !== undefined && (
          <div className={`font-bold text-xs mt-0.5 ${fvColor}`}>
            {fv.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
}
