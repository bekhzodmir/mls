import type { UserRole } from "./types";

/**
 * Role / permission matrix (§19) as data, plus the checks the UI uses to
 * explain a refusal: which access is needed, who can grant it and which safe
 * step is still available (§19 last paragraph, §23.5, §36.6 "Permission
 * denied") — never a bare 403 (§5.7).
 *
 * - Every §19 cell is kept verbatim in `text`, next to a typed reading of it
 *   (`scopes` + flags), so the original meaning stays recoverable.
 * - A record's `ownership` is the requester's closest relation to it:
 *   own > assigned > team > agency > shared > published > other_agency.
 * - Least privilege (§18.1): a cell grants nothing it does not name. Where §19
 *   is silent (agency admin, compliance) the column is derived conservatively
 *   from §5.5 / §5.7 and marked with that `source`.
 *
 * Pure data and pure functions. Writing the audit event an access requires
 * (`audited: true`) is the caller's job.
 */

/* ---------------------------------------------------------------- areas */

/** One per §19 row, in table order. */
export const ALL_AREAS = [
  "own_leads_clients",
  "team_leads",
  "own_properties",
  "agency_base",
  "sensitive_owner_data",
  "verification",
  "mls_search",
  "cooperation",
  "deals",
  "reports",
  "roles_permissions",
  "audit",
] as const;
export type PermissionArea = (typeof ALL_AREAS)[number];

/**
 * Every UserRole plus `partner`: an external professional working with this
 * organization's records through the MLS (§5.6). It is a relation, not an
 * account type — an individual realtor viewing another agency's shared record
 * acts as a partner there.
 */
export type Actor = UserRole | "partner";

/** §19 column order first, then the roles §19 has no column for. */
export const ALL_ACTORS = [
  "individual_realtor",
  "agency_agent",
  "team_lead",
  "agency_owner",
  "binor_admin",
  "partner",
  "agency_admin",
  "compliance",
] as const satisfies readonly Actor[];

/** Staff of one organization: the people a denied colleague can turn to. */
const ORGANIZATION_ROLES: readonly Actor[] = [
  "agency_agent",
  "team_lead",
  "agency_owner",
  "agency_admin",
  "compliance",
];

/* --------------------------------------------------------------- scopes */

/** The requester's relation to a record (see the ordering note above). */
export type RecordOwnership =
  | "own"
  | "assigned"
  | "team"
  | "agency"
  | "other_agency"
  | "published"
  | "shared";

export const ALL_OWNERSHIPS: readonly RecordOwnership[] = [
  "own",
  "assigned",
  "team",
  "agency",
  "shared",
  "published",
  "other_agency",
];

/** Typed reading of a §19 cell; a cell may combine several ("Own/assigned"). */
export type Scope =
  | "none"
  | "own"
  | "assigned"
  | "team"
  | "agency"
  | "all"
  | "published"
  | "shared"
  | "participating"
  | "result_only"
  | "permission"
  | "limited"
  | "professional"
  | "moderation";

export type AccessAction = "read" | "edit";

const ORGANIZATION: readonly RecordOwnership[] = ["own", "assigned", "team", "agency"];
const EVERYTHING: readonly RecordOwnership[] = ALL_OWNERSHIPS;

/**
 * Which records each scope reaches, per action. Wider organization scopes
 * include the narrower ones (Team ⊃ own + assigned). Records of another party
 * — published, shared, the other side of a deal — can be seen but not edited
 * here; changes to them go through cooperation (§15.3, §18.2).
 */
