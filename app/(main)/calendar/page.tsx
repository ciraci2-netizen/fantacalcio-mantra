import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) return null;

  const season = await prisma.season.findFirst({
    where: { isActive: true },
    include: {
      matchdays: {
        orderBy: { number: "asc" },
        include: {
          matches: {
            include: { homeUser: true, awayUser: true },
          },
        },
      },
    },
  });

  if (!season) {
    return <div className="text-center py-12 text-gray-500">Nessuna stagione attiva.</div>;
  }

  const playedMatchdays = season.matchdays.filter((md) =>
    md.matches.some((m) => m.homeScore !== null)
  );
  const upcomingMatchdays = season.matchdays.filter((md) =>
    md.matches.length > 0 && md.matches.every((m) => m.homeScore === null)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">
        Calendario — <span className="text-green-700">{season.name}</span>
      </h1>

      {playedMatchdays.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Risultati</h2>
          <div className="space-y-4">
            {[...playedMatchdays].reverse().slice(0, 5).map((md) => (
              <MatchdayCard key={md.id} md={md} currentUserId={session.userId} />
            ))}
          </div>
        </section>
      )}

      {upcomingMatchdays.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Prossime giornate</h2>
          <div className="space-y-4">
            {upcomingMatchdays.slice(0, 3).map((md) => (
              <MatchdayCard key={md.id} md={md} currentUserId={session.userId} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MatchdayCard({
  md,
  currentUserId,
}: {
  md: {
    number: number;
    matches: Array<{
      id: number;
      homeScore: number | null;
      awayScore: number | null;
      homePoints: number | null;
      homeUser: { id: number; teamName: string };
      awayUser: { id: number; teamName: string };
    }>;
  };
  currentUserId: number;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="bg-green-700 text-white px-4 py-2 font-semibold text-sm">
        Giornata {md.number}
      </div>
      <div className="divide-y">
        {md.matches.map((m) => {
          const isMyMatch = m.homeUser.id === currentUserId || m.awayUser.id === currentUserId;
          const played = m.homeScore !== null;
          return (
            <div
              key={m.id}
              className={`px-4 py-3 flex items-center gap-2 ${isMyMatch ? "bg-green-50" : ""}`}
            >
              <span className={`flex-1 text-right font-medium ${m.homeUser.id === currentUserId ? "text-green-700" : ""}`}>
                {m.homeUser.teamName}
              </span>

              {played ? (
                <div className="flex items-center gap-1 min-w-[80px] justify-center">
                  <span className={`font-bold ${(m.homePoints ?? 0) === 3 ? "text-green-600" : (m.homePoints ?? 0) === 0 ? "text-red-500" : "text-gray-500"}`}>
                    {m.homeScore?.toFixed(1)}
                  </span>
                  <span className="text-gray-300">—</span>
                  <span className={`font-bold ${(m.homePoints ?? 0) === 0 ? "text-green-600" : (m.homePoints ?? 0) === 3 ? "text-red-500" : "text-gray-500"}`}>
                    {m.awayScore?.toFixed(1)}
                  </span>
                </div>
              ) : (
                <span className="text-gray-300 min-w-[80px] text-center font-bold">VS</span>
              )}

              <span className={`flex-1 font-medium ${m.awayUser.id === currentUserId ? "text-green-700" : ""}`}>
                {m.awayUser.teamName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
