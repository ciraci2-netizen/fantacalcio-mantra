"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", icon: "🏠", label: "Home" },
  { href: "/lineup",    icon: "📋", label: "Formaz." },
  { href: "/standings", icon: "🏆", label: "Classif." },
  { href: "/calendar",  icon: "📅", label: "Calcol." },
  { href: "/bacheca",   icon: "💬", label: "Bacheca" },
];

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav className="xl:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-[100] shadow-[0_-2px_10px_rgba(0,0,0,0.07)]">
      <div className="flex h-16 max-w-lg mx-auto">
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5
                text-[10px] font-medium transition-colors select-none
                ${
                  active
                    ? "text-green-700"
                    : "text-gray-400 hover:text-gray-600"
                }`}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-600 rounded-b-full" />
              )}
              <span
                className={`text-xl leading-none transition-transform duration-200 ${
                  active ? "scale-110" : "scale-100"
                }`}
              >
                {item.icon}
              </span>
              <span className="leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
