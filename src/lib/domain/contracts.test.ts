import { describe, expect, it } from "vitest";
import {
  CONTRACT_CLAUSES,
  CONTRACT_EXPIRING_DAYS,
  canActivate,
  contractDisplayStatus,
  contractIssues,
  daysUntilEnd,
  type ActivationCheck,
  type ContractIssue,
} from "./contracts";
import { money } from "./money";
import type { Contract, ContractSignature, Owner } from "./types";

const NOW = new Date("2026-09-30T06:00:00.000Z"); // Wed 11:00 Tashkent

const ALL_CLAUSES: Contract["clauses"] = {
  certificateDetails: true,
  membershipDetails: true,
  insuranceDetails: true,
  rightsAndObligations: true,
  liability: true,
  terminationAndRefund: true,
  confidentiality: true,
};

function signature(party: ContractSignature["party"], method: ContractSignature["method"] = "paper"): ContractSignature {
  return { party, signerName: party, method, signedAt: "2026-09-01T06:00:00.000Z" };
}

/** A complete, signed, active owner-service contract with one right holder. */
function contract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    number: "DR-2026-057",
    kind: "owner_service",
    status: "active",
    templateVersion: "owner-service@1",
    service: "Поиск покупателя на квартиру",
    customer: { kind: "owner", id: "owner-1" },
    agentId: "agent-1",
    listingId: "listing-1",
    startsAt: "2026-09-01T00:00:00.000Z",
    endsAt: "2026-12-01T00:00:00.000Z",
    remuneration: { kind: "percent", percent: 2, paymentTerms: "В день подписания договора купли-продажи" },
    clauses: { ...ALL_CLAUSES },
    rightHolderConsents: [{ ownerId: "owner-1", status: "confirmed", consentId: "consent-1" }],
    signatures: [signature("customer"), signature("agent")],
    createdAt: "2026-09-01T06:00:00.000Z",
    ...overrides,
  };
}

function owner(id: string, name: string, consents: Owner["consents"] = []): Owner {
  return { id, name, phone: "+998901234567", confidentiality: "restricted", consents };
}

