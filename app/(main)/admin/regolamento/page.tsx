import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import AdminRegolamentoClient from "./AdminRegolamentoClient";

export default async function AdminRegolamentoPage() {
  const session = await getSession();
  if (!session?.isAdmin) return <div className="text-red-500">Non autorizzato</div>;

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
    // Tables not yet created
  }

  return <AdminRegolamentoClient bonusRows={bonusRows} sections={sections} />;
}