export const SCOPE_REACH: Readonly<Record<Scope, Readonly<Record<AccessAction, readonly RecordOwnership[]>>>> = {
  none: { read: [], edit: [] },
  own: { read: ["own"], edit: ["own"] },
  assigned: { read: ["assigned"], edit: ["assigned"] },
  team: { read: ["own", "assigned", "team"], edit: ["own", "assigned", "team"] },
  agency: { read: ORGANIZATION, edit: ORGANIZATION },
  all: { read: EVERYTHING, edit: EVERYTHING },
  // §19 legend "Partner — опубликованная профессиональная область".
  published: { read: ["published"], edit: [] },
  shared: { read: ["shared"], edit: [] },
  // A deal the actor takes part in: their own side is theirs, the other side is visible.
  participating: { read: ["own", "assigned", "shared"], edit: ["own", "assigned"] },
  // Partner sees the outcome of a check on a record offered to them, not the documents.
  result_only: { read: ["shared", "published"], edit: [] },
  // Always behind a grant (see `reachOf`): anything inside the organization, or
  // a record shared with the actor (e.g. contacts disclosed after cooperation).
  permission: { read: [...ORGANIZATION, "shared"], edit: ORGANIZATION },
  // Team lead's view of the team's roles; changes need a grant (cell flag).
  limited: { read: ["own", "assigned", "team"], edit: ["own", "assigned", "team"] },
  // MLS search: the professional area plus one's own organization; edits only one's own.
  professional: { read: [...ORGANIZATION, "shared", "published"], edit: ["own", "assigned"] },
  // Binor oversight: sees everything; "edit" means moderation actions, not acting as a party.
  moderation: { read: EVERYTHING, edit: EVERYTHING },
};

/* ---------------------------------------------------------------- cells */

export interface PermissionCell {
  /** The §19 cell verbatim ("—" = no access); derived cells name their reading. */
  readonly text: string;
  /** "§19" for table cells; "§5.5" / "§5.7" for columns derived from the role description. */
  readonly source: "§19" | "§5.5" | "§5.7";
  readonly scopes: readonly Scope[];
  /**
   * Every access needs an explicit grant: "Approved", "Authorized". ("Permission"
   * and the "/approved", "/allowed" halves use the `permission` scope instead.)
   */
  readonly requiresGrant?: true;
  /** Reading follows the scopes, editing needs a grant: "Read/allowed edit", "Limited". */
  readonly editRequiresGrant?: true;
  /** Every access is written to the audit log: "All audited". */
  readonly requiresAudit?: true;
}

type CellFlags = Pick<PermissionCell, "requiresGrant" | "editRequiresGrant" | "requiresAudit">;

function cell(text: string, scopes: Scope[], flags: CellFlags = {}): PermissionCell {
  return { text, source: "§19", scopes, ...flags };
}

const NONE = cell("—", ["none"]);

/**
 * Agency administrator (§5.5): manages users, roles, branches, permissions,
 * integrations, directories, import/export, CRM settings and audit — not the
 * sales work itself. Hence:
 * - roles/permissions and audit: the whole organization ("Full org");
 * - CRM records, properties, the agency base and reports: only with a grant
 *   (import/export, clean-up), never by default;
 * - sensitive owner data: only with a grant, like an agent;
 * - verification, MLS search, cooperation and deals: none — professional acts
 *   the role does not perform (§38.2: do not hand out professional rights).
 */
const adminCell = (text: string, scopes: Scope[]): PermissionCell => ({ text, source: "§5.5", scopes });
const ADMIN_NONE = adminCell("—", ["none"]);
const ADMIN_BY_GRANT = adminCell("Permission", ["permission"]);
const ADMIN_ORG = adminCell("Full org", ["agency"]);

/**
 * Compliance / authorized employee (§5.7): limited verification functions and
 * legal checks that need the organization's authority. Hence:
 * - verification and audit: the whole organization — holding this role is
 *   the organization's authorization, so no extra grant;
 * - sensitive owner data and deals (documents, AML/CFT checklist, §38.5):
 *   only with a grant;
 * - everything else: none.
 */
const complianceCell = (text: string, scopes: Scope[]): PermissionCell => ({ text, source: "§5.7", scopes });
const COMPLIANCE_NONE = complianceCell("—", ["none"]);
const COMPLIANCE_BY_GRANT = complianceCell("Permission", ["permission"]);
const COMPLIANCE_ORG = complianceCell("Agency", ["agency"]);

