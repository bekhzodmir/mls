import {
  ALL_ACTORS,
  canAccess,
  scopeFor,
  whoCanGrant,
  type AccessAction,
  type Actor,
  type DenialReason,
  type PermissionArea,
  type PermissionCell,
  type RecordAccess,
  type RecordOwnership,
  type Scope,
} from "@/lib/domain/permissions";
import type { AuditScope } from "@/lib/data/views";

/**
 * The permission matrix (§19) applied to the team, routing, partners and
 * audit screens, with everything a refusal has to say (§19 last paragraph,
 * §23.5, §36.6): which access is needed, who holds it by role, who can grant
 * or change it, and whether the actor could grant it themselves.
 *
 * Readings where §19 has no row are named next to the check that uses them.
 */

export interface AccessExplanation {
  area: PermissionArea;
  actor: Actor;
  /** The relation the refused record has to the actor. */
  ownership: RecordOwnership;
  action: AccessAction;
  reason: DenialReason;
  /** Organization roles that hold this access by role alone (from `canAccess`). */
  holders: Actor[];
  /** Who can issue the explicit permission; only for `permission_required`. */
  granters: Actor[];
  /** Who changes roles and permissions in the organization (§5.4–5.5). */
  roleManagers: Actor[];
  /** The actor's own role can issue the grant (the grant itself is audited). */
  selfCanGrant: boolean;
}

export type AccessCheck = { ok: true; audited: boolean } | { ok: false; explanation: AccessExplanation };

/** Agency Owner and Agency Administrator: the roles that edit roles and permissions organization-wide. */
export function roleManagers(): Actor[] {
  return whoCanGrant("roles_permissions");
}

/** `canAccess` plus the explanation a screen shows instead of hiding the action. */
export function checkAccess(
  actor: Actor,
  area: PermissionArea,
  record: RecordAccess,
  action: AccessAction = "read",
): AccessCheck {
  const decision = canAccess(actor, area, record, action);
  if (decision.ok) return { ok: true, audited: decision.audited };
  const granters = decision.reason === "permission_required" ? whoCanGrant(area) : [];
  return {
    ok: false,
    explanation: {
      area,
      actor,
      ownership: record.ownership,
      action,
      reason: decision.reason,
      holders: decision.requiredRoles,
      granters,
      roleManagers: roleManagers(),
      selfCanGrant: granters.includes(actor),
    },
  };
}

/* ------------------------------------------------------------ the team */

/** A colleague's relation to the viewer for record-level checks. */
export function memberOwnership(member: { isViewer: boolean; inViewerTeam: boolean }): RecordOwnership {
  if (member.isViewer) return "own";
  return member.inViewerTeam ? "team" : "agency";
}

/**
 * A member's metrics, workload and remaining capacity are reports (§19
 * "Reports": agent Own, team lead Team, owner Agency). Availability is not:
 * it is team activity every colleague needs to plan around (§5.2), so the
 * screens show it to everyone in the organization.
 */
export function metricsCheck(actor: Actor, ownership: RecordOwnership): AccessCheck {
  return checkAccess(actor, "reports", { ownership });
}

/**
 * Assigning or reassigning a lead of the team queue (§14.2, §36.5): editing
 * "Team leads" for a team record. Unassigned leads wait in the team's queue,
 * so they are read as `team` records.
 */
export function assignCheck(actor: Actor): AccessCheck {
  return checkAccess(actor, "team_leads", { ownership: "team" }, "edit");
}

/**
 * Changing routing rules has no §19 row. It is read as either distributing
 * the team's leads ("Team leads" edit: team lead, owner) or a CRM setting of
 * the organization (§5.5; "Roles/permissions" edit across the agency: owner,
 * administrator). A refusal names the holders of both.
 */
export function routingEditCheck(actor: Actor): AccessCheck {
  const distribute = assignCheck(actor);
  if (distribute.ok) return distribute;
  const settings = checkAccess(actor, "roles_permissions", { ownership: "agency" }, "edit");
  if (settings.ok) return settings;
  const holders = new Set([...distribute.explanation.holders, ...settings.explanation.holders]);
  return {
    ok: false,
    explanation: { ...distribute.explanation, holders: ALL_ACTORS.filter((role) => holders.has(role)) },
  };
}

/* ------------------------------------------------------------- partners */

/** Partner profiles are the professional (MLS) area: published and shared records (§5.6, §15). */
export function partnersCheck(actor: Actor): AccessCheck {
  return checkAccess(actor, "mls_search", { ownership: "published" });
}

/**
 * Starting a cooperation request of one's own (§15.3). An agency agent's
 * cell is "Allowed" — only when the agency allows it; the demo agency does
 * (the viewer's accepted requests in the seed are that permission in use),
 * so the grant is taken as on file. Roles with no cooperation cell (agency
 * administrator) stay refused whatever is granted.
 */
export function cooperationCheck(actor: Actor): AccessCheck {
  return checkAccess(actor, "cooperation", { ownership: "own", grantedPermission: true });
}

/* ---------------------------------------------------------------- audit */

export const AUDIT_SCOPES = ["own", "team", "agency"] as const satisfies readonly AuditScope[];

/** §19 "Audit": agent Own history, team lead Team, owner Agency, administrator and compliance Full org. */
export function auditCheck(actor: Actor, scope: AuditScope): AccessCheck {
  return checkAccess(actor, "audit", { ownership: scope });
}

/** The audit levels the actor may read, narrowest first. */
export function auditReach(actor: Actor): AuditScope[] {
  return AUDIT_SCOPES.filter((scope) => auditCheck(actor, scope).ok);
}

/**
 * Exporting the journal has no §19 cell: export controls (§18.1) and
 * "permission and export audit" (§39.3) make it a separate permission that
 * nobody holds by role. It is issued by the role managers, and every export
 * is itself written to the journal with its purpose.
 */
export function exportCheck(actor: Actor): { ok: false; explanation: AccessExplanation } {
  const granters = roleManagers();
  return {
    ok: false,
    explanation: {
      area: "audit",
      actor,
      ownership: auditReach(actor).at(-1) ?? "own",
      action: "read",
      reason: "permission_required",
      holders: [],
      granters,
      roleManagers: granters,
      selfCanGrant: granters.includes(actor),
    },
  };
}

/* ---------------------------------------------------------------- level */

export interface LevelParts {
  scopes: Scope[];
  /** "Approved", "Authorized": every access needs a grant. */
  byGrant: boolean;
  /** "Read/allowed edit", "Limited": changes need a grant. */
  editByGrant: boolean;
}

/** The actor's own §19 cell for an area, as parts a screen can label: "только свои записи". */
export function levelOf(actor: Actor, area: PermissionArea): LevelParts {
  const cell: PermissionCell = scopeFor(actor, area);
  return {
    scopes: [...cell.scopes],
    byGrant: cell.requiresGrant === true,
    editByGrant: cell.editRequiresGrant === true,
  };
}
