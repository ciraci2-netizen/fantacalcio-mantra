import { ImageResponse } from "next/og";
import { getDb } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

export const runtime = "nodejs";

const ROLE_COLORS: Record<string, string> = {
  Por: "#fef3c7",
  Dc: "#dbeafe",
  Dd: "#dbeafe",
  Ds: "#dbeafe",
  M:  "#dcfce7",
  C:  "#dcfce7",
  T:  "#dcfce7",
  W:  "#dcfce7",
  A:  "#fee2e2",
  Pc: "#fee2e2",
};

const ROLE_TEXT: Record<string, string> = {
  Por: "#92400e",
  Dc: "#1e40af",
  Dd: "#1e40af",
  Ds: "#1e40af",
  M:  "#166534",
  C:  "#166534",
  T:  "#166534",
  W:  "#166534",
  A:  "#991b1b",
  Pc: "#991b1b",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lineupId: string }> }
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { lineupId } = await params;
  const id = Number(lineupId);
  if (!id) return new Response("Not found", { status: 404 });

  const db = getDb();

  // Fetch lineup meta
  const lineupRes = await db.execute({
    sql: `SELECT l.formation, l.totalScore, md.number as matchdayNumber, u.teamName
          FROM "Lineup" l
          JOIN "Matchday" md ON md.id = l.matchdayId
          JOIN "User" u ON u.id = l.userId
          WHERE l.id = ?`,
    args: [id],
  });
  const lineup = lineupRes.rows[0];
  if (!lineup) return new Response("Not found", { status: 404 });

  // Fetch starters + votes
  const slotsRes = await db.execute({
    sql: `SELECT p.name, p.mantraRole, pv.fantavoto, ls.isStarter
          FROM "LineupSlot" ls
          JOIN "Player" p ON p.id = ls.playerId
          JOIN "Lineup" l ON l.id = ls.lineupId
          LEFT JOIN "PlayerVote" pv ON pv.playerId = ls.playerId AND pv.matchdayId = l.matchdayId
          WHERE ls.lineupId = ?
          ORDER BY ls.isStarter DESC, ls.position ASC`,
    args: [id],
  });

  const starters = slotsRes.rows
    .filter((r) => Number(r.isStarter) === 1)
    .map((r) => ({
      name: r.name as string,
      role: r.mantraRole as string,
      fv: r.fantavoto as number | null,
    }));

  const reserves = slotsRes.rows
    .filter((r) => Number(r.isStarter) === 0)
    .map((r) => ({
      name: r.name as string,
      role: r.mantraRole as string,
      fv: r.fantavoto as number | null,
    }));

  const teamName = lineup.teamName as string;
  const matchdayNumber = lineup.matchdayNumber as number;
  const formation = lineup.formation as string;
  const totalScore = lineup.totalScore as number | null;

  // Build image
  return new ImageResponse(
    <div
      style={{
        width: "600px",
        minHeight: "700px",
        background: "#f9fafb",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <div style={{ color: "#86efac", fontSize: "12px", fontWeight: 600, letterSpacing: "1px" }}>
          ⚽ IPA Fantasy Football
        </div>
        <div style={{ color: "white", fontSize: "22px", fontWeight: 800 }}>{teamName}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "white",
              fontSize: "13px",
              padding: "3px 10px",
              borderRadius: "20px",
            }}
          >
            Giornata {matchdayNumber}
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "white",
              fontSize: "13px",
              padding: "3px 10px",
              borderRadius: "20px",
            }}
          >
            {formation}
          </div>
          {totalScore !== null && (
            <div
              style={{
                marginLeft: "auto",
                color: "#fde68a",
                fontSize: "24px",
                fontWeight: 800,
              }}
            >
              {totalScore.toFixed(1)} pt
            </div>
          )}
        </div>
      </div>

      {/* Starters */}
      <div style={{ padding: "16px 24px 8px", display: "flex", flexDirection: "column", gap: "0px" }}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#9ca3af",
            letterSpacing: "1px",
            marginBottom: "8px",
          }}
        >
          TITOLARI ({starters.length})
        </div>
        {starters.map((p, i) => (
          <PlayerCard key={i} player={p} />
        ))}
      </div>

      {/* Reserves */}
      {reserves.length > 0 && (
        <div
          style={{
            padding: "8px 24px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "0px",
            opacity: 0.75,
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#9ca3af",
              letterSpacing: "1px",
              marginBottom: "8px",
              borderTop: "1px solid #e5e7eb",
              paddingTop: "10px",
            }}
          >
            RISERVE ({reserves.length})
          </div>
          {reserves.map((p, i) => (
            <PlayerCard key={i} player={p} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: "auto",
          padding: "10px 24px",
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9ca3af",
          fontSize: "11px",
        }}
      >
        ⚽ IPA Fantasy Football — Premier League Mantra
      </div>
    </div>,
    {
      width: 600,
      headers: {
        "Content-Disposition": `attachment; filename="formazione-g${matchdayNumber}.png"`,
        "Cache-Control": "no-store",
      },
    }
  );
}

function PlayerCard({ player }: { player: { name: string; role: string; fv: number | null } }) {
  const bg = ROLE_COLORS[player.role] ?? "#f3f4f6";
  const textClr = ROLE_TEXT[player.role] ?? "#374151";
  const fvColor =
    player.fv === null ? "#9ca3af" : player.fv >= 7 ? "#15803d" : player.fv >= 6 ? "#374151" : "#dc2626";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "5px 8px",
        borderRadius: "6px",
        marginBottom: "2px",
      }}
    >
      <div
        style={{
          background: bg,
          color: textClr,
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 6px",
          borderRadius: "4px",
          minWidth: "28px",
          textAlign: "center",
        }}
      >
        {player.role}
      </div>
      <div style={{ flex: 1, fontSize: "13px", color: "#111827", fontWeight: 500 }}>
        {player.name}
      </div>
      <div style={{ fontSize: "14px", fontWeight: 700, color: fvColor, minWidth: "32px", textAlign: "right" }}>
        {player.fv !== null ? player.fv.toFixed(1) : "sv"}
      </div>
    </div>
  );
}
