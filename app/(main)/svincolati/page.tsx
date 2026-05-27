"use server";

import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { MANTRA_ROLES } from "@/app/lib/scoring";
import SvincolatiClient from "./SvincolatiClient";

const ROLE_LABEL: Record<string, string> = {
  Por: "Portieri", Dc: "Difensori Centrali", Dd: "Terzini Destri",
  Ds: "Terzini Sinistri", M: "Mediani", C: "Centrocampisti",
  T: "Trequartisti", W: "Esterni", A: "Attaccanti", Pc: "Seconde Punte",
};

export default async function SvincolatiPage() {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();

  const res = await db.execute(
    `SELECT p.id, p.name, p.realTeam, p.mantraRole
     FROM "Player" p
     WHERE p.id NOT IN (SELECT playerId FROM "Roster")
     ORDER BY p.mantraRole ASC, p.name ASC`
  );

  const players = res.rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    realTeam: r.realTeam as string,
    mantraRole: r.mantraRole as string,
  }));

  // Conta per ruolo
  const countByRole: Record<string, number> = {};
  for (const p of players) {
    countByRole[p.mantraRole] = (countByRole[p.mantraRole] ?? 0) + 1;
  }

  return (
    <SvincolatiClient
      players={players}
      countByRole={countByRole}
      roleLabel={ROLE_LABEL}
    />
  );
}
