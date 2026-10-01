import { describe, expect, it } from "vitest";
import {
  ALL_ACTORS,
  ALL_AREAS,
  ALL_OWNERSHIPS,
  PERMISSION_MATRIX,
  canAccess,
  scopeFor,
  whoCanGrant,
  type AccessAction,
  type Actor,
  type PermissionArea,
} from "./permissions";

/** §19 of the master document, copied verbatim (rows in table order). */
const SECTION_19 = `
| Свои leads/clients | Own | Own/assigned | Team | Agency | All | Shared only |
| Team leads | — | По назначению | Team | Agency | All | — |
| Свои properties | Own | Own/assigned | Team | Agency | All | Shared |
| Агентская база | — | Read/allowed edit | Team | Full | All | Published only |
| Sensitive owner data | Own/approved | Permission | Permission | Approved | All audited | Restricted |
| Verification | Own/allowed | Permission | Permission | Authorized | All | Result only |
| MLS search | Professional | Professional | Professional | Full | All | Professional |
| Cooperation | Full own | Allowed | Team | Agency | Moderation | Own requests |
| Deals | Own | Assigned | Team | Agency | All | Participating |
| Reports | Own | Own | Team | Agency | Global | — |
| Roles/permissions | — | — | Limited | Full org | All | — |
| Audit | Own history | Own history | Team | Agency | Full | Own interactions |
`;

/** §19 columns: Individual, Agent, Team Lead, Agency Owner, Admin, Partner. */
const SECTION_19_COLUMNS: Actor[] = [
  "individual_realtor",
  "agency_agent",
  "team_lead",
  "agency_owner",
  "binor_admin",
  "partner",
];

