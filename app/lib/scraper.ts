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

// ── Decodifica valori dalle icone della pagina fantapiu3 ───────────────────
// La pagina /voti/ NON scrive i valori come testo in celle <td>: ogni voto,
// gol, cartellino ecc. è un'icona <img src=".../voti/XXX.png">. Un parsing
// testuale (cells.text()) trova quindi sempre celle vuote — da qui il
// precedente "0 abbinati" ad ogni import, anche a pagina corretta.
//
// Convenzioni osservate (verificate su Giornata 2, 2026/27 — 312 righe,
// 276 con voto, eventi reali: gol, autogol, ammonizioni, rigori, assist...):
//   voto:  "vsv.png" = SV (non ha giocato) → null
//          "v6.png"/"v7.png"/... (1 cifra)  → voto intero (6, 7, ...)
//          "v55.png"/"v65.png"/... (2 cifre) → parte intera + decimale (5.5, 6.5, ...)
//   eventi ("BONUS/MALUS PORTIERE", "GOAL FATTO", "GOAL SU RIGORE",
//           "AMMONIZIONE", "ESPULSIONE", "RIGORE" [sbagliato/parato],
//           "AUTOGOAL", "ASSIST", "ASSIST DA FERMO"):
//          "tr.png" o "gk.png" (nessun evento / portiere imbattuto) → 0
//          "gs4.png", "gf2.png", "assisx2.png" ecc. → il numero nel nome (4, 2, 2)
//          "giallo.png", "gri.png", "autogo.png", "assis.png" ecc. (senza numero) → 1

function iconFile(src: string | undefined): string {
  return (src?.split("/").pop() || "").replace(/\.png$/i, "").toLowerCase();
}

/** Decodifica l'icona voto (es. "v55.png" → 5.5, "vsv.png" → null). */
function parseVoteIcon(src: string | undefined): number | null {
  const file = iconFile(src);
  if (!file.startsWith("v")) return null;
  const code = file.slice(1);
  if (!code || code === "sv") return null;
  if (code === "10") return 10;
  if (/^\d$/.test(code)) return parseInt(code, 10);
  if (/^\d{2}$/.test(code)) return parseInt(code[0], 10) + parseInt(code[1], 10) / 10;
  return null;
}

/** Decodifica un'icona-evento in un conteggio (es. "gs4.png" → 4, "tr.png" → 0). */
function parseIconCount(src: string | undefined): number {
  const file = iconFile(src);
  if (!file || file === "tr" || file === "gk") return 0;
  const doubled = file.match(/x(\d+)$/i);
  if (doubled) return parseInt(doubled[1], 10);
  const trailingDigits = file.match(/(\d+)$/);
  if (trailingDigits) return parseInt(trailingDigits[1], 10);
  return 1;
}

/**
 * Estrae i voti dall'HTML già scaricato della pagina /voti/ di fantapiu3.
 * Separata da scrapeVotes() per poter essere testata contro un HTML salvato,
 * senza dover rifare la richiesta di rete ogni volta.
 */
