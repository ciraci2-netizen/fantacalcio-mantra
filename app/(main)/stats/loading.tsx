import { SkeletonTable, SkeletonCard } from "@/app/components/SkeletonCard";

export default function StatsLoading() {
  return (
    <div className="space-y-5">
      <div className="w-40 h-7 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkeletonTable rows={8} />
        <SkeletonTable rows={8} />
      </div>
      <SkeletonCard rows={4} />
    </div>
  );
}
