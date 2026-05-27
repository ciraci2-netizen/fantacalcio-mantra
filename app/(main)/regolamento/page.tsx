import { getDb } from "@/app/lib/db";

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n- /g, "</p><li>")
    .replace(/\n/g, "<br/>");
}

export default async function RegolamentoPage() {
  let bonusRows: { id: number; evento: string; portiere: string; difensore: string; centrocampista: string; attaccante: string }[] = [];
  let sections: { id: number; titolo: string; contenuto: string }[] = [];

  try {
    const db = getDb();
    const bonusRes = await db.execute(`SELECT id, evento, portiere, difensore, centrocampista, attaccante FROM "BonusMalusRule" ORDER BY sortOrder ASC`);
    bonusRows = bonusRes.rows.map((r) => ({
      id: r.id as number,
      evento: r.evento as string,
      portiere: r.portiere as string,
      difensore: r.difensore as string,
      centrocampista: r.centrocampista as string,
      attaccante: r.attaccante as string,
    }));

    const sectionsRes = await db.execute(`SELECT id, titolo, contenuto FROM "RegolamentoSection" ORDER BY sortOrder ASC`);
    sections = sectionsRes.rows.map((r) => ({
      id: r.id as number,
      titolo: r.titolo as string,
      contenuto: r.contenuto as string,
    }));
  } catch {
    // Tables not yet created — show empty state
  }

  const noData = bonusRows.length === 0 && sections.length === 0;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">Regolamento IPA</h1>

      {noData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800 text-sm">
          Il regolamento non è ancora stato configurato. Vai su <strong>Admin → Esegui migrazione DB</strong> per caricare le regole predefinite, oppure su <strong>Admin → Regolamento</strong> per aggiungerle manualmente.
        </div>
      )}

      {sections.map((s) => (
        <section key={s.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="bg-green-700 text-white px-4 py-2 font-semibold">{s.titolo}</div>
          <div
            className="p-4 text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none [&_strong]:font-semibold [&_li]:list-disc [&_li]:ml-5"
            dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(s.contenuto)}</p>` }}
          />
        </section>
      ))}

      {bonusRows.length > 0 && (
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
                {bonusRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{row.evento}</td>
                    {[row.portiere, row.difensore, row.centrocampista, row.attaccante].map((val, i) => (
                      <td key={i} className={`px-4 py-2 text-center font-semibold ${val.startsWith("+") ? "text-green-600" : val.startsWith("-") ? "text-red-500" : "text-gray-400"}`}>
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