const section19Rows = SECTION_19.trim()
  .split("\n")
  .map((line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((part) => part.trim()),
  );

/**
 * What an actor reaches, as one string over ALL_OWNERSHIPS: a plain name is
 * reachable by role alone, "+name" only with a grant, absent = never.
 */
function reach(actor: Actor, area: PermissionArea, action: AccessAction): string {
  return ALL_OWNERSHIPS.flatMap((ownership) => {
    if (canAccess(actor, area, { ownership }, action).ok) return [ownership];
    if (canAccess(actor, area, { ownership, grantedPermission: true }, action).ok) return [`+${ownership}`];
    return [];
  }).join(" ");
}

const OWN_TEAM = "own assigned team";
const ORG = "own assigned team agency";
const ALL = "own assigned team agency shared published other_agency";
const PROFESSIONAL = "own assigned team agency shared published";
const GRANT_READ = "+own +assigned +team +agency +shared";
const GRANT_EDIT = "+own +assigned +team +agency";
const GRANT_ORG = "+own +assigned +team +agency";

type Expected = readonly [read: string, edit: string];
const same = (value: string): Expected => [value, value];
const PERMISSION: Expected = [GRANT_READ, GRANT_EDIT];

/** The reading of every cell, §19 columns and the two derived ones. */
const EXPECTED: Record<PermissionArea, Record<Actor, Expected>> = {
  own_leads_clients: {
    individual_realtor: same("own"),
    agency_agent: same("own assigned"),
    team_lead: same(OWN_TEAM),
    agency_owner: same(ORG),
    binor_admin: same(ALL),
    partner: ["shared", ""],
    agency_admin: PERMISSION,
    compliance: same(""),
  },
  team_leads: {
    individual_realtor: same(""),
    agency_agent: same("assigned"),
    team_lead: same(OWN_TEAM),
    agency_owner: same(ORG),
    binor_admin: same(ALL),
    partner: same(""),
    agency_admin: PERMISSION,
    compliance: same(""),
  },
  own_properties: {
    individual_realtor: same("own"),
    agency_agent: same("own assigned"),
    team_lead: same(OWN_TEAM),
    agency_owner: same(ORG),
    binor_admin: same(ALL),
    partner: ["shared", ""],
    agency_admin: PERMISSION,
    compliance: same(""),
  },
  agency_base: {
    individual_realtor: same(""),
    agency_agent: [ORG, GRANT_ORG],
    team_lead: same(OWN_TEAM),
    agency_owner: same(ORG),
    binor_admin: same(ALL),
    partner: ["published", ""],
    agency_admin: PERMISSION,
    compliance: same(""),
  },
  sensitive_owner_data: {
    individual_realtor: ["own +assigned +team +agency +shared", "own +assigned +team +agency"],
    agency_agent: PERMISSION,
    team_lead: PERMISSION,
    agency_owner: same(GRANT_ORG),
    binor_admin: same(ALL),
    partner: same(""),
    agency_admin: PERMISSION,
    compliance: PERMISSION,
  },
  verification: {
    individual_realtor: ["own +assigned +team +agency +shared", "own +assigned +team +agency"],
    agency_agent: PERMISSION,
    team_lead: PERMISSION,
    agency_owner: same(GRANT_ORG),
    binor_admin: same(ALL),
    partner: ["shared published", ""],
    agency_admin: same(""),
    compliance: same(ORG),
  },
  mls_search: {
    individual_realtor: [PROFESSIONAL, "own assigned"],
    agency_agent: [PROFESSIONAL, "own assigned"],
    team_lead: [PROFESSIONAL, "own assigned"],
    agency_owner: [PROFESSIONAL, ORG],
    binor_admin: same(ALL),
    partner: [PROFESSIONAL, "own assigned"],
    agency_admin: same(""),
    compliance: same(""),
  },
  cooperation: {
    individual_realtor: same("own"),
    agency_agent: PERMISSION,
    team_lead: same(OWN_TEAM),
    agency_owner: same(ORG),
    binor_admin: same(ALL),
    partner: same("own"),
    agency_admin: same(""),
    compliance: same(""),
  },
  deals: {
    individual_realtor: same("own"),
    agency_agent: same("assigned"),
    team_lead: same(OWN_TEAM),
    agency_owner: same(ORG),
    binor_admin: same(ALL),
    partner: ["own assigned shared", "own assigned"],
    agency_admin: same(""),
    compliance: PERMISSION,
  },
  reports: {
    individual_realtor: same("own"),
    agency_agent: same("own"),
    team_lead: same(OWN_TEAM),
    agency_owner: same(ORG),
    binor_admin: same(ALL),
    partner: same(""),
    agency_admin: PERMISSION,
    compliance: same(""),
  },
  roles_permissions: {
    individual_realtor: same(""),
    agency_agent: same(""),
    team_lead: [OWN_TEAM, "+own +assigned +team"],
    agency_owner: same(ORG),
    binor_admin: same(ALL),
    partner: same(""),
    agency_admin: same(ORG),
    compliance: same(""),
  },
  // Append-only: nobody edits the audit trail.
  audit: {
    individual_realtor: ["own", ""],
    agency_agent: ["own", ""],
    team_lead: [OWN_TEAM, ""],
    agency_owner: [ORG, ""],
    binor_admin: [ALL, ""],
    partner: ["own", ""],
    agency_admin: [ORG, ""],
    compliance: [ORG, ""],
  },
};

describe("matrix shape", () => {
  it("has one row per §19 area and one cell per actor", () => {
    expect(Object.keys(PERMISSION_MATRIX)).toEqual([...ALL_AREAS]);
    for (const area of ALL_AREAS) {
      expect(Object.keys(PERMISSION_MATRIX[area]).sort()).toEqual([...ALL_ACTORS].sort());
    }
    expect(new Set(ALL_ACTORS).size).toBe(8);
  });

  it("keeps every §19 cell verbatim", () => {
    expect(section19Rows).toHaveLength(ALL_AREAS.length);
    ALL_AREAS.forEach((area, row) => {
      SECTION_19_COLUMNS.forEach((actor, column) => {
        const cell = scopeFor(actor, area);
        expect([area, actor, cell.text]).toEqual([area, actor, section19Rows[row][column + 1]]);
        expect(cell.source).toBe("§19");
      });
    });
  });

  it("marks the agency admin and compliance columns as derived from §5.5 / §5.7", () => {
    for (const area of ALL_AREAS) {
      expect(scopeFor("agency_admin", area).source).toBe("§5.5");
      expect(scopeFor("compliance", area).source).toBe("§5.7");
    }
  });

  it("keeps the meaning of grant / audit cells recoverable as flags", () => {
    expect(scopeFor("agency_owner", "sensitive_owner_data")).toMatchObject({
      text: "Approved",
      scopes: ["agency"],
      requiresGrant: true,
    });
    expect(scopeFor("agency_owner", "verification")).toMatchObject({ text: "Authorized", requiresGrant: true });
    expect(scopeFor("binor_admin", "sensitive_owner_data")).toMatchObject({
      text: "All audited",
      scopes: ["all"],
      requiresAudit: true,
    });
    expect(scopeFor("agency_agent", "agency_base")).toMatchObject({
      text: "Read/allowed edit",
      editRequiresGrant: true,
    });
    expect(scopeFor("agency_agent", "own_leads_clients").scopes).toEqual(["own", "assigned"]);
    expect(scopeFor("individual_realtor", "sensitive_owner_data").scopes).toEqual(["own", "permission"]);
    expect(scopeFor("agency_agent", "cooperation").scopes).toEqual(["permission"]);
    expect(scopeFor("partner", "sensitive_owner_data").scopes).toEqual(["none"]);
  });
});

describe("every cell's reach", () => {
  for (const area of ALL_AREAS) {
    for (const actor of ALL_ACTORS) {
      const [read, edit] = EXPECTED[area][actor];
      it(`${area} × ${actor} (${scopeFor(actor, area).text})`, () => {
        expect(reach(actor, area, "read")).toBe(read);
        expect(reach(actor, area, "edit")).toBe(edit);
      });
    }
  }
});

describe("canAccess denials", () => {
  it("no_access: the role has nothing in this area", () => {
    expect(canAccess("individual_realtor", "team_leads", { ownership: "own" })).toEqual({
      ok: false,
      reason: "no_access",
      requiredRoles: [],
    });
    expect(canAccess("agency_agent", "roles_permissions", { ownership: "team" })).toEqual({
      ok: false,
      reason: "no_access",
      requiredRoles: ["team_lead", "agency_owner", "agency_admin"],
    });
    // "Restricted": a partner never reaches owner contacts through this area.
    expect(canAccess("partner", "sensitive_owner_data", { ownership: "shared", grantedPermission: true })).toMatchObject({
      ok: false,
      reason: "no_access",
    });
  });

  it("out_of_scope: names the staff roles that hold the access", () => {
    expect(canAccess("agency_agent", "team_leads", { ownership: "team" })).toEqual({
      ok: false,
      reason: "out_of_scope",
      requiredRoles: ["team_lead", "agency_owner"],
    });
    expect(canAccess("team_lead", "own_leads_clients", { ownership: "agency" })).toEqual({
      ok: false,
      reason: "out_of_scope",
      requiredRoles: ["agency_owner"],
    });
    expect(canAccess("agency_agent", "deals", { ownership: "own" })).toEqual({
      ok: false,
      reason: "out_of_scope",
      requiredRoles: ["team_lead", "agency_owner"],
    });
  });

  it("other_organization: another agency's unpublished record", () => {
    expect(canAccess("agency_owner", "agency_base", { ownership: "other_agency" })).toEqual({
      ok: false,
      reason: "other_organization",
      requiredRoles: [],
    });
    expect(canAccess("partner", "mls_search", { ownership: "other_agency" })).toMatchObject({
      reason: "other_organization",
    });
  });

  it("permission_required: reachable only with a grant; whoCanGrant names the issuers", () => {
    expect(canAccess("agency_agent", "sensitive_owner_data", { ownership: "own" })).toEqual({
      ok: false,
      reason: "permission_required",
      requiredRoles: [],
    });
    expect(whoCanGrant("sensitive_owner_data")).toEqual(["agency_owner", "agency_admin"]);
    expect(canAccess("agency_agent", "sensitive_owner_data", { ownership: "own", grantedPermission: true })).toEqual({
      ok: true,
      audited: true,
    });

    // "Read/allowed edit": reading the base is free, editing needs the grant.
    expect(canAccess("agency_agent", "agency_base", { ownership: "agency" })).toEqual({ ok: true, audited: false });
    expect(canAccess("agency_agent", "agency_base", { ownership: "agency" }, "edit")).toEqual({
      ok: false,
      reason: "permission_required",
      requiredRoles: ["agency_owner"],
    });

    // "Limited": a team lead changes team permissions only when delegated.
    expect(canAccess("team_lead", "roles_permissions", { ownership: "team" }, "edit")).toEqual({
      ok: false,
      reason: "permission_required",
      requiredRoles: ["agency_owner", "agency_admin"],
    });

    // "Allowed": an agent cooperates only when the agency allows it.
    expect(canAccess("agency_agent", "cooperation", { ownership: "own" })).toMatchObject({
      reason: "permission_required",
    });
    expect(canAccess("agency_agent", "cooperation", { ownership: "own", grantedPermission: true }).ok).toBe(true);

    // "Approved": even the agency owner records an approval first.
    expect(canAccess("agency_owner", "sensitive_owner_data", { ownership: "agency" })).toMatchObject({
      reason: "permission_required",
    });
    expect(whoCanGrant("verification")).toContain("agency_owner");
  });

  it("read_only: results, other parties' publications and the audit trail", () => {
    expect(canAccess("partner", "verification", { ownership: "published" })).toEqual({ ok: true, audited: false });
    expect(canAccess("partner", "verification", { ownership: "published" }, "edit")).toEqual({
      ok: false,
      reason: "read_only",
      requiredRoles: [],
    });
    expect(canAccess("partner", "agency_base", { ownership: "published" }, "edit")).toMatchObject({
      reason: "read_only",
    });
    expect(canAccess("agency_agent", "mls_search", { ownership: "published" }, "edit")).toMatchObject({
      reason: "read_only",
    });
    expect(canAccess("binor_admin", "audit", { ownership: "agency" }, "edit")).toEqual({
      ok: false,
      reason: "read_only",
      requiredRoles: [],
    });
    expect(canAccess("agency_owner", "audit", { ownership: "team" }, "edit")).toEqual({
      ok: false,
      reason: "read_only",
      requiredRoles: [],
    });
  });

  it("never suggests Binor admin or a partner as the role to ask", () => {
    for (const area of ALL_AREAS) {
      for (const actor of ALL_ACTORS) {
        for (const ownership of ALL_OWNERSHIPS) {
          for (const action of ["read", "edit"] as const) {
            const result = canAccess(actor, area, { ownership }, action);
            if (result.ok) continue;
            expect(result.requiredRoles).not.toContain("binor_admin");
            expect(result.requiredRoles).not.toContain("partner");
            expect(result.requiredRoles).not.toContain(actor);
          }
        }
      }
    }
  });

  it("gives an individual realtor or a partner no organization roles to turn to", () => {
    expect(canAccess("individual_realtor", "agency_base", { ownership: "agency" }).ok).toBe(false);
    expect(canAccess("individual_realtor", "agency_base", { ownership: "agency" })).toMatchObject({ requiredRoles: [] });
    expect(canAccess("partner", "own_leads_clients", { ownership: "agency" })).toEqual({
      ok: false,
      reason: "out_of_scope",
      requiredRoles: [],
    });
  });
});

describe("audited access", () => {
  it('"All audited" returns audited: true for Binor admin', () => {
    for (const ownership of ALL_OWNERSHIPS) {
      expect(canAccess("binor_admin", "sensitive_owner_data", { ownership })).toEqual({ ok: true, audited: true });
      expect(canAccess("binor_admin", "sensitive_owner_data", { ownership }, "edit")).toEqual({
        ok: true,
        audited: true,
      });
    }
  });

  it("logs every sensitive-data access and every change of rights (§38.6 p.7)", () => {
    expect(canAccess("individual_realtor", "sensitive_owner_data", { ownership: "own" })).toEqual({
      ok: true,
      audited: true,
    });
    expect(canAccess("agency_owner", "roles_permissions", { ownership: "agency" })).toEqual({
      ok: true,
      audited: false,
    });
    expect(canAccess("agency_owner", "roles_permissions", { ownership: "agency" }, "edit")).toEqual({
      ok: true,
      audited: true,
    });
  });

  it("does not flag ordinary work", () => {
    expect(canAccess("binor_admin", "own_leads_clients", { ownership: "other_agency" })).toEqual({
      ok: true,
      audited: false,
    });
    expect(canAccess("agency_agent", "own_leads_clients", { ownership: "assigned" }, "edit")).toEqual({
      ok: true,
      audited: false,
    });
  });
});

describe("whoCanGrant", () => {
  it("names the agency owner and administrator wherever a cell depends on a grant", () => {
    const grantAreas = ALL_AREAS.filter((area) => whoCanGrant(area).length > 0);
    expect(grantAreas).toEqual(ALL_AREAS.filter((area) => area !== "mls_search" && area !== "audit"));
    for (const area of grantAreas) expect(whoCanGrant(area)).toEqual(["agency_owner", "agency_admin"]);
  });

  it("is empty where access comes with the role only", () => {
    expect(whoCanGrant("mls_search")).toEqual([]);
    expect(whoCanGrant("audit")).toEqual([]);
  });

  it("never includes Binor admin or a team lead", () => {
    for (const area of ALL_AREAS) {
      expect(whoCanGrant(area)).not.toContain("binor_admin");
      expect(whoCanGrant(area)).not.toContain("team_lead");
    }
  });
});
