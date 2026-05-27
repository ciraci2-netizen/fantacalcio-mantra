import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import AdminMercatoClient from "./AdminMercatoClient";

export default async function AdminMercatoPage() {
  const session = await getSession();
  if (!session?.isAdmin) return <div className="text-red-500">Non autorizzato</div>;

  const db = getDb();

  const seasonRes = await db.execute(`SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const season = seasonRes.rows[0] ?? null;

  const marketsRes = season
    ? await db.execute({ sql: `SELECT id, name, isOpen, budget FROM "Market" WHERE seasonId = ? ORDER BY id DESC`, args: [season.id] })
    : { rows: [] };

  const markets = await Promise.all(
    marketsRes.rows.map(async (market) => {
      const offersRes = await db.execute({
        sql: `SELECT mo.id, mo.price, mo.note, mo.status, mo.createdAt,
                     mo.fromUserId, mo.playerId,
                     p.name as playerName, p.mantraRole, p.realTeam,
                     fu.teamName as fromTeam
              FROM "MarketOffer" mo
              JOIN "Player" p ON p.id = mo.playerId
              JOIN "User" fu ON fu.id = mo.fromUserId
              WHERE mo.marketId = ?
              ORDER BY mo.createdAt DESC`,
        args: [market.id],
      });
      return {
        id: market.id as number,
        name: market.name as string,
        isOpen: Number(market.isOpen) === 1,
        budget: market.budget as number,
        offers: offersRes.rows.map((o) => ({
          id: o.id as number,
          price: o.price as number,
          note: o.note as string,
          status: o.status as string,
          createdAt: o.createdAt as string,
          fromUserId: o.fromUserId as number,
          playerId: o.playerId as number,
          fromTeam: o.fromTeam as string,
          playerName: o.playerName as string,
          mantraRole: o.mantraRole as string,
          realTeam: o.realTeam as string,
        })),
      };
    })
  );

  const usersRes = await db.execute(`SELECT id, teamName FROM "User" WHERE isAdmin = 0 ORDER BY teamName ASC`);
  const users = usersRes.rows.map((u) => ({ id: u.id as number, teamName: u.teamName as string }));

  return (
    <AdminMercatoClient
      markets={markets}
      users={users}
      seasonName={season ? (season.name as string) : null}
    />
  );
}
