import {
  canAccess,
  whoCanGrant,
  type Actor,
  type DenialReason,
  type PermissionArea,
  type RecordOwnership,
} from "@/lib/domain/permissions";

/**
 * What a "permission-limited" state says (§19 last paragraph, §23.5): which
 * right is missing, who can grant it and whom to turn to. The repository
 * decides what is visible; this only explains a refusal with the §19 matrix,
 * so the wording never contradicts the rules the data layer applies.
 */

/** The areas these screens explain. */
export type ExplainedArea = Extract<PermissionArea, "sensitive_owner_data" | "verification">;

export interface AccessExplanation {
  ok: boolean;
  reason?: DenialReason;
  /** Organization roles that hold the access by role alone: whom to ask to act. */
  holders: Actor[];
  /** Roles that can issue the grant the area relies on. */
  grantors: Actor[];
}

export function explainAccess(actor: Actor, area: ExplainedArea, ownership: RecordOwnership): AccessExplanation {
  const decision = canAccess(actor, area, { ownership });
  if (decision.ok) return { ok: true, holders: [], grantors: [] };
  return {
    ok: false,
    reason: decision.reason,
    holders: decision.requiredRoles,
    // An organization grant only helps when the denial is about a missing permission.
    grantors: decision.reason === "permission_required" ? whoCanGrant(area) : [],
  };
}
