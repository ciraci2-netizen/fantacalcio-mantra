import { type NextRequest } from "next/server";

/**
 * Verifica che la request provenga dallo stesso origine dell'app.
 * Usato nelle API route che modificano dati.
 */
export function checkSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return true; // server-to-server call, allow

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}
