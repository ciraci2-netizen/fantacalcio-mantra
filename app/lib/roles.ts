/** Colori badge ruolo Mantra — usati in tutta l'app */
export const ROLE_COLORS: Record<string, string> = {
  Por: "bg-yellow-100 text-yellow-800",
  Dc:  "bg-blue-100  text-blue-800",
  Dd:  "bg-blue-100  text-blue-800",
  Ds:  "bg-blue-100  text-blue-800",
  M:   "bg-green-100 text-green-800",
  C:   "bg-green-100 text-green-800",
  T:   "bg-emerald-100 text-emerald-800",
  W:   "bg-teal-100  text-teal-800",
  A:   "bg-red-100   text-red-800",
  Pc:  "bg-orange-100 text-orange-800",
  E:   "bg-purple-100 text-purple-800",
};

export function roleBadgeClass(role: string): string {
  return ROLE_COLORS[role] ?? "bg-gray-100 text-gray-700";
}
