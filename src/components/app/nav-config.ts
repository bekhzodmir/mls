import {
  Bell,
  Briefcase,
  CalendarCheck,
  Handshake,
  Home,
  Inbox,
  LayoutGrid,
  ListTodo,
  Network,
  Radar,
  Search,
  Sparkles,
  Users,
  Building,
  type LucideIcon,
} from "lucide-react";

/*
 * Navigation for the workspace chrome. Paths are relative to `/{locale}/app`;
 * build full URLs with `appHref` / `appPath` from `@/lib/routes`, which stays
 * free of these icon imports.
 */

/** Bottom navigation (§9.1): Главная | CRM | Поиск | MLS | Ещё. */
export const bottomNav: {
  key: "today" | "crm" | "search" | "mls" | "more";
  href: string;
  icon: LucideIcon;
  /** Path prefixes (after /{locale}/app) that mark the tab as current. */
  match: string[];
}[] = [
  { key: "today", href: "", icon: Home, match: ["", "/tasks", "/notifications"] },
  {
    key: "crm",
    href: "/clients",
    icon: Users,
    match: ["/leads", "/clients", "/requirements", "/properties", "/viewings", "/deals"],
  },
  { key: "search", href: "/search", icon: Search, match: ["/search", "/matches", "/radar"] },
  { key: "mls", href: "/mls", icon: Network, match: ["/mls"] },
  { key: "more", href: "/more", icon: LayoutGrid, match: ["/more"] },
];

/** Desktop sidebar: the same destinations, flattened. */
export const sidebarNav: {
  key:
    | "today"
    | "leads"
    | "clients"
    | "properties"
    | "matches"
    | "radar"
    | "mls"
    | "cooperation"
    | "viewings"
    | "deals"
    | "tasks"
    | "notifications"
    | "search";
  href: string;
  icon: LucideIcon;
}[] = [
  { key: "today", href: "", icon: Home },
  { key: "search", href: "/search", icon: Search },
  { key: "leads", href: "/leads", icon: Inbox },
  { key: "clients", href: "/clients", icon: Users },
  { key: "properties", href: "/properties", icon: Building },
  { key: "matches", href: "/matches", icon: Sparkles },
  { key: "radar", href: "/radar", icon: Radar },
  { key: "mls", href: "/mls", icon: Network },
  { key: "cooperation", href: "/mls/cooperation", icon: Handshake },
  { key: "viewings", href: "/viewings", icon: CalendarCheck },
  { key: "deals", href: "/deals", icon: Briefcase },
  { key: "tasks", href: "/tasks", icon: ListTodo },
  { key: "notifications", href: "/notifications", icon: Bell },
];

/** Returns true if `pathname` (full path) is inside `/{locale}/app{prefix}`. */
export function isActive(pathname: string, locale: string, prefix: string, exact = false): boolean {
  const base = `/${locale}/app${prefix}`;
  if (prefix === "" || exact) return pathname === base || pathname === `${base}/`;
  return pathname === base || pathname.startsWith(`${base}/`);
}
