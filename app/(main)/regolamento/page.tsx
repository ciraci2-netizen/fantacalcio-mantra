export default function RegolamentoPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">Regolamento IPA</h1>

      {/* Formazione */}
      <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-green-700 text-white px-4 py-2 font-semibold">Formazione</div>
        <div className="p-4 space-y-2 text-sm text-gray-700">
          <p>Ogni squadra schiera <strong>11 titolari + 7 riserve</strong> (totale 18 giocatori).</p>
          <p>Moduli validi: <strong>3-4-3 / 3-5-2 / 4-3-3 / 4-4-2 / 4-5-1 / 5-3-2 / 5-4-1</strong></p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>1 Portiere obbligatorio</li>
            <li>Minimo 3 difensori</li>
            <li>Minimo 1 attaccante</li>
            <li>I ruoli Mantra sono: <strong>Por, Dc, Dd, Ds, E, M, C, T, W, A, Pc</strong></li>
          </ul>
        </div>
      </section>

      {/* Punteggi base */}
      <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-green-700 text-white px-4 py-2 font-semibold">Bonus e Malus</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Evento</th>
                <th className="px-4 py-2 text-center">Portiere</th>
                <th className="px-4 py-2 text-center">Difensore</th>
                <th className="px-4 py-2 text-center">Centrocampista</th>
                <th className="px-4 py-2 text-center">Attaccante</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-700">
              {[
                ["Gol segnato", "+10", "+6", "+5", "+3"],
                ["Gol segnato su rigore", "+10", "+6", "+5", "+3"],
                ["Assist", "+1", "+1", "+1", "+1"],
                ["Rigore parato", "+3", "—", "—", "—"],
                ["Rigore sbagliato", "-3", "-3", "-3", "-3"],
                ["Autogol", "-2", "-2", "-2", "-2"],
                ["Ammonizione", "-0.5", "-0.5", "-0.5", "-0.5"],
                ["Espulsione diretta", "-1", "-1", "-1", "-1"],
                ["Gol subiti (portiere)", "-1 a gol", "—", "—", "—"],
                ["Porta inviolata (portiere)", "+1", "—", "—", "—"],
              ].map(([event, por, dif, cen, att]) => (
                <tr key={event} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{event}</td>
                  <td className={`px-4 py-2 text-center font-semibold ${por.startsWith("+") ? "text-green-600" : por.startsWith("-") ? "text-red-500" : "text-gray-400"}`}>{por}</td>
                  <td className={`px-4 py-2 text-center font-semibold ${dif.startsWith("+") ? "text-green-600" : dif.startsWith("-") ? "text-red-500" : "text-gray-400"}`}>{dif}</td>
                  <td className={`px-4 py-2 text-center font-semibold ${cen.startsWith("+") ? "text-green-600" : cen.startsWith("-") ? "text-red-500" : "text-gray-400"}`}>{cen}</td>
                  <td className={`px-4 py-2 text-center font-semibold ${att.startsWith("+") ? "text-green-600" : att.startsWith("-") ? "text-red-500" : "text-gray-400"}`}>{att}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ruoli Mantra */}
      <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-green-700 text-white px-4 py-2 font-semibold">Ruoli Mantra</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Sigla</th>
                <th className="px-4 py-2 text-left">Ruolo</th>
                <th className="px-4 py-2 text-left">Può giocare come</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-700">
              {[
                ["Por", "Portiere", "Por"],
                ["Dc", "Difensore Centrale", "Dc, Dd, Ds"],
                ["Dd", "Difensore Destro", "Dd, Dc, E"],
                ["Ds", "Difensore Sinistro", "Ds, Dc, E"],
                ["E", "Esterno (terzino)", "E, Dd, Ds, M, W"],
                ["M", "Mediano", "M, C"],
                ["C", "Centrocampista Classico", "C, M, T"],
                ["T", "Trequartista", "T, C, W, A"],
                ["W", "Ala", "W, E, T, A"],
                ["A", "Attaccante", "A, Pc"],
                ["Pc", "Prima Punta", "Pc, A"],
              ].map(([sigla, ruolo, alias]) => (
                <tr key={sigla} className="hover:bg-gray-50">
                  <td className="px-4 py-2"><span className="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-xs">{sigla}</span></td>
                  <td className="px-4 py-2 font-medium">{ruolo}</td>
                  <td className="px-4 py-2 text-gray-500">{alias}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Riserve */}
      <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-green-700 text-white px-4 py-2 font-semibold">Sostituzioni Automatiche</div>
        <div className="p-4 space-y-2 text-sm text-gray-700">
          <p>Se un titolare <strong>non gioca</strong> (sv / non pervenuto), viene automaticamente sostituito dalla prima riserva disponibile con il ruolo compatibile.</p>
          <p>Le sostituzioni seguono l&apos;ordine delle riserve indicato nella formazione.</p>
          <p>Una sostituzione non avviene se comprometterebbe i requisiti minimi di modulo.</p>
        </div>
      </section>

      {/* Punteggi partita */}
      <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-green-700 text-white px-4 py-2 font-semibold">Punteggi Partita (Campionato)</div>
        <div className="p-4 text-sm text-gray-700 space-y-2">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-700">3</div>
              <div className="text-gray-600">Vittoria</div>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-600">1</div>
              <div className="text-gray-600">Pareggio</div>
            </div>
            <div className="text-center bg-red-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600">0</div>
              <div className="text-gray-600">Sconfitta</div>
            </div>
          </div>
          <p className="mt-2">Il punteggio della partita è la <strong>somma dei fantavoti</strong> dei titolari (con eventuali sostituzioni). In caso di pareggio nelle coppe si procede ai supplementari simulati.</p>
        </div>
      </section>

      {/* Rosa */}
      <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-green-700 text-white px-4 py-2 font-semibold">Rosa</div>
        <div className="p-4 text-sm text-gray-700 space-y-2">
          <p>Ogni squadra ha una rosa di <strong>massimo 26 giocatori</strong>.</p>
          <p>Le rose vengono costruite tramite asta all&apos;inizio della stagione.</p>
          <p>I giocatori possono essere ceduti o acquistati durante i <strong>mercati</strong> stagionali.</p>
        </div>
      </section>
    </div>
  );
}
