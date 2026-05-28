/** Reusable skeleton block (animated pulse) */
export function SkeletonLine({ w = "w-full", h = "h-4" }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-gray-200 rounded animate-pulse`} />;
}

export function SkeletonCard({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border p-5 space-y-3 ${className}`}>
      <SkeletonLine w="w-1/3" h="h-3" />
      <SkeletonLine w="w-1/2" h="h-5" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} w={i % 2 === 0 ? "w-full" : "w-3/4"} />
      ))}
    </div>
  );
}

export function SkeletonHero() {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-7 animate-pulse">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-white/20" />
        <div className="space-y-2">
          <div className="w-24 h-3 bg-white/20 rounded" />
          <div className="w-40 h-6 bg-white/30 rounded" />
          <div className="w-20 h-3 bg-white/20 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="text-center space-y-2">
            <div className="w-12 h-7 bg-white/20 rounded mx-auto" />
            <div className="w-16 h-3 bg-white/15 rounded mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
            <div className="w-6 h-6 rounded-full bg-gray-200" />
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-1.5">
              <div className="w-32 h-4 bg-gray-200 rounded" />
              <div className="w-20 h-3 bg-gray-100 rounded" />
            </div>
            <div className="w-12 h-4 bg-gray-200 rounded" />
            <div className="w-8 h-6 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
