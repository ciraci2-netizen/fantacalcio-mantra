import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/league-banner.png" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover object-center" />
      <div className="absolute inset-0 bg-black/65" />

      <div className="relative z-10 text-center space-y-4">
        <div className="text-8xl font-extrabold text-white/20 leading-none select-none">404</div>
        <div className="text-5xl">⚽</div>
        <h1 className="text-2xl font-bold text-white">Pagina non trovata</h1>
        <p className="text-white/60 text-sm max-w-xs mx-auto">
          Questo URL non esiste. Forse la pagina è stata spostata o hai seguito un link sbagliato.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/dashboard"
            className="bg-green-500 hover:bg-green-400 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-lg"
          >
            🏠 Vai alla Dashboard
          </Link>
          <Link
            href="/calendar"
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            📅 Calendario
          </Link>
        </div>
      </div>
    </div>
  );
}