function codes(issues: ContractIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

function failures(result: ActivationCheck): ContractIssue[] {
  return result.ok ? [] : result.issues;
}

describe("daysUntilEnd", () => {
  it("counts Tashkent calendar days, not 24-hour periods", () => {
    // Ends 23:30 Tashkent today → 0; 00:30 Tashkent tomorrow → 1, though only 13.5 hours away.
    expect(daysUntilEnd({ endsAt: "2026-09-30T18:30:00.000Z" }, NOW)).toBe(0);
    expect(daysUntilEnd({ endsAt: "2026-09-30T19:30:00.000Z" }, NOW)).toBe(1);
    expect(daysUntilEnd({ endsAt: "2026-10-14T06:00:00.000Z" }, NOW)).toBe(14);
  });

  it("is negative after the end and crosses month and year ends", () => {
    expect(daysUntilEnd({ endsAt: "2026-09-27T06:00:00.000Z" }, NOW)).toBe(-3);
    expect(daysUntilEnd({ endsAt: "2027-01-01T06:00:00.000Z" }, NOW)).toBe(93);
  });

  it("rejects an unreadable date instead of guessing", () => {
    expect(() => daysUntilEnd({ endsAt: "01.12.2026" }, NOW)).toThrow(RangeError);
  });
});

describe("contractDisplayStatus", () => {
  it("shows an active contract far from its end as active", () => {
    expect(contractDisplayStatus(contract(), NOW)).toBe("active");
    expect(contractDisplayStatus(contract({ endsAt: "2026-10-15T06:00:00.000Z" }), NOW)).toBe("active");
  });

  it(`turns "expiring" within ${CONTRACT_EXPIRING_DAYS} calendar days of the end`, () => {
    expect(CONTRACT_EXPIRING_DAYS).toBe(14);
    expect(contractDisplayStatus(contract({ endsAt: "2026-10-14T18:59:59.000Z" }), NOW)).toBe("expiring");
    expect(contractDisplayStatus(contract({ endsAt: "2026-09-30T18:00:00.000Z" }), NOW)).toBe("expiring");
  });

  it("reads an active contract past its end as expired", () => {
    expect(contractDisplayStatus(contract({ endsAt: "2026-09-30T06:00:00.000Z" }), NOW)).toBe("expired");
    expect(contractDisplayStatus(contract({ endsAt: "2026-09-01T00:00:00.000Z" }), NOW)).toBe("expired");
  });

  it("shows every other status as stored", () => {
    const ended = { endsAt: "2026-09-01T00:00:00.000Z" };
    expect(contractDisplayStatus(contract({ status: "draft", ...ended }), NOW)).toBe("draft");
    expect(contractDisplayStatus(contract({ status: "awaiting_signature" }), NOW)).toBe("awaiting_signature");
    expect(contractDisplayStatus(contract({ status: "terminated", endsAt: "2026-10-01T00:00:00.000Z" }), NOW)).toBe(
      "terminated",
    );
    expect(contractDisplayStatus(contract({ status: "expired" }), NOW)).toBe("expired");
  });

  it("keeps the stored status when the end date is unreadable", () => {
    expect(contractDisplayStatus(contract({ endsAt: "soon" }), NOW)).toBe("active");
  });
});

describe("contractIssues", () => {
  it("finds nothing wrong with a complete contract", () => {
    expect(contractIssues(contract())).toEqual([]);
    expect(CONTRACT_CLAUSES).toEqual(Object.keys(ALL_CLAUSES));
  });

  it("reports each missing clause separately, in clause order", () => {
    const clauses = { ...ALL_CLAUSES, insuranceDetails: false, certificateDetails: false, confidentiality: false };
    expect(contractIssues(contract({ clauses }))).toEqual([
      { code: "clause_missing", severity: "error", params: { clause: "certificateDetails" } },
      { code: "clause_missing", severity: "error", params: { clause: "insuranceDetails" } },
      { code: "clause_missing", severity: "error", params: { clause: "confidentiality" } },
    ]);
  });

  it.each(CONTRACT_CLAUSES)("flags a missing %s clause", (clause) => {
    expect(contractIssues(contract({ clauses: { ...ALL_CLAUSES, [clause]: false } }))).toEqual([
      { code: "clause_missing", severity: "error", params: { clause } },
    ]);
  });

  it("requires a description of the service", () => {
    expect(codes(contractIssues(contract({ service: "  " })))).toEqual(["service_missing"]);
  });

  describe("art. 37 right holders", () => {
    it("raises one issue per right holder without consent; one consent never covers the others", () => {
      const rightHolderConsents: Contract["rightHolderConsents"] = [
        { ownerId: "owner-1", status: "confirmed", consentId: "consent-1" },
        { ownerId: "owner-2", status: "missing" },
        { ownerId: "owner-3", status: "missing" },
      ];
      expect(contractIssues(contract({ rightHolderConsents }))).toEqual([
        { code: "right_holder_consent_missing", severity: "error", params: { ownerId: "owner-2" } },
        { code: "right_holder_consent_missing", severity: "error", params: { ownerId: "owner-3" } },
      ]);
    });

    it("names the right holder when owners are supplied", () => {
      const rightHolderConsents: Contract["rightHolderConsents"] = [{ ownerId: "owner-2", status: "missing" }];
      expect(contractIssues(contract({ rightHolderConsents }), { owners: [owner("owner-2", "Дилноза Каримова")] })).toEqual([
        {
          code: "right_holder_consent_missing",
          severity: "error",
          params: { ownerId: "owner-2", ownerName: "Дилноза Каримова" },
        },
      ]);
    });

    it("needs at least one right holder on a property contract, but not on other kinds", () => {
      expect(codes(contractIssues(contract({ rightHolderConsents: [] })))).toEqual(["right_holders_missing"]);
      const buyer = contract({ kind: "buyer_service", customer: { kind: "client", id: "client-1" }, rightHolderConsents: [] });
      expect(contractIssues(buyer)).toEqual([]);
    });

    it("treats a revoked consent as missing proof", () => {
      const consents: Owner["consents"] = [
        {
          id: "consent-1",
          purpose: "document_processing",
          channel: "written",
          grantedAt: "2026-08-20T06:00:00.000Z",
          revokedAt: "2026-09-20T06:00:00.000Z",
          textVersion: "v1",
        },
      ];
      expect(contractIssues(contract(), { owners: [owner("owner-1", "Азиз Рахимов", consents)] })).toEqual([
        {
          code: "right_holder_consent_revoked",
          severity: "error",
          params: { ownerId: "owner-1", ownerName: "Азиз Рахимов", consentId: "consent-1" },
        },
      ]);
    });

    it("warns when a confirmed consent is not linked to its record", () => {
      const rightHolderConsents: Contract["rightHolderConsents"] = [{ ownerId: "owner-1", status: "confirmed" }];
      expect(contractIssues(contract({ rightHolderConsents }))).toEqual([
        { code: "right_holder_consent_unlinked", severity: "warning", params: { ownerId: "owner-1" } },
      ]);
    });
  });

  describe("remuneration", () => {
    it("flags a percent fee without a percent", () => {
      const remuneration = { kind: "percent" as const, paymentTerms: "При сделке" };
      expect(contractIssues(contract({ remuneration }))).toEqual([
        { code: "remuneration_incomplete", severity: "error", params: { field: "percent" } },
      ]);
    });

    it("flags a fixed fee without an amount", () => {
      const remuneration = { kind: "fixed" as const, paymentTerms: "При сделке" };
      expect(contractIssues(contract({ remuneration }))).toEqual([
        { code: "remuneration_incomplete", severity: "error", params: { field: "amount" } },
      ]);
      const paid = { kind: "fixed" as const, amount: money("1500", "USD"), paymentTerms: "При сделке" };
      expect(contractIssues(contract({ remuneration: paid }))).toEqual([]);
    });

    it("flags empty payment terms", () => {
      expect(contractIssues(contract({ remuneration: { kind: "percent", percent: 2, paymentTerms: " " } }))).toEqual([
        { code: "remuneration_incomplete", severity: "error", params: { field: "paymentTerms" } },
      ]);
    });

    it("rejects impossible values", () => {
      for (const percent of [0, -1, 101, Number.NaN]) {
        expect(codes(contractIssues(contract({ remuneration: { kind: "percent", percent, paymentTerms: "x" } })))).toEqual([
          "remuneration_invalid",
        ]);
      }
      const zero = { kind: "fixed" as const, amount: money("0", "USD"), paymentTerms: "x" };
      expect(contractIssues(contract({ remuneration: zero }))).toEqual([
        { code: "remuneration_invalid", severity: "error", params: { field: "amount" } },
      ]);
    });
  });

  describe("period", () => {
    it("requires the end after the start", () => {
      expect(codes(contractIssues(contract({ endsAt: "2026-09-01T00:00:00.000Z" })))).toEqual(["period_invalid"]);
      expect(codes(contractIssues(contract({ endsAt: "2026-08-01T00:00:00.000Z" })))).toEqual(["period_invalid"]);
      expect(codes(contractIssues(contract({ startsAt: "1 сентября" })))).toEqual(["period_invalid"]);
      // Date.parse would read this as 12 January; only ISO-8601 instants count.
      expect(codes(contractIssues(contract({ endsAt: "01.12.2026" })))).toEqual(["period_invalid"]);
    });
  });

  describe("signatures", () => {
    it("requires both sides' signatures on an active contract", () => {
      expect(contractIssues(contract({ signatures: [] }))).toEqual([
        { code: "signature_missing", severity: "error", params: { party: "customer" } },
        { code: "signature_missing", severity: "error", params: { party: "agent" } },
      ]);
      expect(codes(contractIssues(contract({ signatures: [signature("agent")] })))).toEqual(["signature_missing"]);
    });

    it("does not ask for signatures before the contract is active", () => {
      expect(contractIssues(contract({ status: "draft", signatures: [] }))).toEqual([]);
      expect(contractIssues(contract({ status: "awaiting_signature", signatures: [signature("agent")] }))).toEqual([]);
    });

    it("accepts the head of the organization for the agent side (art. 36)", () => {
      expect(contractIssues(contract({ signatures: [signature("customer"), signature("organization_head")] }))).toEqual([]);
    });

    it("accepts the partner as the customer of a cooperation contract", () => {
      const cooperation = contract({
        kind: "cooperation",
        customer: { kind: "agent", id: "agent-2" },
        rightHolderConsents: [],
        signatures: [signature("partner"), signature("agent")],
      });
      expect(contractIssues(cooperation)).toEqual([]);
      expect(codes(contractIssues(contract({ signatures: [signature("partner"), signature("agent")] })))).toEqual([
        "signature_missing",
      ]);
    });

    it("warns, without blocking, that a simple electronic signature needs legal confirmation", () => {
      const signatures = [signature("customer", "simple_electronic"), signature("agent", "qualified_electronic")];
      expect(contractIssues(contract({ signatures }))).toEqual([
        { code: "signature_method_unverified", severity: "warning", params: { party: "customer" } },
      ]);
    });
  });

  it("lists errors and warnings together in a stable order", () => {
    const broken = contract({
      service: "",
      clauses: { ...ALL_CLAUSES, liability: false },
      remuneration: { kind: "percent", paymentTerms: "" },
      rightHolderConsents: [{ ownerId: "owner-2", status: "missing" }],
      signatures: [signature("customer", "simple_electronic")],
      endsAt: "2026-08-01T00:00:00.000Z",
    });
    expect(codes(contractIssues(broken))).toEqual([
      "period_invalid",
      "service_missing",
      "clause_missing",
      "remuneration_incomplete",
      "remuneration_incomplete",
      "right_holder_consent_missing",
      "signature_missing",
      "signature_method_unverified",
    ]);
  });
});

describe("canActivate", () => {
  const ready = contract({ status: "awaiting_signature" });

  it("activates a complete, signed contract", () => {
    expect(canActivate(ready, NOW)).toEqual({ ok: true, warnings: [] });
    expect(canActivate(contract({ status: "draft" }), NOW).ok).toBe(true);
  });

  it("refuses missing clauses, consents and signatures, listing only errors", () => {
    const draft = contract({
      status: "draft",
      clauses: { ...ALL_CLAUSES, terminationAndRefund: false },
      rightHolderConsents: [
        { ownerId: "owner-1", status: "confirmed", consentId: "consent-1" },
        { ownerId: "owner-2", status: "missing" },
      ],
      signatures: [signature("agent", "simple_electronic")],
    });
    const result = canActivate(draft, NOW);
    expect(result.ok).toBe(false);
    expect(failures(result)).toEqual([
      { code: "clause_missing", severity: "error", params: { clause: "terminationAndRefund" } },
      { code: "right_holder_consent_missing", severity: "error", params: { ownerId: "owner-2" } },
      { code: "signature_missing", severity: "error", params: { party: "customer" } },
    ]);
    expect(result.warnings).toEqual([
      { code: "signature_method_unverified", severity: "warning", params: { party: "agent" } },
    ]);
  });

  it("does not let a simple electronic signature block activation", () => {
    const signatures = [signature("customer", "simple_electronic"), signature("agent")];
    expect(canActivate(contract({ status: "awaiting_signature", signatures }), NOW)).toEqual({
      ok: true,
      warnings: [{ code: "signature_method_unverified", severity: "warning", params: { party: "customer" } }],
    });
  });

  it("refuses a term that has already ended", () => {
    expect(failures(canActivate(contract({ status: "draft", endsAt: "2026-09-29T00:00:00.000Z" }), NOW))).toEqual([
      { code: "period_ended", severity: "error", params: { endsAt: "2026-09-29T00:00:00.000Z" } },
    ]);
  });

  it("only activates drafts and contracts awaiting signature", () => {
    for (const status of ["active", "expired", "terminated"] as const) {
      expect(failures(canActivate(contract({ status }), NOW))).toEqual([
        { code: "status_not_activatable", severity: "error", params: { status } },
      ]);
    }
  });

  it("checks a revoked consent when owners are supplied", () => {
    const revoked = owner("owner-1", "Азиз Рахимов", [
      {
        id: "consent-1",
        purpose: "document_processing",
        channel: "electronic",
        grantedAt: "2026-08-20T06:00:00.000Z",
        revokedAt: "2026-09-25T06:00:00.000Z",
        textVersion: "v1",
      },
    ]);
    expect(canActivate(ready, NOW).ok).toBe(true);
    expect(codes(failures(canActivate(ready, NOW, { owners: [revoked] })))).toEqual(["right_holder_consent_revoked"]);
  });
});
