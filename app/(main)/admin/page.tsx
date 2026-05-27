import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { getDb } from "@/app/lib/db";
import Link from "next/link";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const db = getDb();

  const [playerCountRes, userCountRes, seasonRes] = await Promise.all([
    db.execute(`SELECT COUNT(*) as c FROM "Player"`),
    db.execute(`SELECT COUNT(*) as c FROM "User" WHERE isAdmin = 0`),
    db.execute(`SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`),
  ]);

  const playerCount = playerCountRes.rows[0].c as number;
  const userCount = userCountRes.rows[0].c as number;
  const season = seasonRes.rows[0] ?? null;

  const votesImported = season
    ? ((
        await db.execute({
          sql: `SELECT COUNT(*) as c FROM "Matchday" WHERE seasonId = ? AND votesImported = 1`,
          args: [season.id],
        })
      ).rows[0].c as number)
    : 0;

  const cards = [
    { href: "/admin/players", icon: "👤", title: "Gestisci Giocatori", desc: `${playerCount} giocatori nel database`, color: "blue" },
    { href: "/admin/users", icon: "👥", title: "Gestisci Utenti", desc: `${userCount} / 12 partecipanti`, color: "purple" },
    { href: "/admin/schedule", icon: "📅", title: "Stagione & Calendario", desc: season ? `Stagione: ${season.name as string}` : "Nessuna stagione attiva", color: "green" },
    { href: "/admin/votes", icon: "📊", title: "Importa Voti", desc: `${votesImported} giornate con voti importati`, color: "amber" },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    purple: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    green: "bg-green-50 border-green-200 hover:bg-green-100",
    amber: "bg-amber-50 border-amber-200 hover:bg-amber-100",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Pannello Admin</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`${colorMap[c.color]} border rounded-xl p-5 transition-colors`}
          >
            <div className="text-3xl mb-2">{c.icon}</div>
            <h2 className="font-semibold text-gray-800">{c.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{c.desc}</p>
          </Link>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Guida rapida:</strong>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li>Aggiungi i 12 partecipanti in <strong>Gestisci Utenti</strong></li>
          <li>Inserisci i giocatori con i loro ruoli Mantra in <strong>Gestisci Giocatori</strong></li>
          <li>Assegna i 26 giocatori a ogni squadra in <strong>Gestisci Utenti → Rosa</strong></li>
          <li>Crea la stagione e genera il calendario in <strong>Stagione & Calendario</strong></li>
          <li>Ogni giornata: importa i voti da Fantapiu3 in <strong>Importa Voti</strong></li>
        </ol>
      </div>
    </div>
  );
}
