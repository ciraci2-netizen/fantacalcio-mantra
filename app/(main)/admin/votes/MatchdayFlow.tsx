import Link from "next/link";
import ReminderButton from "./ReminderButton";

export type FlowOpenMatchday = {
  id: number;
  number: number;
  deadline: string | null;
  submitted: number;
  total: number;
};

export type FlowReviewMatchday = {
  id: number;
  number: number;
  votesImported: boolean;
  matchesTotal: number;
  matchesCalculated: number;
  /** Squadre con formazione d'ufficio (non consegnata) e stato del tavolino */
  notSubmitted: { teamName: string; matchId: number | null; forfeit: boolean }[];
};

type StepState = "done" | "todo" | "warn";

function Step({
  n,
  state,
  title,
  detail,
  href,
  hrefLabel,
  children,
}: {
  n: number;
  state: StepState;
  title: string;
  detail: string;
  href?: string;
  hrefLabel?: string;
  children?: React.ReactNode;
}) {
  const badge =
    state === "done"
      ? "bg-green-600 text-white"
      : state === "warn"
      ? "bg-amber-500 text-white"
      : "bg-gray-200 text-gray-600";
  return (
    <li className="flex gap-3">
      <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${badge}`}>
        {state === "done" ? "✓" : n}
      </span>
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-sm text-gray-800">{title}</span>
          {href && (
            <Link href={href} className="text-xs text-green-700 hover:underline font-medium">
              {hrefLabel ?? "Vai →"}
            </Link>
          )}
        </div>
        <p className="text-xs text-gray-500">{detail}</p>
        {children && <div className="mt-1.5">{children}</div>}
      </div>
    </li>
  );
}

/**
 * Percorso guidato della giornata, in cima alla pagina admin "Gestione
 * giornata": mostra a che punto e' ogni passaggio e porta al comando
 * gia esistente (scadenza, blocco, import, tavolini, calcolo). Solo
 * lettura + link: non sostituisce nessun comando della pagina.
 */
export default function MatchdayFlow({
  open,
  review,
}: {
  open: FlowOpenMatchday | null;
  review: FlowReviewMatchday | null;
}) {
  const fmtDeadline = (d: string) =>
    new Date(d).toLocaleString("it-IT", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Berlin",
    });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {open && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3">🟢 Prima della scadenza — G{open.number}</h2>
          <ol className="space-y-3">
            <Step
              n={1}
              state={open.deadline ? "done" : "warn"}
              title="Scadenza impostata"
              detail={open.deadline ? fmtDeadline(open.deadline) : "Nessuna scadenza: senza, la giornata non si blocca da sola."}
              href="#scadenza"
              hrefLabel={open.deadline ? "Modifica →" : "Imposta →"}
            />
            <Step
              n={2}
              state={open.submitted === open.total ? "done" : "todo"}
              title={`Formazioni consegnate: ${open.submitted}/${open.total}`}
              detail={
                open.submitted === open.total
                  ? "Hanno consegnato tutti."
                  : "Chi non consegna riceve d'ufficio l'ultima formazione inviata."
              }
              href="#formazioni"
              hrefLabel="Dettaglio →"
            >
              {open.submitted < open.total && (
                <ReminderButton matchdayId={open.id} missing={open.total - open.submitted} />
              )}
            </Step>
            <Step
              n={3}
              state="todo"
              title="Blocco giornata"
              detail="Automatico alla scadenza (entro la mezzanotte successiva), oppure a mano con il tasto 🔒."
              href="#formazioni"
              hrefLabel="Blocca a mano →"
            />
          </ol>
        </div>
      )}

      {review && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3">🧮 Dopo le partite — G{review.number}</h2>
          <ol className="space-y-3">
            <Step n={1} state="done" title="Giornata bloccata" detail="Le formazioni non sono più modificabili dai giocatori." />
            <Step
              n={2}
              state={review.notSubmitted.length === 0 ? "done" : review.notSubmitted.every((t) => t.forfeit) ? "done" : "warn"}
              title={
                review.notSubmitted.length === 0
                  ? "Formazioni: consegnate da tutti"
                  : `Non consegnate: ${review.notSubmitted.length} — decidi il tavolino`
              }
              detail={
                review.notSubmitted.length === 0
                  ? "Nessun tavolino da valutare."
                  : "Apri la partita e scegli se dare il 3-0 a tavolino (si può fare prima o dopo il calcolo)."
              }
            >
              {review.notSubmitted.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {review.notSubmitted.map((t) =>
                    t.matchId ? (
                      <Link
                        key={t.teamName}
                        href={`/calendar/${t.matchId}`}
                        className={`text-xs px-2 py-1 rounded-full border font-medium ${
                          t.forfeit
                            ? "bg-amber-100 border-amber-300 text-amber-900"
                            : "bg-white border-amber-300 text-amber-800 hover:bg-amber-50"
                        }`}
                      >
                        {t.forfeit ? "⚖️" : "⚠️"} {t.teamName}
                        {t.forfeit ? " · tavolino" : " · decidi →"}
                      </Link>
                    ) : (
                      <span key={t.teamName} className="text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-500">
                        ⚠️ {t.teamName} · nessuna partita
                      </span>
                    )
                  )}
                </div>
              )}
            </Step>
            <Step
              n={3}
              state={review.votesImported ? "done" : "todo"}
              title="Voti importati"
              detail={review.votesImported ? "Voti presenti." : "Importali (lo fa anche il cron automatico quando escono)."}
              href="#import"
              hrefLabel={review.votesImported ? "Rivedi →" : "Importa →"}
            />
            <Step
              n={4}
              state={
                review.matchesTotal > 0 && review.matchesCalculated === review.matchesTotal
                  ? "done"
                  : review.votesImported
                  ? "warn"
                  : "todo"
              }
              title={`Punteggi calcolati: ${review.matchesCalculated}/${review.matchesTotal} partite`}
              detail={
                review.matchesTotal > 0 && review.matchesCalculated === review.matchesTotal
                  ? "Risultati e classifica aggiornati."
                  : "Seleziona la giornata qui sotto e premi ⚡ Calcola punteggi."
              }
              href="#import"
              hrefLabel="Calcola →"
            />
          </ol>
        </div>
      )}

      {!open && !review && (
        <p className="text-sm text-gray-400">Nessuna giornata da gestire al momento.</p>
      )}
    </div>
  );
}
