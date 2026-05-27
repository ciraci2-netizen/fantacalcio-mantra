import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { getDb } from "@/app/lib/db";
import Navbar from "@/app/components/Navbar";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = getDb();
  const logoRes = await db.execute({
    sql: `SELECT logoUrl FROM "User" WHERE id = ?`,
    args: [session.userId],
  });
  const logoUrl = (logoRes.rows[0]?.logoUrl as string | null) ?? null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        username={session.username}
        teamName={session.teamName}
        isAdmin={session.isAdmin}
        logoUrl={logoUrl}
      />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">{children}</main>
    </div>
  );
}
