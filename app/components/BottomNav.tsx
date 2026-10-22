"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { allSections, isLinkActive } from "./navConfig";

const NAV = [
  { href: "/dashboard", icon: "🏠", label: "Home" },
  { href: "/lineup",    icon: "📋", label: "Formaz." },
  { href: "/standings", icon: "🏆", label: "Classif." },
  { href: "/calendar",  icon: "📅", label: "Calend." },
];

export default function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const path = usePathname();
  // Il pannello "Altro" resta aperto solo sulla pagina in cui e' stato
  // aperto: cambiando pagina si chiude da solo (senza effetti).
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const moreOpen = openOnPath === path;
  const setMoreOpen = (open: boolean | ((v: boolean) => boolean)) => {
    const next = typeof open === "function" ? open(moreOpen) : open;
    setOpenOnPath(next ? path : null);
  };

  const sections = allSections(isAdmin);
  // "Altro" e' evidenziato quando si e' in una pagina che non ha un tasto proprio
  const onMainTab = NAV.some((item) => isLinkActive(path, item.href));

  return (
    <>
      {/* Pannello "Altro": tutte le sezioni, raggruppate */}
      {moreOpen && (
        <div className="xl:hidden fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label="Tutte le sezioni">
          <button
            type="button"
            aria-label="Chiudi"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-16 inset-x-0 max-h-[75vh] overflow-y-auto bg-white rounded-t-2xl shadow-2xl px-4 pt-3 pb-4 max-w-lg mx-auto">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.title}>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">
                    {section.title}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {section.links.map((l) => {
                      const active = isLinkActive(path, l.href);
                      return (
                        <Link
                          key={l.href}
                          href={l.href}
                          onClick={() => setMoreOpen(false)}
                          className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-1 text-xs font-medium text-center transition-colors ${
                            active
                              ? "bg-green-600 text-white"
                              : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <span className="text-xl leading-none">{l.icon}</span>
                          <span className="leading-tight">{l.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="xl:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-[100] shadow-[0_-2px_10px_rgba(0,0,0,0.07)]">
        <div className="flex h-16 max-w-lg mx-auto">
          {NAV.map((item) => {
            const active = !moreOpen && isLinkActive(path, item.href);
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

          {/* Altro: apre il pannello con tutte le sezioni */}
          {(() => {
            const active = moreOpen || !onMainTab;
            return (
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className={`relative flex-1 flex flex-col items-center justify-center gap-0.5
                  text-[10px] font-medium transition-colors select-none
                  ${active ? "text-green-700" : "text-gray-400 hover:text-gray-600"}`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-600 rounded-b-full" />
                )}
                <span className={`text-xl leading-none transition-transform duration-200 ${active ? "scale-110" : "scale-100"}`}>
                  {moreOpen ? "✕" : "☰"}
                </span>
                <span className="leading-tight">Altro</span>
              </button>
            );
          })()}
        </div>
      </nav>
    </>
  );
}
