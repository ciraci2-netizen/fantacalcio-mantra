// Configurazione unica dei menu: barra desktop (Navbar), menu ☰ da
// telefono/tablet e pannello "Altro" della barra in basso (BottomNav)
// leggono tutti da qui, cosi le voci restano sempre allineate.

export type NavLink = {
  href: string;
  label: string;
  icon: string;
  /** Pallino rosso "nuovi risultati" (vedi Navbar) */
  badge?: boolean;
};

export type NavGroup = {
  label: string;
  icon: string;
  links: NavLink[];
};

/** Voci singole, sempre visibili nella barra desktop */
export const HOME_LINK: NavLink = { href: "/dashboard", label: "Dashboard", icon: "🏠" };
export const RULES_LINK: NavLink = { href: "/regolamento", label: "Regolamento", icon: "📖" };
export const ADMIN_LINK: NavLink = { href: "/admin", label: "Admin", icon: "⚙️" };

/** Gruppi a tendina */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "La mia squadra",
    icon: "👥",
    links: [
      { href: "/team", label: "Rosa", icon: "👥" },
      { href: "/lineup", label: "Formazione", icon: "📋" },
      { href: "/lineup/history", label: "Storico formazioni", icon: "🗂️" },
      { href: "/profile", label: "Profilo", icon: "👤" },
    ],
  },
  {
    label: "Lega",
    icon: "🏆",
    links: [
      { href: "/standings", label: "Classifica", icon: "🏆", badge: true },
      { href: "/calendar", label: "Calendario", icon: "📅" },
      { href: "/coppe", label: "Coppe", icon: "🏅" },
      { href: "/squadre", label: "Squadre", icon: "🔍" },
      { href: "/stats", label: "Statistiche", icon: "📊" },
      { href: "/bacheca", label: "Bacheca", icon: "💬" },
    ],
  },
  {
    label: "Mercato",
    icon: "🔄",
    links: [
      { href: "/svincolati", label: "Svincolati", icon: "🆓" },
      { href: "/mercato", label: "Mercato", icon: "🔄" },
      { href: "/asta", label: "Buste", icon: "\u{1F528}" },
      { href: "/scambi", label: "Scambi", icon: "🤝" },
    ],
  },
];

/**
 * Link attivo: corrispondenza esatta, oppure sotto-pagina - ma senza far
 * risultare attivo "/lineup" quando si e' su "/lineup/history", che ha la
 * sua voce dedicata.
 */
export function isLinkActive(path: string, href: string): boolean {
  if (path === href) return true;
  if (!path.startsWith(href + "/")) return false;
  const allHrefs = [HOME_LINK, RULES_LINK, ADMIN_LINK, ...NAV_GROUPS.flatMap((g) => g.links)].map((l) => l.href);
  // Se esiste una voce piu specifica che combacia, quella vince
  return !allHrefs.some((h) => h !== href && h.startsWith(href + "/") && (path === h || path.startsWith(h + "/")));
}

/** Tutte le sezioni, per il pannello "Altro" e il menu ☰ */
export function allSections(isAdmin: boolean): { title: string; links: NavLink[] }[] {
  return [
    { title: "Generale", links: [HOME_LINK, RULES_LINK] },
    ...NAV_GROUPS.map((g) => ({ title: g.label, links: g.links })),
    ...(isAdmin ? [{ title: "Amministrazione", links: [ADMIN_LINK] }] : []),
  ];
}
