function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

export default function StandingsLoading() {
  return (
    <div className="space-y-5">
      <Skel className="h-8 w-48" />

      {/* Header row */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-green-700 h-10" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b">
            <Skel className="h-5 w-6" />
            <Skel className="h-8 w-8 rounded-full" />
            <Skel className="h-4 flex-1 max-w-[180px]" />
            <div className="ml-auto flex gap-3">
              {[...Array(5)].map((_, j) => (
                <Skel key={j} className="h-4 w-8" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
