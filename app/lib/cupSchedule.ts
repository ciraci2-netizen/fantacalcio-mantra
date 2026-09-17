// Calendario "all'italiana" per un girone: assegna ad ogni partita un
// "turno" (1, 2, 3...) in modo che ogni squadra giochi al massimo una
// partita a turno. Se il numero di squadre e' dispari, ad ogni turno una
// squadra resta a riposo (a rotazione). Metodo del cerchio (circle method):
// funziona per qualsiasi numero di squadre >= 3, ogni coppia si incontra
// esattamente una volta sola (nessun andata/ritorno).
// Pura funzione, nessun accesso al DB - riusabile ovunque serva.

export type ScheduledMatch = {
  roundSlot: number;
  homeUserId: number;
  awayUserId: number;
};

export function generateRoundRobinSchedule(teamIds: number[]): ScheduledMatch[] {
  const BYE = -1;
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push(BYE);

  const n = ids.length;
  if (n < 2) return [];

  const rounds = n - 1;
  const half = n / 2;
  const arr = [...ids];
  const schedule: ScheduledMatch[] = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== BYE && b !== BYE) {
        schedule.push({ roundSlot: r + 1, homeUserId: a, awayUserId: b });
      }
    }
    // Ruota tutte le squadre tranne la prima, che resta fissa in posizione.
    const fixed = arr[0];
    const rest = arr.slice(1);
    const last = rest.pop();
    if (last !== undefined) rest.unshift(last);
    arr.splice(0, arr.length, fixed, ...rest);
  }

  return schedule;
}
