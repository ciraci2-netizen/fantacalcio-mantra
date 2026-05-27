function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

export default function LineupLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skel className="h-7 w-48" />
        <Skel className="h-5 w-24" />
      </div>

      {/* Deadline timer */}
      <Skel className="h-14 w-full rounded-xl" />

      {/* Score preview */}
      <Skel className="h-16 w-full rounded-xl" />

      {/* Competitions card */}
      <Skel className="h-24 w-full rounded-xl" />

      {/* Form grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Skel className="h-16 w-full rounded-xl" />
          {/* Titolari */}
          <div className="bg-white rounded-xl border shadow-sm p-4 space-y-2">
            <Skel className="h-5 w-24 mb-3" />
            {[...Array(11)].map((_, i) => (
              <Skel key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
        {/* Rosa disponibile */}
        <div className="bg-white rounded-xl border shadow-sm p-4 space-y-2">
          <Skel className="h-5 w-32 mb-3" />
          {[...Array(8)].map((_, i) => (
            <Skel key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
