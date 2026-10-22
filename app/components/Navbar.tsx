"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { useState, useEffect, useRef } from "react";
import ThemeToggle from "./ThemeToggle";
import { HOME_LINK, RULES_LINK, ADMIN_LINK, NAV_GROUPS, allSections, isLinkActive, type NavLink } from "./navConfig";

interface NavbarProps {
  username: string;
  teamName: string;
  isAdmin: boolean;
  logoUrl?: string | null;
  latestResultsMatchday?: number;
}

function TopLink({ l, path }: { l: NavLink; path: string }) {
  return (
    <Link
      href={l.href}
      className={`relative px-2.5 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
        isLinkActive(path, l.href) ? "bg-white text-green-700" : "hover:bg-green-600 text-white"
      }`}
    >
      {l.label}
    </Link>
  );
}

const SEEN_KEY = "ipa-last-seen-matchday";

export default function Navbar({
  username,
  teamName,
  isAdmin,
  logoUrl,
  latestResultsMatchday = 0,
}: NavbarProps) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [hasNewResults, setHasNewResults] = useState(false);

  // Notification badge logic
  useEffect(() => {
    try {
      const lastSeen = Number(localStorage.getItem(SEEN_KEY) ?? "0");
      if (latestResultsMatchday > lastSeen) {
        setHasNewResults(true);
      }
    } catch {}
  }, [latestResultsMatchday]);

  // Mark as seen when visiting relevant pages
  useEffect(() => {
    if (path === "/standings" || path === "/dashboard" || path === "/calendar") {
      try {
        localStorage.setItem(SEEN_KEY, String(latestResultsMatchday));
        setHasNewResults(false);
      } catch {}
    }
  }, [path, latestResultsMatchday]);

  // Tendina aperta nella barra desktop (una alla volta). Si chiude cambiando
  // pagina, cliccando fuori o premendo Esc.
  const [openGroupOnPath, setOpenGroupOnPath] = useState<{ label: string; path: string } | null>(null);
  const openGroup = openGroupOnPath && openGroupOnPath.path === path ? openGroupOnPath.label : null;
  const desktopNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openGroup) return;
    const onClick = (e: MouseEvent) => {
      if (desktopNavRef.current && !desktopNavRef.current.contains(e.target as Node)) setOpenGroupOnPath(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenGroupOnPath(null);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openGroup]);

  const sections = allSections(isAdmin);
  const showBadgeFor = (l: NavLink) => Boolean(l.badge && hasNewResults);

  const initials = teamName.slice(0, 2).toUpperCase();

  const Avatar = ({ size = "sm" }: { size?: "sm" | "md" }) => {
    const cls = size === "md" ? "w-9 h-9 text-sm" : "w-8 h-8 text-xs";
    if (logoUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={teamName}
          className={`${cls} rounded-full object-cover border-2 border-green-400 shrink-0`}
          loading="lazy"
          decoding="async"
        />
      );
    }
    return (
      <div
        className={`${cls} rounded-full bg-green-500 border-2 border-green-400 flex items-center justify-center font-bold shrink-0`}
      >
        {initials}
      </div>
    );
  };

  return (
    <nav className="bg-green-700 text-white shadow-md relative z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0 group">
          {/* Mini banner as circular icon */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/league-banner.png"
            alt="IPA"
            className="w-9 h-9 rounded-full object-cover object-center border-2 border-white/30 shadow-md group-hover:border-white/60 transition-all"
          />
          <div className="flex flex-col leading-none">
            <span className="text-base font-extrabold tracking-wide">IPA</span>
            <span className="text-green-200 text-[10px] font-medium hidden sm:block">Premier League</span>
          </div>
        </Link>

        {/* Desktop: voci singole + gruppi a tendina */}
        <div ref={desktopNavRef} className="hidden xl:flex items-center gap-1 flex-1 min-w-0 justify-center">
          <TopLink l={HOME_LINK} path={path} />
          {NAV_GROUPS.map((g) => {
            const groupActive = g.links.some((l) => isLinkActive(path, l.href));
            const groupBadge = g.links.some(showBadgeFor);
            const isOpen = openGroup === g.label;
            return (
              <div key={g.label} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGroupOnPath(isOpen ? null : { label: g.label, path })}
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                  className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                    groupActive ? "bg-white text-green-700" : isOpen ? "bg-green-600 text-white" : "hover:bg-green-600 text-white"
                  }`}
                >
                  {g.label}
                  <span className={`text-[10px] transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                  {groupBadge && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
                {isOpen && (
                  <div role="menu" className="absolute left-0 top-full mt-1 min-w-[200px] bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[120]">
                    {g.links.map((l) => {
                      const active = isLinkActive(path, l.href);
                      return (
                        <Link
                          key={l.href}
                          href={l.href}
                          role="menuitem"
                          onClick={() => setOpenGroupOnPath(null)}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                            active ? "bg-green-50 text-green-800 font-semibold" : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <span className="w-5 text-center">{l.icon}</span>
                          {l.label}
                          {showBadgeFor(l) && <span className="ml-auto w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <TopLink l={RULES_LINK} path={path} />
          {isAdmin && <TopLink l={ADMIN_LINK} path={path} />}
        </div>

        {/* Right: theme toggle + avatar + user info (hidden at xl, shown at 2xl) + logout */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <Avatar size="sm" />
          <div className="hidden 2xl:flex flex-col leading-tight">
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
              className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium transition-colors"
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
          <div className="px-3 py-2 space-y-2">
            {sections.map((section) => (
              <div key={section.title}>
                <p className="px-3 pt-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-300">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isLinkActive(path, l.href)
                          ? "bg-white text-green-800"
                          : "hover:bg-green-700 text-white"
                      }`}
                    >
                      <span className="text-base w-6 text-center">{l.icon}</span>
                      {l.label}
                      {showBadgeFor(l) && (
                        <span className="ml-auto w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-green-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar size="md" />
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
