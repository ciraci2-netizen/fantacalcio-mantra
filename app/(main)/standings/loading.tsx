import { SkeletonTable } from "@/app/components/SkeletonCard";

export default function StandingsLoading() {
  return (
    <div className="space-y-4">
      <div className="w-48 h-7 bg-gray-200 rounded animate-pulse" />
      {/* Podium skeleton */}
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl p-6 animate-pulse">
        <div className="flex items-end justify-center gap-4">
          {[56, 72, 44].map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-1 max-w-[100px]">
              <div className="w-14 h-14 rounded-full bg-white/20" />
              <div className="w-20 h-3 bg-white/20 rounded" />
              <div className="w-full bg-white/10 rounded-t-xl" style={{ height: h }} />
            </div>
          ))}
        </div>
      </div>
      <SkeletonTable rows={10} />
    </div>
  );
}
