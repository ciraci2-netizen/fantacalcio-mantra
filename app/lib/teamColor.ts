/**
 * Returns a stable Tailwind color pair (bg + text) for a team name.
 * The color is derived from a simple hash so it's always the same for the same name.
 */

const PALETTES = [
  { bg: "bg-red-500",    text: "text-white" },
  { bg: "bg-orange-500", text: "text-white" },
  { bg: "bg-amber-500",  text: "text-white" },
  { bg: "bg-yellow-400", text: "text-gray-900" },
  { bg: "bg-lime-500",   text: "text-white" },
  { bg: "bg-green-600",  text: "text-white" },
  { bg: "bg-teal-500",   text: "text-white" },
  { bg: "bg-cyan-500",   text: "text-white" },
  { bg: "bg-blue-600",   text: "text-white" },
  { bg: "bg-indigo-500", text: "text-white" },
  { bg: "bg-violet-500", text: "text-white" },
  { bg: "bg-purple-600", text: "text-white" },
  { bg: "bg-pink-500",   text: "text-white" },
  { bg: "bg-rose-500",   text: "text-white" },
  { bg: "bg-slate-600",  text: "text-white" },
  { bg: "bg-stone-500",  text: "text-white" },
];

/** CSS hex values for use in SVG / inline styles */
const HEX_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#16a34a", "#14b8a6", "#06b6d4",
  "#2563eb", "#6366f1", "#8b5cf6", "#9333ea",
  "#ec4899", "#f43f5e", "#475569", "#78716c",
];

function hash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h % PALETTES.length;
}

/** Returns Tailwind classes { bg, text } */
export function teamColor(name: string): { bg: string; text: string } {
  return PALETTES[hash(name)];
}

/** Returns a CSS hex color string for SVG / inline styles */
export function teamHex(name: string): string {
  return HEX_PALETTE[hash(name) % HEX_PALETTE.length];
}

/** Returns initials (up to 2 chars) from a team name */
export function teamInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