/**
 * §19 row by row. Readings worth knowing:
 * - "Own/approved", "Own/allowed": own records directly, others with a grant.
 * - "По назначению", "Assigned": only records assigned to the actor.
 * - "Read/allowed edit": the agency base is readable, edits need a grant.
 * - Agency base, Team Lead "Team": read literally — the team's part of the
 *   base, which is narrower than an agent's read of the whole base. This
 *   looks like an inconsistency in §19; confirm with Product before relying
 *   on it.
 * - "Full", "Full org", "Global": the widest scope of that column — the
 *   organization for an Agency Owner, everything for Admin.
 * - MLS search, Agency Owner "Full": professional area plus edits across the
 *   agency (saved searches, exports), not only one's own.
 * - "Restricted" (partner, sensitive owner data): no access; the minimum
 *   disclosed after an agreed cooperation goes through the cooperation
 *   record (§18.2, `CooperationRequest.disclosure`), not through this area.
 * - "Allowed" (agent, cooperation): only when the agency allows it — a grant.
 * - "Moderation": Binor sees all cooperation and may moderate, not negotiate.
 * - "Own history", "Own interactions": the actor's own audit trail.
 */
export const PERMISSION_MATRIX: Readonly<Record<PermissionArea, Readonly<Record<Actor, PermissionCell>>>> = {
  own_leads_clients: {
    individual_realtor: cell("Own", ["own"]),
    agency_agent: cell("Own/assigned", ["own", "assigned"]),
    team_lead: cell("Team", ["team"]),
    agency_owner: cell("Agency", ["agency"]),
    binor_admin: cell("All", ["all"]),
    partner: cell("Shared only", ["shared"]),
    agency_admin: ADMIN_BY_GRANT,
    compliance: COMPLIANCE_NONE,
  },
  team_leads: {
    individual_realtor: NONE,
    agency_agent: cell("По назначению", ["assigned"]),
    team_lead: cell("Team", ["team"]),
    agency_owner: cell("Agency", ["agency"]),
    binor_admin: cell("All", ["all"]),
    partner: NONE,
    agency_admin: ADMIN_BY_GRANT,
    compliance: COMPLIANCE_NONE,
  },
  own_properties: {
    individual_realtor: cell("Own", ["own"]),
    agency_agent: cell("Own/assigned", ["own", "assigned"]),
    team_lead: cell("Team", ["team"]),
    agency_owner: cell("Agency", ["agency"]),
    binor_admin: cell("All", ["all"]),
    partner: cell("Shared", ["shared"]),
    agency_admin: ADMIN_BY_GRANT,
    compliance: COMPLIANCE_NONE,
  },
  agency_base: {
    individual_realtor: NONE,
    agency_agent: cell("Read/allowed edit", ["agency"], { editRequiresGrant: true }),
    team_lead: cell("Team", ["team"]),
    agency_owner: cell("Full", ["agency"]),
    binor_admin: cell("All", ["all"]),
    partner: cell("Published only", ["published"]),
    agency_admin: ADMIN_BY_GRANT,
    compliance: COMPLIANCE_NONE,
  },
  sensitive_owner_data: {
    individual_realtor: cell("Own/approved", ["own", "permission"]),
    agency_agent: cell("Permission", ["permission"]),
    team_lead: cell("Permission", ["permission"]),
    agency_owner: cell("Approved", ["agency"], { requiresGrant: true }),
    binor_admin: cell("All audited", ["all"], { requiresAudit: true }),
    partner: cell("Restricted", ["none"]),
    agency_admin: ADMIN_BY_GRANT,
    compliance: COMPLIANCE_BY_GRANT,
  },
  verification: {
    individual_realtor: cell("Own/allowed", ["own", "permission"]),
    agency_agent: cell("Permission", ["permission"]),
    team_lead: cell("Permission", ["permission"]),
    agency_owner: cell("Authorized", ["agency"], { requiresGrant: true }),
    binor_admin: cell("All", ["all"]),
    partner: cell("Result only", ["result_only"]),
    agency_admin: ADMIN_NONE,
    compliance: COMPLIANCE_ORG,
  },
  mls_search: {
    individual_realtor: cell("Professional", ["professional"]),
    agency_agent: cell("Professional", ["professional"]),
    team_lead: cell("Professional", ["professional"]),
    agency_owner: cell("Full", ["professional", "agency"]),
    binor_admin: cell("All", ["all"]),
    partner: cell("Professional", ["professional"]),
    agency_admin: ADMIN_NONE,
    compliance: COMPLIANCE_NONE,
  },
  cooperation: {
    individual_realtor: cell("Full own", ["own"]),
    agency_agent: cell("Allowed", ["permission"]),
    team_lead: cell("Team", ["team"]),
    agency_owner: cell("Agency", ["agency"]),
    binor_admin: cell("Moderation", ["moderation"]),
    partner: cell("Own requests", ["own"]),
    agency_admin: ADMIN_NONE,
    compliance: COMPLIANCE_NONE,
  },
  deals: {
    individual_realtor: cell("Own", ["own"]),
    agency_agent: cell("Assigned", ["assigned"]),
    team_lead: cell("Team", ["team"]),
    agency_owner: cell("Agency", ["agency"]),
    binor_admin: cell("All", ["all"]),
    partner: cell("Participating", ["participating"]),
    agency_admin: ADMIN_NONE,
    compliance: COMPLIANCE_BY_GRANT,
  },
  reports: {
    individual_realtor: cell("Own", ["own"]),
    agency_agent: cell("Own", ["own"]),
    team_lead: cell("Team", ["team"]),
    agency_owner: cell("Agency", ["agency"]),
    binor_admin: cell("Global", ["all"]),
    partner: NONE,
    agency_admin: ADMIN_BY_GRANT,
    compliance: COMPLIANCE_NONE,
  },
  roles_permissions: {
    individual_realtor: NONE,
    agency_agent: NONE,
    team_lead: cell("Limited", ["limited"], { editRequiresGrant: true }),
    agency_owner: cell("Full org", ["agency"]),
    binor_admin: cell("All", ["all"]),
    partner: NONE,
    agency_admin: ADMIN_ORG,
    compliance: COMPLIANCE_NONE,
  },
  audit: {
    individual_realtor: cell("Own history", ["own"]),
    agency_agent: cell("Own history", ["own"]),
    team_lead: cell("Team", ["team"]),
    agency_owner: cell("Agency", ["agency"]),
    binor_admin: cell("Full", ["all"]),
    partner: cell("Own interactions", ["own"]),
    agency_admin: ADMIN_ORG,
    compliance: COMPLIANCE_ORG,
  },
};

