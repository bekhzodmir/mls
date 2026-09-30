/**
 * Workspace URLs. Kept free of the navigation config (which pulls in icon
 * components), so client components and pure helpers can build links without
 * bundling it. Every workspace path is relative to `/{locale}/app`.
 */

/** Named workspace destinations used by the chrome and the "+" menu. */
export const appRoutes = {
  today: "",
  search: "/search",
  notifications: "/notifications",
  tasks: "/tasks",
  more: "/more",
  leads: "/leads",
  clients: "/clients",
  requirementsNew: "/requirements/new",
  properties: "/properties",
  propertiesNew: "/properties/new",
  matches: "/matches",
  radar: "/radar",
  mls: "/mls",
  cooperation: "/mls/cooperation",
  viewings: "/viewings",
  viewingsNew: "/viewings/new",
  deals: "/deals",
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
