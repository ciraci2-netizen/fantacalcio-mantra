"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

interface NavbarProps {
  username: string;
  teamName: string;
  isAdmin: boolean;
}

export default function Navbar({ username, teamName, isAdmin }: NavbarProps) {
  const path = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/team", label: "Rosa" },
    { href: "/lineup", label: "Formazione" },
    { href: "/standings", label: "Classifica" },
    { href: "/calendar", label: "Calendario" },
    { href: "/coppe", label: "Coppe" },
    { href: "/mercato", label: "Mercato" },
    { href: "/regolamento", label: "Regolamento" },
  ];

  if (isAdmin) {
    links.push({ href: "/admin", label: "Admin" });
  }

  return (
    <nav className="bg-green-700 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">⚽ IPA</span>
          <span className="text-green-200 text-sm hidden sm:block">Fantasy Football PL</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                path === l.href
                  ? "bg-white text-green-700"
                  : "hover:bg-green-600 text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-green-200">
            <span className="font-medium text-white">{teamName}</span>
            <span className="hidden sm:inline"> ({username})</span>
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
            >
              Esci
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
