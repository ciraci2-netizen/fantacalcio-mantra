import * as cheerio from "cheerio";
import { log, logError } from "./logger";

/** Fetch con retry esponenziale (3 tentativi: 1s, 2s, 4s) */
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (attempt < retries) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        log("scraper_retry", { attempt, status: res.status, delay });
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      if (attempt === retries) { logError("scraper_fail", err, { attempt, url }); throw err; }
      const delay = 1000 * Math.pow(2, attempt - 1);
      log("scraper_retry", { attempt, error: String(err), delay }, "warn");
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("fetchWithRetry: unreachable");
}

export interface ScrapedVote {
  name: string;
  team: string;
  role: string;
  vote: number | null;
  fantavoto: number | null;
  gfGs: number;
  gsr: number;
  amm: number;
  esp: number;
  rpRs: number;
  aut: number;
  ass: number;
  adf: number;
}

function parseNum(val: string): number {
  const n = parseFloat(val.replace(",", ".").trim());
  return isNaN(n) ? 0 : n;
}

function parseVote(val: string): number | null {
  const cleaned = val.replace(",", ".").trim();
  if (!cleaned || cleaned === "-" || cleaned === "sv" || cleaned === "SV") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export async function scrapeVotes(matchday: number): Promise<ScrapedVote[]> {
  // NB: la vecchia URL "voti-globali/...premier-league.php" è una pagina
  // di fantapiu3.com abbandonata, ferma alla stagione 23/24 — non contiene
  // MAI i voti della stagione corrente, da cui "0 abbinati" ad ogni import.
  // Quella viva e aggiornata è sotto /voti/ (senza "-globali").
  // NB2: questa pagina NON supporta la selezione giornata via query string
  // (mostra sempre l'ultima giornata disponibile), quindi il parametro
  // `matchday` qui non è utilizzabile per richiedere giornate passate.
  const url = `https://www.fantapiu3.com/voti/voti-fantapiu3-fantacalcio-premier-league.php`;

  const res = await fetchWithRetry(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  const html = await res.text();
  const $ = cheerio.load(html);

  const results: ScrapedVote[] = [];

  // Cerca il contenuto della giornata selezionata
  // La pagina contiene tutte le giornate, bisogna trovare quella giusta
  // Ogni sezione giornata è identificata da un tab/div con id o classe

  // Prova a trovare le righe della tabella voti
  // La struttura tipica: table con righe tr, ogni riga ha td con nome, squadra-ruolo, FV, V, GF/GS, ...
  $("table tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 10) return;

    const nameCell = $(cells[0]).text().trim();
    const teamRoleCell = $(cells[1]).text().trim();

    if (!nameCell || !teamRoleCell) return;

    // teamRoleCell formato: "LIVERPOOL - P" o "INTER - D"
    const parts = teamRoleCell.split(" - ");
    if (parts.length < 2) return;

    const team = parts[0].trim();
    const role = parts[parts.length - 1].trim();

    const fv = parseVote($(cells[2]).text());
    const v = parseVote($(cells[3]).text());
    const gfGs = parseNum($(cells[4]).text());
    const gsr = parseNum($(cells[5]).text());
    const amm = parseNum($(cells[6]).text());
    const esp = parseNum($(cells[7]).text());
    const rpRs = parseNum($(cells[8]).text());
    const aut = parseNum($(cells[9]).text());
    const ass = cells.length > 10 ? parseNum($(cells[10]).text()) : 0;
    const adf = cells.length > 11 ? parseNum($(cells[11]).text()) : 0;

    results.push({
      name: nameCell.toUpperCase(),
      team,
      role,
      vote: v,
      fantavoto: fv,
      gfGs,
      gsr,
      amm,
      esp,
      rpRs,
      aut,
      ass,
      adf,
    });
  });

  return results;
}

// Mappa ruolo fantapiu3 (P/D/C/A) a ruolo Mantra
export function mapRoleToMantra(role: string): string {
  const map: Record<string, string> = {
    P: "POR",
    D: "DC",
    C: "OFF",
    A: "ATT",
  };
  return map[role.toUpperCase()] || "OFF";
}
