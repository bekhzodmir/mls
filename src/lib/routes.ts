/**
 * Workspace URLs. Kept free of the navigation config (which pulls in icon
 * components), so client components and pure helpers can build links without
 * bundling it. Every workspace path is relative to `/{locale}/app`.
 */

/** Named workspace destinations used by the chrome, the "+" menu and the More page. */
export const appRoutes = {
  today: "",
  search: "/search",
  notifications: "/notifications",
  tasks: "/tasks",
  more: "/more",
  calls: "/calls",
  leads: "/leads",
  clients: "/clients",
  owners: "/owners",
  ownersNew: "/owners/new",
  requirementsNew: "/requirements/new",
  properties: "/properties",
  propertiesNew: "/properties/new",
  matches: "/matches",
  radar: "/radar",
  mls: "/mls",
  cooperation: "/mls/cooperation",
  partners: "/partners",
  viewings: "/viewings",
  viewingsNew: "/viewings/new",
  offers: "/offers",
  deals: "/deals",
  contracts: "/contracts",
  consents: "/consents",
  verification: "/verification",
  verificationRequest: "/verification/request",
  team: "/team",
  teamRouting: "/team/routing",
  audit: "/audit",
  leadsNew: "/leads/new",
  clientsNew: "/clients/new",
  tasksNew: "/tasks/new",
} as const;

export type AppRoute = keyof typeof appRoutes;

/** `/{locale}/app` plus a named route, e.g. `appHref("ru", "clientsNew")`. */
export function appHref(locale: string, route: AppRoute): string {
  return appPath(locale, appRoutes[route]);
}

/**
 * `/{locale}/app` plus any workspace path, e.g. `appPath("ru", "/deals/deal-01")`.
 * The path starts with "/" (or is empty for Today) and is already encoded.
 */
export function appPath(locale: string, path: string): string {
  return `/${locale}/app${path}`;
}

/** Public account pages outside the workspace: sign-in and first-run onboarding. */
export const authRoutes = {
  login: "/login",
  onboarding: "/onboarding",
} as const;

export type AuthRoute = keyof typeof authRoutes;

/** `/{locale}/login` or `/{locale}/onboarding` — not under `/app`. */
export function authHref(locale: string, route: AuthRoute): string {
  return `/${locale}${authRoutes[route]}`;
}