/**
 * Access that is always logged, whatever the role: viewing or exporting
 * sensitive data and changing rights (§38.6 p.7, §18.1). "All audited" adds
 * Binor admin's access on top via the cell flag.
 */
const AUDITED_ACCESS: Partial<Record<PermissionArea, readonly AccessAction[]>> = {
  sensitive_owner_data: ["read", "edit"],
  roles_permissions: ["edit"],
};

/** The audit trail is append-only: nobody edits history (§17.6, §36.5). */
const READ_ONLY_AREAS: ReadonlySet<PermissionArea> = new Set<PermissionArea>(["audit"]);

/* --------------------------------------------------------------- checks */

/** The §19 cell for an actor and area, with its typed reading. */
export function scopeFor(actor: Actor, area: PermissionArea): PermissionCell {
  return PERMISSION_MATRIX[area][actor];
}

interface Reach {
  /** Reachable by role alone. */
  direct: ReadonlySet<RecordOwnership>;
  /** Reachable only with an explicit grant. */
  granted: ReadonlySet<RecordOwnership>;
}

function reachOf(area: PermissionArea, cell: PermissionCell, action: AccessAction): Reach {
  const direct = new Set<RecordOwnership>();
  const granted = new Set<RecordOwnership>();
  if (action === "edit" && READ_ONLY_AREAS.has(area)) return { direct, granted };
  for (const scope of cell.scopes) {
    const viaGrant =
      scope === "permission" || cell.requiresGrant === true || (action === "edit" && cell.editRequiresGrant === true);
    for (const ownership of SCOPE_REACH[scope][action]) (viaGrant ? granted : direct).add(ownership);
  }
  // "Own/approved": own records never wait for an approval.
  for (const ownership of direct) granted.delete(ownership);
  return { direct, granted };
}

