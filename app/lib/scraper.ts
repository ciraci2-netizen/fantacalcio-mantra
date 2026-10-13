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
 *
 * NB (13/10/2026): fantapiu3 ha rifatto il markup della pagina (prima era
 * ".layout-content-full" + due ".table.lineups" con righe ".table-row" e
 * colonne individuate da "data-title" — versione precedente qui sotto, nei
 * commenti, per riferimento). Da quando è cambiato, ".table.lineups" non
 * esiste più sulla pagina e lo scraping restituiva silenziosamente 0 voti
 * ad ogni import ("Nessun voto trovato sul sito"). Il nuovo markup,
 * verificato live (Giornata 6, 2026/27): ogni squadra di ogni partita è un
 * ".fp3-team-section" (nome squadra in ".fp3-team-section-name") seguito
 * immediatamente dal suo ".fp3-votes-scroll" → ".fp3-votes-table" con righe
 * <tbody><tr> vere, colonne nell'ordine fisso dell'header: Giocatore, Voto,
 * GS/PI, GF, GSR, AM, ES, RS/RP, AUT, ASS, ADF (10 partite × 2 squadre = 20
 * tabelle, tutte dentro l'unico ".widget-item" della pagina — verificato
 * che nessun'altra sezione la riusa). Le colonne evento non hanno più un
 * "data-title" affidabile: si leggono quindi per posizione (indice di
 * colonna) invece che per nome.
 * La cella giocatore ha ora DUE "<p class='table-text'>": il nome e un
 * secondo paragrafo col minuto di sostituzione (es. "63") quando il
 * giocatore è stato cambiato — per questo si prende SEMPRE e SOLO il primo
 * ".table-text" (mai l'intero testo della cella, che includerebbe il
 * minuto appiccicato al nome, es. "WHITE 63").
 * La pagina non espone più un'icona di ruolo (P/D/C/A) per riga: il campo
 * `role` sotto resta vuoto — non è comunque usato per l'abbinamento o per
 * il calcolo (si usa sempre il ruolo del giocatore già salvato in rosa).
 */
export function parseVotesFromHtml(html: string): ScrapedVote[] {
  const $ = cheerio.load(html);

  const results: ScrapedVote[] = [];

  const widget = $(".widget-item").first();

  widget.find(".fp3-votes-table").each((_i, tableEl) => {
    const table = $(tableEl);
    const team = table
      .parent(".fp3-votes-scroll")
      .prev(".fp3-team-section")
      .find(".fp3-team-section-name")
      .text()
      .trim()
      .toUpperCase();

    table.find("tbody tr").each((_k, rowEl) => {
      const row = $(rowEl);
      const cells = row.find("td");
      if (cells.length < 11) return; // riga inattesa, non un giocatore

      // Solo il primo ".table-text": il secondo (se presente) è il minuto
      // di sostituzione, non parte del nome — vedi commento sopra.
      const name = cells
        .eq(0)
        .find(".table-text")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      if (!name) return;

      const iconAt = (idx: number): string | undefined => cells.eq(idx).find("img").attr("src");

      const vote = parseVoteIcon(iconAt(1));

      const goalsConceded = parseIconCount(iconAt(2)); // GS/PI
      const goalsScored = parseIconCount(iconAt(3)); // GF
      // Un solo campo firmato per gol fatti (+) / subiti (-): sulla pagina
      // sono due colonne separate (GF per chi segna, GS/PI per i portieri),
      // ma non si sovrappongono mai sullo stesso giocatore.
      const gfGs = goalsScored > 0 ? goalsScored : goalsConceded > 0 ? -goalsConceded : 0;

      results.push({
        name: name.toUpperCase(),
        team,
        role: "",
        // "Voto F+3" = voto base secondo Fantapiu3 (pre bonus/malus).
        // fantavoto resta null: è l'app a calcolarlo da vote + eventi,
        // con le regole/soglie della lega — sommarlo qui raddoppierebbe i bonus.
        vote,
        fantavoto: null,
        gfGs,
        gsr: parseIconCount(iconAt(4)),
        amm: parseIconCount(iconAt(5)),
        esp: parseIconCount(iconAt(6)),
        rpRs: parseIconCount(iconAt(7)),
        aut: parseIconCount(iconAt(8)),
        ass: parseIconCount(iconAt(9)),
        adf: parseIconCount(iconAt(10)),
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
