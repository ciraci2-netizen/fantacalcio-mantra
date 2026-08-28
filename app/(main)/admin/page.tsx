import type { Metadata } from "next";
import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { getDb } from "@/app/lib/db";
import Link from "next/link";
import MigrateButton from "./MigrateButton";
import MigrateRolesButton from "./MigrateRolesButton";
import QuickImportButton from "./QuickImportButton";

export const metadata: Metadata = { title: "Admin" };

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  const db = getDb();

  const seasonRes = await db.execute(`SELECT id, name, currentMatchday FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const season = seasonRes.rows[0] ?? null;

  // ── Current matchday status ─────────────────────────────────────────────
  let matchday: { id: number; number: number; isLocked: boolean; votesImported: boolean; deadline: string | null } | null = null;
  let lineupStats: { submitted: number; total: number; missing: string[] } = { submitted: 0, total: 0, missing: [] };
  let pendingTrades = 0;

  if (season) {
    const mdRes = await db.execute({
      sql: `SELECT id, number, isLocked, votesImported, deadline FROM "Matchday" WHERE seasonId = ? AND number = ? LIMIT 1`,
      args: [season.id, season.currentMatchday],
    });
    if (mdRes.rows[0]) {
      const md = mdRes.rows[0];
      matchday = {
        id: md.id as number,
        number: md.number as number,
        isLocked: Boolean(md.isLocked),
        votesImported: Boolean(md.votesImported),
        deadline: (md.deadline as string | null) ?? null,
      };

      // Who has/hasn't submitted lineup
      const usersRes = await db.execute(`SELECT id, teamName FROM "User" WHERE isParticipant = 1 ORDER BY teamName ASC`);
      const submittedRes = await db.execute({
        sql: `SELECT userId FROM "Lineup" WHERE matchdayId = ?`,
        args: [matchday.id],
      });
      const submittedIds = new Set(submittedRes.rows.map((r) => r.userId as number));
      const allUsers = usersRes.rows;
      const missing = allUsers.filter((u) => !submittedIds.has(u.id as number)).map((u) => u.teamName as string);
      lineupStats = {
        submitted: submittedIds.size,
        total: allUsers.length,
        missing,
      };
    }

    // Pending trade offers
    try {
      const tradeRes = await db.execute({
        sql: `SELECT COUNT(*) as c FROM "TradeOffer" WHERE seasonId = ? AND status = 'pending'`,
        args: [season.id],
      });
      pendingTrades = tradeRes.rows[0].c as number;
    } catch { /* table not yet created */ }
  }

  // ── Quick stats ──────────────────────────────────────────────────────────
  const [playerCountRes, userCountRes, votesImportedRes] = await Promise.all([
    db.execute(`SELECT COUNT(*) as c FROM "Player"`),
    db.execute(`SELECT COUNT(*) as c FROM "User" WHERE isParticipant = 1`),
    season
      ? db.execute({ sql: `SELECT COUNT(*) as c FROM "Matchday" WHERE seasonId = ? AND votesImported = 1`, args: [season.id] })
      : Promise.resolve({ rows: [{ c: 0 }] }),
  ]);

  const playerCount = playerCountRes.rows[0].c as number;
  const userCount = userCountRes.rows[0].c as number;
  const votesImportedCount = votesImportedRes.rows[0].c as number;

  const cards = [
    { href: "/admin/users",    icon: "👥", title: "Utenti",       desc: `${userCount} / 10 partecipanti`,         color: "purple" },
    { href: "/admin/players",  icon: "👤", title: "Giocatori",    desc: `${playerCount} nel database`,             color: "blue"   },
    { href: "/admin/schedule", icon: "📅", title: "Calendario",   desc: season ? `${season.name as string}` : "Nessuna stagione", color: "green" },
    { href: "/admin/votes",    icon: "📊", title: "Voti",         desc: `${votesImportedCount} giornate importate`, color: "amber" },
    { href: "/admin/coppe",    icon: "🏆", title: "Coppe",        desc: "Turni eliminatori",                       color: "yellow" },
    { href: "/admin/mercato",  icon: "🔄", title: "Mercato",      desc: "Apri/chiudi mercati",                     color: "teal"   },
    { href: "/admin/roster",   icon: "📋", title: "Rose",         desc: "Assegna giocatori",                       color: "cyan"   },
    { href: "/admin/logos",    icon: "🖼️", title: "Loghi",        desc: "Immagini squadre",                        color: "pink"   },
    { href: "/admin/regolamento", icon: "📖", title: "Regolamento", desc: "Bonus/malus e testi",                  color: "indigo" },
    { href: "/admin/settings", icon: "⚙️", title: "Impostazioni", desc: "Crediti e soglie",                       color: "slate"  },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    purple: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    green: "bg-green-50 border-green-200 hover:bg-green-100",
    amber: "bg-amber-50 border-amber-200 hover:bg-amber-100",
    yellow: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
    teal: "bg-teal-50 border-teal-200 hover:bg-teal-100",
    indigo: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100",
    slate: "bg-slate-50 border-slate-200 hover:bg-slate-100",
    cyan: "bg-cyan-50 border-cyan-200 hover:bg-cyan-100",
    pink: "bg-pink-50 border-pink-200 hover:bg-pink-100",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Pannello Admin</h1>

      {/* ── STATUS BAR ─────────────────────────────────────────────────────── */}
      {season ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stagione + giornata */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Stagione attiva</p>
            <p className="font-bold text-lg leading-tight">{season.name as string}</p>
            <p className="text-slate-300 text-sm mt-1">Giornata {season.currentMatchday as number}</p>
            {matchday && (
              <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                matchday.isLocked ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"
              }`}>
                {matchday.isLocked ? "🔒 Bloccata" : "🟢 Aperta"}
              </span>
            )}
          </div>

          {/* Formazioni */}
          <div className={`rounded-2xl p-4 border ${
            lineupStats.missing.length === 0
              ? "bg-green-50 border-green-200"
              : lineupStats.missing.length <= 3
              ? "bg-amber-50 border-amber-200"
              : "bg-red-50 border-red-200"
          }`}>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Formazioni G{matchday?.number ?? "—"}</p>
            <p className="font-bold text-2xl text-gray-800">
              {lineupStats.submitted}
              <span className="text-gray-400 font-normal text-lg"> / {lineupStats.total}</span>
            </p>
            {lineupStats.missing.length > 0 ? (
              <div className="mt-2">
                <p className="text-xs font-semibold text-red-600 mb-1">Mancanti:</p>
                {lineupStats.missing.slice(0, 3).map((name) => (
                  <p key={name} className="text-xs text-red-500 truncate">• {name}</p>
                ))}
                {lineupStats.missing.length > 3 && (
                  <p className="text-xs text-red-400">+ altri {lineupStats.missing.length - 3}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-green-600 mt-2 font-medium">✓ Tutti hanno inviato</p>
            )}
          </div>

          {/* Voti */}
          <div className={`rounded-2xl p-4 border ${
            matchday?.votesImported ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
          }`}>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Voti G{matchday?.number ?? "—"}</p>
            <p className={`font-bold text-lg ${matchday?.votesImported ? "text-green-700" : "text-gray-400"}`}>
              {matchday?.votesImported ? "✓ Importati" : "⏳ Non ancora"}
            </p>
            <p className="text-xs text-gray-400 mt-1">{votesImportedCount} giornate totali</p>
            {!matchday?.votesImported && matchday?.isLocked && (
              <Link href="/admin/votes" className="inline-block mt-2 text-xs text-green-600 font-semibold hover:underline">
                Importa ora →
              </Link>
            )}
          </div>

          {/* Scambi pendenti */}
          <div className={`rounded-2xl p-4 border ${
            pendingTrades > 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"
          }`}>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Scambi in attesa</p>
            <p className={`font-bold text-2xl ${pendingTrades > 0 ? "text-amber-700" : "text-gray-400"}`}>
              {pendingTrades}
            </p>
            <Link href="/scambi" className="inline-block mt-2 text-xs text-blue-600 hover:underline">
              Vedi tutti →
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm font-medium">
          ⚠ Nessuna stagione attiva. Crea una stagione in{" "}
          <Link href="/admin/schedule" className="underline">Calendario</Link>.
        </div>
      )}

      {/* ── AZIONI RAPIDE ──────────────────────────────────────────────────── */}
      {matchday && (
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Azioni rapide — G{matchday.number}</h2>
          <div className="flex flex-wrap gap-3">
            <QuickImportButton matchdayId={matchday.id} matchdayNumber={matchday.number} />
            <Link href="/admin/schedule"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
              {matchday.isLocked ? "🔓 Gestisci giornata" : "🔒 Blocca giornata"}
            </Link>
            <Link href="/admin/users"
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors">
              👥 Gestisci utenti
            </Link>
            <Link href="/scambi"
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors">
              🔄 Scambi {pendingTrades > 0 && <span className="bg-white text-amber-700 rounded-full px-1.5 text-xs font-bold">{pendingTrades}</span>}
            </Link>
          </div>
        </div>
      )}

      {/* ── LINK SEZIONI ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Tutte le sezioni</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`${colorMap[c.color]} border rounded-xl p-4 transition-colors`}
            >
              <div className="text-2xl mb-1.5">{c.icon}</div>
              <h3 className="font-semibold text-gray-800 text-sm">{c.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{c.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── UTILITÀ ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <a
          href="/api/admin/export"
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
          download
        >
          💾 Scarica backup JSON
        </a>
        <a
          href="/api/health"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
        >
          🩺 Health check DB
        </a>
      </div>
      <MigrateButton />
      <MigrateRolesButton />
    </div>
  );
}