/**
 * Why access was refused; the UI turns each into "what is needed / who can
 * grant it / what you can do now" (§23.5):
 * - `no_access` — the role has no access to this area at all ("—").
 * - `out_of_scope` — the area is open to the role, but not this record
 *   (another team, not assigned…): ask one of `requiredRoles` to reassign or share.
 * - `other_organization` — another organization's record that is neither
 *   published nor shared (§18.1): the safe step is a cooperation request.
 * - `permission_required` — reachable only with an explicit permission
 *   ("Permission", "Approved", "Authorized", "allowed"): request it from
 *   `whoCanGrant(area)`.
 * - `read_only` — reading is allowed, editing is not (results only, a
 *   publication of another party, the append-only audit trail).
 */
export type DenialReason = "no_access" | "out_of_scope" | "other_organization" | "permission_required" | "read_only";

export interface RecordAccess {
  ownership: RecordOwnership;
  /** An explicit grant for this record / action is on file. */
  grantedPermission?: boolean;
}

export type AccessDecision =
  | {
      ok: true;
      /** The caller must write an audit event for this access (§38.6 p.7). */
      audited: boolean;
    }
  | {
      ok: false;
      reason: DenialReason;
      /**
       * Staff roles of the requester's organization that hold this access to
       * such a record by role alone — whom to ask or hand over to. Never Binor
       * admin (system role, §5.8) or an external partner; empty for an
       * individual realtor or a partner, who have no organization roles to
       * turn to.
       */
      requiredRoles: Actor[];
    };

function decide(actor: Actor, area: PermissionArea, record: RecordAccess, action: AccessAction): AccessDecision | DenialReason {
  const cell = scopeFor(actor, area);
  if (cell.scopes.every((scope) => scope === "none")) return "no_access";
  const { ownership } = record;
  const reach = reachOf(area, cell, action);
  const allowed =
    reach.direct.has(ownership) || (reach.granted.has(ownership) && record.grantedPermission === true);
  if (allowed) {
    const audited = cell.requiresAudit === true || (AUDITED_ACCESS[area]?.includes(action) ?? false);
    return { ok: true, audited };
  }
  if (reach.granted.has(ownership)) return "permission_required";
  if (action === "edit") {
    const read = reachOf(area, cell, "read");
    if (read.direct.has(ownership) || read.granted.has(ownership)) return "read_only";
  }
  return ownership === "other_agency" ? "other_organization" : "out_of_scope";
}

function requiredRolesFor(actor: Actor, area: PermissionArea, ownership: RecordOwnership, action: AccessAction): Actor[] {
  if (!ORGANIZATION_ROLES.includes(actor)) return [];
  return ORGANIZATION_ROLES.filter((role) => {
    if (role === actor) return false;
    const result = decide(role, area, { ownership, grantedPermission: false }, action);
    return typeof result !== "string";
  });
}

/**
 * Can `actor` read (default) or edit a record in `area`? A refusal names the
 * reason and the roles that hold the access, so the screen can explain it
 * instead of hiding the button (§19, §23.5).
 */
export function canAccess(
  actor: Actor,
  area: PermissionArea,
  record: RecordAccess,
  action: AccessAction = "read",
): AccessDecision {
  const result = decide(actor, area, record, action);
  if (typeof result !== "string") return result;
  return { ok: false, reason: result, requiredRoles: requiredRolesFor(actor, area, record.ownership, action) };
}

/** Does any cell of this area depend on an explicit grant? */
function areaUsesGrants(area: PermissionArea): boolean {
  return ALL_ACTORS.some((actor) => {
    const cell = scopeFor(actor, area);
    return cell.requiresGrant || cell.editRequiresGrant || cell.scopes.includes("permission");
  });
}

/**
 * Who can issue the grants an area relies on: the organization roles that
 * manage roles and permissions across the whole organization — Agency Owner
 * and Agency Administrator (§5.4–5.5; §19 "Roles/permissions": Full org). A
 * Team Lead's "Limited" management and Binor admin's system role do not
 * extend to granting organization data. Empty for areas where access comes
 * with the role only (MLS search, audit).
 *
 * An agency owner asking for "Approved" / "Authorized" access appears in the
 * list themselves: the safe step is recording that approval, which is audited.
 */
export function whoCanGrant(area: PermissionArea): Actor[] {
  if (!areaUsesGrants(area)) return [];
  return ORGANIZATION_ROLES.filter(
    (role) => typeof decide(role, "roles_permissions", { ownership: "agency" }, "edit") !== "string",
  );
}
