/** Colori badge ruolo Mantra — usati in tutta l'app */
export const ROLE_COLORS: Record<string, string> = {
  POR: "bg-yellow-100 text-yellow-800",
  DC:  "bg-blue-100  text-blue-800",
  TER: "bg-indigo-100 text-indigo-800",
  M:   "bg-green-100 text-green-800",
  OFF: "bg-teal-100  text-teal-800",
  ATT: "bg-red-100   text-red-800",
};

export function roleBadgeClass(role: string): string {
  return ROLE_COLORS[role] ?? "bg-gray-100 text-gray-700";
}
