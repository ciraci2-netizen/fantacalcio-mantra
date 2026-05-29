import { SkeletonCard, SkeletonLine } from "@/app/components/SkeletonCard";

export default function TeamLoading() {
  return (
    <div className="space-y-4">
      <SkeletonLine w="w-48" h="h-7" />
      {/* Filter bar */}
      <div className="flex gap-2 animate-pulse">
        {[0,1,2,3,4].map(i => <div key={i} className="w-16 h-8 bg-gray-200 rounded-full" />)}
      </div>
      {/* Player grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-gray-200 rounded" />
              <div className="w-1/2 h-3 bg-gray-100 rounded" />
            </div>
            <div className="w-8 h-6 bg-gray-200 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
