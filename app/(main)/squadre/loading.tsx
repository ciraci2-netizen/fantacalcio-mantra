import { SkeletonCard } from "@/app/components/SkeletonCard";

export default function SquadreLoading() {
  return (
    <div className="space-y-4">
      <div className="w-36 h-7 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} rows={4} />
        ))}
      </div>
    </div>
  );
}
