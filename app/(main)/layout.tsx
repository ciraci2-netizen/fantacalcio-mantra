import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import { autoMigrate } from "@/app/lib/autoMigrate";
import Navbar from "@/app/components/Navbar";
import BottomNav from "@/app/components/BottomNav";
import { ToastProvider } from "@/app/components/ToastProvider";
import PwaInstallPrompt from "@/app/components/PwaInstallPrompt";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // Run schema migrations idempotently on every cold start (fail-safe — won't break build)
  try { await autoMigrate(); } catch { /* DB not configured at build time — OK */ }

  const session = await getSession();
  if (!session) redirect("/login");

  const db = getDb();

  // logoUrl — fail-safe (column might not exist yet)
  let logoUrl: string | null = null;
  try {
    const logoRes = await db.execute({
      sql: `SELECT logoUrl FROM "User" WHERE id = ?`,
      args: [session.userId],
    });
    logoUrl = (logoRes.rows[0]?.logoUrl as string | null) ?? null;
  } catch {
    // column not yet migrated — ignore
  }

  // Latest matchday with imported votes (notification badge)
  let latestResultsMatchday = 0;
  try {
    const latestRes = await db.execute(
      `SELECT MAX(number) as latest
       FROM "Matchday"
       WHERE votesImported = 1
         AND seasonId = (SELECT id FROM "Season" WHERE isActive = 1 LIMIT 1)`
    );
    latestResultsMatchday = (latestRes.rows[0]?.latest as number) ?? 0;
  } catch {
    // ignore
  }

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col overflow-x-hidden">
        <Navbar
          username={session.username}
          teamName={session.teamName}
          isAdmin={session.isAdmin}
          logoUrl={logoUrl}
          latestResultsMatchday={latestResultsMatchday}
        />
        {/* pb-16 on mobile to account for BottomNav height */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 pb-20 xl:pb-6">
          {children}
        </main>
        <BottomNav />
        <PwaInstallPrompt />
      </div>
    </ToastProvider>
  );
}
