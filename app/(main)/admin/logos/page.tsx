import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import { getDb } from "@/app/lib/db";
import LogoUploader from "@/app/components/LogoUploader";

export default async function AdminLogosPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/dashboard");

  const db = getDb();
  const usersRes = await db.execute(
    `SELECT id, teamName, username, logoUrl FROM "User" WHERE isAdmin = 0 ORDER BY teamName ASC`
  );

  const users = usersRes.rows.map((r) => ({
    id: r.id as number,
    teamName: r.teamName as string,
    username: r.username as string,
    logoUrl: r.logoUrl as string | null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Loghi Squadre</h1>
        <p className="text-gray-500 text-sm mt-1">
          Carica un logo per ogni squadra (max 200×200px, compresso automaticamente).
          Il logo compare nella classifica, nel calendario e nel profilo squadra.
        </p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Squadra</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Username</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Logo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.teamName}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">@{u.username}</td>
                <td className="px-4 py-3">
                  <LogoUploader
                    userId={u.id}
                    teamName={u.teamName}
                    currentLogoUrl={u.logoUrl}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Formati supportati:</strong> PNG, JPG, WEBP, SVG · L&apos;immagine viene ridimensionata automaticamente a 200×200px e convertita in WebP.
      </div>
    </div>
  );
}
