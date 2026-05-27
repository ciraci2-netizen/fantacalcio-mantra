function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

export default function BachecaLoading() {
  return (
    <div className="space-y-6">
      <Skel className="h-8 w-48" />

      {/* Compose box */}
      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        <Skel className="h-20 w-full" />
        <div className="flex justify-end">
          <Skel className="h-9 w-28" />
        </div>
      </div>

      {/* Messages */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex gap-3">
            <Skel className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skel className="h-4 w-32" />
              <Skel className="h-3 w-full" />
              <Skel className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
