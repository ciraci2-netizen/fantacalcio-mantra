"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 px-4">
      <div className="text-6xl">📵</div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Sei offline</h1>
        <p className="text-gray-500">
          Controlla la connessione e riprova.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
      >
        Riprova
      </button>
    </div>
  );
}