export function parseVotesFromHtml(html: string): ScrapedVote[] {
  const $ = cheerio.load(html);

  const results: ScrapedVote[] = [];

  // Il widget dei voti (c'è un solo ".widget-item" per pagina): al suo
  // interno, ogni partita è un blocco ".layout-content-full" (intestazione
  // con le due squadre) seguito da due ".table.lineups" (formazione casa,
  // poi formazione trasferta). Scopiamo la ricerca a questo widget per non
  // raccogliere righe di altri componenti della pagina (es. mini-calendario)
  // che riusano le stesse classi CSS.
  const widget = $(".widget-item").first();

  widget.find(".layout-content-full").each((_i, headerEl) => {
    const header = $(headerEl);
    const teamNames = header
      .find(".team-name .highlight")
      .map((_j, el) => $(el).text().trim().toUpperCase())
      .get();
    if (teamNames.length < 2) return;

    const tables = header.nextAll(".table.lineups").slice(0, 2);

    tables.each((tableIdx, tableEl) => {
      const team = teamNames[tableIdx] ?? "";

      $(tableEl)
        .find(".table-rows .table-row")
        .each((_k, rowEl) => {
          const row = $(rowEl);
          const items = row.find(".table-row-item");
          if (items.length < 11) return; // riga inattesa, non un giocatore

          const nameCell = items.eq(0);
          const role = iconFile(nameCell.find("img").attr("src")).toUpperCase();
          const name = nameCell
            .find(".table-text")
            .first()
            .text()
            .replace(/\s+/g, " ")
            .trim();
          if (!name) return;

          const eventIcon = (dataTitle: string): string | undefined =>
            row.find(`.table-row-item[data-title="${dataTitle}"]`).find("img").attr("src");

          const vote = parseVoteIcon(items.eq(1).find("img").attr("src"));

          const goalsConceded = parseIconCount(eventIcon("BONUS/MALUS PORTIERE"));
          const goalsScored = parseIconCount(eventIcon("GOAL FATTO"));
          // Un solo campo firmato per gol fatti (+) / subiti (-): sulla pagina
          // sono due colonne separate (GF per chi segna, GS/PI per i portieri),
          // ma non si sovrappongono mai sullo stesso giocatore.
          const gfGs = goalsScored > 0 ? goalsScored : goalsConceded > 0 ? -goalsConceded : 0;

          results.push({
            name: name.toUpperCase(),
            team,
            role,
            // "Voto F+3" = voto base secondo Fantapiu3 (pre bonus/malus).
            // fantavoto resta null: è l'app a calcolarlo da vote + eventi,
            // con le regole/soglie della lega — sommarlo qui raddoppierebbe i bonus.
            vote,
            fantavoto: null,
            gfGs,
            gsr: parseIconCount(eventIcon("GOAL SU RIGORE")),
            amm: parseIconCount(eventIcon("AMMONIZIONE")),
            esp: parseIconCount(eventIcon("ESPULSIONE")),
            rpRs: parseIconCount(eventIcon("RIGORE")),
            aut: parseIconCount(eventIcon("AUTOGOAL")),
            ass: parseIconCount(eventIcon("ASSIST")),
            adf: parseIconCount(eventIcon("ASSIST DA FERMO")),
          });
        });
    });
  });

  return results;
}

/**
 * Legge il numero di giornata che la pagina fantapiu3 sta mostrando in
 * questo momento (es. il testo "Giornata 02ª CRYSTAL Palace..." → 2).
 * La pagina non permette di scegliere la giornata (mostra sempre l'ultima
 * disponibile — vedi NB2 sotto): questo serve per VERIFICARE che corrisponda
 * davvero alla giornata che si sta importando, invece di fidarsi alla cieca
 * e rischiare di salvare i voti della giornata sbagliata.
 */
export function detectFantapiuMatchday(html: string): number | null {
  const $ = cheerio.load(html);
  const title = $(".widget-item").first().find(".section-title-wrap p.section-title").first().text();
  const match = title.match(/Giornata\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

async function fetchVotesHtml(): Promise<string> {
  // NB: la vecchia URL "voti-globali/...premier-league.php" è una pagina
  // di fantapiu3.com abbandonata, ferma alla stagione 23/24 — non contiene
  // MAI i voti della stagione corrente, da cui "0 abbinati" ad ogni import.
  // Quella viva e aggiornata è sotto /voti/ (senza "-globali").
  // NB2: questa pagina NON supporta la selezione giornata via query string
  // (mostra sempre l'ultima giornata disponibile — verificato: nessun
  // parametro/link d'archivio presente sulla pagina, nemmeno nella sezione
  // "Storico"), quindi non è possibile richiedere giornate passate: si può
  // solo verificare (vedi detectFantapiuMatchday) che quella mostrata ora
  // sia quella giusta.
  const url = `https://www.fantapiu3.com/voti/voti-fantapiu3-fantacalcio-premier-league.php`;

  const res = await fetchWithRetry(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  return res.text();
}

export async function scrapeVotes(_matchday: number): Promise<ScrapedVote[]> {
  const html = await fetchVotesHtml();
  return parseVotesFromHtml(html);
}

export interface ScrapeResult {
  votes: ScrapedVote[];
  /** Giornata che la pagina fantapiu3 sta mostrando ora (null se non rilevabile). */
  detectedMatchday: number | null;
}

/** Come scrapeVotes(), ma restituisce anche la giornata rilevata sulla pagina. */
export async function scrapeVotesWithMeta(): Promise<ScrapeResult> {
  const html = await fetchVotesHtml();
  return { votes: parseVotesFromHtml(html), detectedMatchday: detectFantapiuMatchday(html) };
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
