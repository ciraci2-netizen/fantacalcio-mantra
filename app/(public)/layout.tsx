import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-green-700 text-white px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">⚽ IPA</span>
            <span className="text-green-300 text-sm hidden sm:block">— Campionato pubblico</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/public/standings" className="text-green-200 hover:text-white transition-colors">
              Classifica
            </Link>
            <Link href="/public/calendar" className="text-green-200 hover:text-white transition-colors">
              Calendario
            </Link>
            <Link
              href="/login"
              className="bg-white text-green-700 px-3 py-1.5 rounded-lg font-medium hover:bg-green-50 transition-colors text-xs"
            >
              Accedi
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">{children}</main>
      <footer className="text-center py-4 text-xs text-gray-400">
        IPA Fantacalcio — solo lettura
      </footer>
    </div>
  );
}
