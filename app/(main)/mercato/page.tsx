import type { Metadata } from "next";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import MercatoClient from "./MercatoClient";

export const metadata: Metadata = { title: "Mercato" };

export default async function MercatoPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const seasonRes = await db.execute(`SELECT id, name FROM "Season" WHERE isActive = 1 LIMIT 1`);
  const season = seasonRes.rows[0] ?? null;

  if (!season) {
    return <div className="text-center py-12 text-gray-500">Nessuna stagione attiva.</div>;
  }

  const marketsRes = await db.execute({
    sql: `SELECT id, name, isOpen, budget FROM "Market" WHERE seasonId = ? ORDER BY id DESC`,
    args: [season.id],
  });

  const markets = await Promise.all(
    marketsRes.rows.map(async (market) => {
      const offersRes = await db.execute({
        sql: `SELECT mo.id, mo.price, mo.note, mo.status, mo.createdAt,
                     mo.fromUserId, mo.toUserId,
                     p.name as playerName, p.mantraRole, p.realTeam,
                     fu.teamName as fromTeam, tu.teamName as toTeam
              FROM "MarketOffer" mo
              JOIN "Player" p ON p.id = mo.playerId
              JOIN "User" fu ON fu.id = mo.fromUserId
              LEFT JOIN "User" tu ON tu.id = mo.toUserId
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
          fromTeam: o.fromTeam as string,
          toTeam: o.toTeam as string | null,
          playerName: o.playerName as string,
          mantraRole: o.mantraRole as string,
          realTeam: o.realTeam as string,
        })),
      };
    })
  );

  const rosterRes = await db.execute({
    sql: `SELECT r.id as rosterId, p.id as playerId, p.name, p.mantraRole, p.realTeam, r.purchasePrice
          FROM "Roster" r JOIN "Player" p ON p.id = r.playerId
          WHERE r.userId = ? ORDER BY p.mantraRole ASC, p.name ASC`,
    args: [session.userId],
  });

  const myRoster = rosterRes.rows.map((r) => ({
    rosterId: r.rosterId as number,
    playerId: r.playerId as number,
    name: r.name as string,
    mantraRole: r.mantraRole as string,
    realTeam: r.realTeam as string,
    purchasePrice: r.purchasePrice as number,
  }));

  return (
    <MercatoClient
      markets={markets}
      myRoster={myRoster}
      currentUserId={session.userId}
      isAdmin={session.isAdmin}
      seasonName={season.name as string}
    />
  );
}
