function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

export default function MercatoLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skel className="h-8 w-48" />
        <Skel className="h-5 w-28" />
      </div>
      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 pb-0">
        <Skel className="h-9 w-36" />
        <Skel className="h-9 w-40" />
      </div>
      <Skel className="h-12 w-full rounded-xl" />
      <div className="bg-white rounded-xl border shadow-sm">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b">
            <Skel className="h-4 flex-1 max-w-[160px]" />
            <Skel className="h-4 w-24" />
            <Skel className="h-4 w-16" />
            <Skel className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
