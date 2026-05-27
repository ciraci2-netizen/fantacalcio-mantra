"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="text-5xl mb-4">⚠️</div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Qualcosa è andato storto</h2>
      <p className="text-gray-500 text-sm mb-6 max-w-sm">
        Si è verificato un errore imprevisto. Riprova o torna alla home.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Riprova
        </button>
        <Link
          href="/dashboard"
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Torna alla Home
        </Link>
      </div>
    </div>
  );
}
