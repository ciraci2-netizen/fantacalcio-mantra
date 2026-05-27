function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      {/* Hero banner */}
      <div className="animate-pulse bg-gray-300 rounded-2xl h-36" />

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-16" />
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 space-y-2">
            <Skel className="h-7 w-16 mx-auto" />
            <Skel className="h-3 w-24 mx-auto" />
          </div>
        ))}
      </div>

      {/* Recent results */}
      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        <Skel className="h-5 w-40" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skel className="h-4 w-32" />
            <div className="flex-1" />
            <Skel className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
