import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import Navbar from "@/app/components/Navbar";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        username={session.username}
        teamName={session.teamName}
        isAdmin={session.isAdmin}
      />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">{children}</main>
    </div>
  );
}
