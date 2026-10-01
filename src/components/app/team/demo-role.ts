import type { Actor } from "@/lib/domain/permissions";
import type { UserRole } from "@/lib/domain/types";

/**
 * Demo preview of the management screens (§5.3–5.5, §19) with another
 * role's rights: `?demoRole=team_lead|agency_owner|agency_admin`.
 *
 * - Only the team, routing, partners and audit screens read it; links that
 *   leave them never carry it, so the preview cannot leak into other screens.
 * - The data stays the signed-in viewer's (agent-01's team, history and
 *   partners): only what the permission matrix lets the role see and do
 *   changes. A banner on every previewed page says so.
 * - Anything else in the parameter is ignored and the real role applies.
 */

export const DEMO_ROLES = ["team_lead", "agency_owner", "agency_admin"] as const satisfies readonly UserRole[];
export type DemoRole = (typeof DEMO_ROLES)[number];

export const DEMO_ROLE_PARAM = "demoRole";

type Param = string | string[] | undefined;

/** The previewed role when the value is one of `DEMO_ROLES`, otherwise undefined. */
export function parseDemoRole(value: Param): DemoRole | undefined {
  const first = (Array.isArray(value) ? value[0] : value)?.trim();
  return first !== undefined && (DEMO_ROLES as readonly string[]).includes(first) ? (first as DemoRole) : undefined;
}

/** The role the permission matrix is applied for: the preview, else the account's own role. */
export function actingRole(viewerRole: UserRole, demoRole?: DemoRole): Actor {
  return demoRole ?? viewerRole;
}

/**
 * The href with `demoRole` set (or removed when undefined), keeping every
 * other parameter and the fragment: `/ru/app/team?x=1#a` → `/ru/app/team?x=1&demoRole=team_lead#a`.
 */
export function withDemoRole(href: string, demoRole?: DemoRole): string {
  const hashAt = href.indexOf("#");
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const queryAt = beforeHash.indexOf("?");
  const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  const query = new URLSearchParams(queryAt === -1 ? "" : beforeHash.slice(queryAt + 1));
  query.delete(DEMO_ROLE_PARAM);
  if (demoRole) query.set(DEMO_ROLE_PARAM, demoRole);
  const search = query.toString();
  return `${path}${search ? `?${search}` : ""}${hash}`;
}
