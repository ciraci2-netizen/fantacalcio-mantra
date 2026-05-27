function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

export default function CalendarLoading() {
  return (
    <div className="space-y-4">
      <Skel className="h-8 w-40" />

      {/* Matchday pills */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[...Array(8)].map((_, i) => (
          <Skel key={i} className="h-8 w-14 shrink-0 rounded-full" />
        ))}
      </div>

      {/* Match cards */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Skel className="h-8 w-8 rounded-full" />
              <Skel className="h-4 flex-1 max-w-[120px]" />
            </div>
            <Skel className="h-6 w-16 rounded-full" />
            <div className="flex items-center gap-3 flex-1 justify-end">
              <Skel className="h-4 flex-1 max-w-[120px]" />
              <Skel className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
