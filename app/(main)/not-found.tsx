import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="text-5xl mb-4">🔍</div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Pagina non trovata</h2>
      <p className="text-gray-500 text-sm mb-6">
        Il contenuto che cerchi non esiste o è stato rimosso.
      </p>
      <Link
        href="/dashboard"
        className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        Torna alla Home
      </Link>
    </div>
  );
}
