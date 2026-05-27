"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { useState } from "react";

interface NavbarProps {
  username: string;
  teamName: string;
  isAdmin: boolean;
}

const BASE_LINKS = [
  { href: "/dashboard",   label: "Dashboard",   icon: "🏠" },
  { href: "/team",        label: "Rosa",        icon: "👥" },
  { href: "/lineup",      label: "Formazione",  icon: "📋" },
  { href: "/standings",   label: "Classifica",  icon: "🏆" },
  { href: "/calendar",    label: "Calendario",  icon: "📅" },
  { href: "/squadre",     label: "Squadre",     icon: "🔍" },
  { href: "/stats",       label: "Statistiche", icon: "📊" },
  { href: "/coppe",       label: "Coppe",       icon: "🏅" },
  { href: "/mercato",     label: "Mercato",     icon: "🔄" },
  { href: "/regolamento", label: "Regolamento", icon: "📖" },
];

export default function Navbar({ username, teamName, isAdmin }: NavbarProps) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const links = isAdmin
    ? [...BASE_LINKS, { href: "/admin", label: "Admin", icon: "⚙️" }]
    : BASE_LINKS;

  const initials = teamName.slice(0, 2).toUpperCase();

  return (
    <nav className="bg-green-700 text-white shadow-md relative z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold">⚽ IPA</span>
          <span className="text-green-200 text-xs hidden md:block">Fantasy Football PL</span>
        </Link>

        {/* Desktop links — visible at xl+ */}
        <div className="hidden xl:flex items-center gap-0.5 flex-1 justify-center overflow-x-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-2 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                path === l.href
                  ? "bg-white text-green-700"
                  : "hover:bg-green-600 text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right: avatar + user info + logout (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-green-400 flex items-center justify-center text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-sm font-semibold leading-tight">{teamName}</span>
            <Link
              href="/profile"
              className="text-green-300 text-xs leading-tight hover:text-white transition-colors"
            >
              Profilo
            </Link>
          </div>
          <form action={logout} className="hidden xl:block ml-1">
            <button
              type="submit"
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
            >
              Esci
            </button>
          </form>
          <button
            className="xl:hidden p-2 rounded hover:bg-green-600 transition-colors"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Chiudi menu" : "Apri menu"}
          >
            <span className="text-lg leading-none select-none">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Mobile / tablet drawer */}
      {open && (
        <div className="xl:hidden bg-green-800 border-t border-green-600">
          <div className="px-3 py-2 space-y-0.5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  path === l.href
                    ? "bg-white text-green-800"
                    : "hover:bg-green-700 text-white"
                }`}
              >
                <span className="text-base w-6 text-center">{l.icon}</span>
                {l.label}
              </Link>
            ))}
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                path === "/profile"
                  ? "bg-white text-green-800"
                  : "hover:bg-green-700 text-white"
              }`}
            >
              <span className="text-base w-6 text-center">👤</span>
              Profilo
            </Link>
          </div>
          <div className="px-4 py-3 border-t border-green-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-green-500 border-2 border-green-400 flex items-center justify-center text-sm font-bold">
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold">{teamName}</p>
                <p className="text-green-300 text-xs">{username}</p>
              </div>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
              >
                Esci
              </button>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}
