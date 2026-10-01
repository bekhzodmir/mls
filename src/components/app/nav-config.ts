import {
  Bell,
  Briefcase,
  Building,
  CalendarCheck,
  ClipboardCheck,
  Contact,
  FilePen,
  HandCoins,
  Handshake,
  History,
  Home,
  Inbox,
  KeyRound,
  LayoutGrid,
  ListTodo,
  Network,
  PhoneCall,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { appRoutes } from "@/lib/routes";

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
  { key: "today", href: appRoutes.today, icon: Home, match: ["", "/tasks", "/notifications", "/calls"] },
  {
    key: "crm",
    href: appRoutes.clients,
    icon: Users,
    match: [
      "/leads",
      "/clients",
      "/owners",
      "/requirements",
      "/properties",
      "/viewings",
      "/offers",
      "/deals",
      "/contracts",
      "/consents",
      "/verification",
    ],
  },
  { key: "search", href: appRoutes.search, icon: Search, match: ["/search", "/matches", "/radar"] },
  { key: "mls", href: appRoutes.mls, icon: Network, match: ["/mls", "/partners"] },
  { key: "more", href: appRoutes.more, icon: LayoutGrid, match: ["/more", "/team", "/audit"] },
];

export type SidebarKey =
  | "today"
  | "search"
  | "tasks"
  | "notifications"
  | "calls"
  | "leads"
  | "clients"
  | "owners"
  | "properties"
  | "viewings"
  | "matches"
  | "radar"
  | "offers"
  | "deals"
  | "contracts"
  | "consents"
  | "verification"
  | "mls"
  | "cooperation"
  | "partners"
  | "team"
  | "audit";

export interface SidebarItem {
  key: SidebarKey;
  href: string;
  icon: LucideIcon;
}

/** Labelled sidebar sections; headings live in `shell.sidebarGroups`. */
export type SidebarGroupKey = "work" | "crm" | "deals" | "network" | "manage";

/**
 * Desktop sidebar, grouped so two dozen destinations stay scannable:
 * daily work, CRM records, deals and documents, the professional network,
 * and management.
 */
export const sidebarGroups: { key: SidebarGroupKey; items: SidebarItem[] }[] = [
  {
    key: "work",
    items: [
      { key: "today", href: appRoutes.today, icon: Home },
      { key: "search", href: appRoutes.search, icon: Search },
      { key: "tasks", href: appRoutes.tasks, icon: ListTodo },
      { key: "notifications", href: appRoutes.notifications, icon: Bell },
      { key: "calls", href: appRoutes.calls, icon: PhoneCall },
    ],
  },
  {
    key: "crm",
    items: [
      { key: "leads", href: appRoutes.leads, icon: Inbox },
      { key: "clients", href: appRoutes.clients, icon: Users },
      { key: "owners", href: appRoutes.owners, icon: KeyRound },
      { key: "properties", href: appRoutes.properties, icon: Building },
      { key: "viewings", href: appRoutes.viewings, icon: CalendarCheck },
      { key: "matches", href: appRoutes.matches, icon: Sparkles },
      { key: "radar", href: appRoutes.radar, icon: Radar },
    ],
  },
  {
    key: "deals",
    items: [
      { key: "offers", href: appRoutes.offers, icon: HandCoins },
      { key: "deals", href: appRoutes.deals, icon: Briefcase },
      { key: "contracts", href: appRoutes.contracts, icon: FilePen },
      { key: "consents", href: appRoutes.consents, icon: ClipboardCheck },
      { key: "verification", href: appRoutes.verification, icon: ShieldCheck },
    ],
  },
  {
    key: "network",
    items: [
      { key: "mls", href: appRoutes.mls, icon: Network },
      { key: "cooperation", href: appRoutes.cooperation, icon: Handshake },
      { key: "partners", href: appRoutes.partners, icon: Contact },
    ],
  },
  {
    key: "manage",
    items: [
      { key: "team", href: appRoutes.team, icon: UsersRound },
      { key: "audit", href: appRoutes.audit, icon: History },
    ],
  },
];

/** Every sidebar destination, flattened in display order. */
export const sidebarNav: SidebarItem[] = sidebarGroups.flatMap((group) => group.items);

/** Returns true if `pathname` (full path) is inside `/{locale}/app{prefix}`. */
export function isActive(pathname: string, locale: string, prefix: string, exact = false): boolean {
  const base = `/${locale}/app${prefix}`;
  if (prefix === "" || exact) return pathname === base || pathname === `${base}/`;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * The sidebar entry for `pathname`: the one with the longest matching
 * prefix, so "/mls/cooperation" lights up Cooperation rather than MLS, while
 * "/team/routing" still lights up Team. Today matches its exact path only.
 */
export function activeSidebarKey(pathname: string, locale: string): SidebarKey | undefined {
  let best: SidebarItem | undefined;
  for (const item of sidebarNav) {
    if (!isActive(pathname, locale, item.href, item.href === "")) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best?.key;
}
