import { describe, expect, it } from "vitest";
import { getAgent, getOrganization, getViewer, listContracts, listListings } from "@/lib/data/repository";
import { explainAccess } from "./access";
import {
  blockAccess,
  contractsForListing,
  documentState,
  INFO_BLOCKS,
  requestContract,
  requesterStanding,
  requestListing,
  requiredDocuments,
  SUBJECT_BLOCK,
  validateRequest,
  type RequestContract,
} from "./request";

describe("requesterStanding (§38.2)", () => {
  it("sends from the organization for its realtors, in their own name for a real-estate agent", async () => {
    const { agent, organization } = await getViewer();
    expect(requesterStanding(agent, organization)).toBe("realtor_organization");
    const realEstateAgent = (await getAgent("agent-09"))!;
    expect(requesterStanding(realEstateAgent, undefined)).toBe("real_estate_agent");
    // A real-estate agent stays one even when an organization is passed: the status is the agent's own.
    expect(requesterStanding(realEstateAgent, await getOrganization("org-01"))).toBe("real_estate_agent");
  });

  it("has nobody to send for a professional outside an organization", async () => {
    const individual = (await getAgent("agent-08"))!;
    expect(requesterStanding(individual, undefined)).toBe("none");
  });
});

describe("blockAccess (§38.4 table)", () => {
  it("limits a real-estate agent to the first two blocks", () => {
    expect(INFO_BLOCKS.filter((block) => blockAccess("real_estate_agent", block).access === "allowed")).toEqual([
      "legal_entities",
      "property_rights",
    ]);
    expect(blockAccess("real_estate_agent", "notary")).toEqual({ access: "not_allowed", reason: "agent_limit" });
  });

  it("opens the art. 32 list to an organization, with residence data behind a purpose and other sources closed", () => {
    expect(blockAccess("realtor_organization", "tax").access).toBe("allowed");
    expect(blockAccess("realtor_organization", "utilities").access).toBe("allowed");
    expect(blockAccess("realtor_organization", "residence")).toEqual({ access: "conditional", reason: "sensitive" });
    expect(blockAccess("realtor_organization", "other")).toEqual({ access: "not_allowed", reason: "category_check" });
  });

  it("closes everything when there is no standing", () => {
    for (const block of INFO_BLOCKS) expect(blockAccess("none", block).reason).toBe("no_standing");
  });
});

describe("documents", () => {
  it("always asks for the contract and the customer's authority", () => {
    for (const block of INFO_BLOCKS) {
      expect(requiredDocuments(block).slice(0, 2)).toEqual(["service_contract", "customer_authority"]);
    }
    expect(requiredDocuments("legal_entities")).toContain("company_identifier");
    expect(requiredDocuments("residence")).toContain("subject_consent");
    expect(requiredDocuments("property_rights")).toContain("right_holder_consents");
  });

  it("marks only what Binor actually holds as ready", () => {
    const active = { status: "active" as const, missingConsents: 0 };
    expect(documentState("service_contract", { contract: active })).toBe("ready");
    expect(documentState("service_contract", { contract: { status: "awaiting_signature", missingConsents: 0 } })).toBe(
      "missing",
    );
    expect(documentState("right_holder_consents", { contract: { status: "active", missingConsents: 1 } })).toBe("missing");
    expect(documentState("object_identifier", { cadastralKnown: true })).toBe("ready");
    // Unknown is not "missing": the agent checks the paper.
    expect(documentState("object_identifier", { cadastralKnown: false })).toBe("manual");
    expect(documentState("customer_authority", { contract: active })).toBe("manual");
  });
});

describe("the request form on seeded data", async () => {
  const [mine, contracts] = await Promise.all([listListings({ scope: "mine" }), listContracts()]);
  const listings = mine.map((view) => requestListing(view, view.listing.id));
  const options = contracts.filter((view) => view.scope === "own").map(requestContract);

  it("puts the listing's own contract first and leaves other objects' contracts out", () => {
    const lst06 = listings.find((item) => item.id === "lst-06");
    const ordered = contractsForListing(options, lst06);
    expect(ordered[0].number).toBe("DR-2026-055");
    expect(ordered.map((item) => item.number)).toContain("DR-2026-062");
    expect(ordered.every((item) => !item.listingId || item.listingId === "lst-06")).toBe(true);
  });

  it("accepts an active contract with every right holder's consent", () => {
    const contract = options.find((item) => item.number === "DR-2026-038")!;
    expect(
      validateRequest(
        { listingId: "lst-03", subject: "encumbrance", purpose: "deal_preparation", contractId: contract.id },
        "realtor_organization",
        listings,
        options,
      ),
    ).toEqual([]);
  });

  it("refuses a contract that awaits a co-owner's consent (art. 37)", () => {
    const contract = options.find((item) => item.number === "DR-2026-061")!;
    expect(contract.missingConsents).toBe(1);
    const errors = validateRequest(
      { listingId: "lst-35", subject: "ownership", purpose: "listing_preparation", contractId: contract.id },
      "realtor_organization",
      listings,
      options,
    );
    // Not active comes first: an unsigned contract cannot be the basis at all.
    expect(errors).toEqual([{ field: "contractId", error: "contract_not_active" }]);
    const signed: RequestContract = { ...contract, status: "active" };
    expect(
      validateRequest(
        { listingId: "lst-35", subject: "ownership", purpose: "listing_preparation", contractId: contract.id },
        "realtor_organization",
        listings,
        [signed],
      ),
    ).toEqual([{ field: "contractId", error: "consents_missing" }]);
  });

  it("refuses subjects the status does not open and contracts on another object", () => {
    const other = options.find((item) => item.number === "DR-2026-041")!;
    const errors = validateRequest(
      { listingId: "lst-03", subject: "tax_debts", contractId: other.id },
      "real_estate_agent",
      listings,
      options,
    );
    expect(errors).toEqual([
      { field: "subject", error: "subject_not_allowed" },
      { field: "purpose", error: "purpose_required" },
      { field: "contractId", error: "contract_other_object" },
    ]);
    expect(SUBJECT_BLOCK.tax_debts).toBe("tax");
    expect(validateRequest({}, "none", listings, options).map((error) => error.error)).toEqual([
      "listing_required",
      "subject_required",
      "purpose_required",
      "contract_required",
    ]);
  });
});

describe("explainAccess (§19, §23.5)", () => {
  it("says an agency agent needs a granted permission and who grants it", () => {
    expect(explainAccess("agency_agent", "verification", "own")).toEqual({
      ok: false,
      reason: "permission_required",
      holders: expect.any(Array),
      grantors: ["agency_owner", "agency_admin"],
    });
    const owner = explainAccess("agency_agent", "sensitive_owner_data", "agency");
    expect(owner.reason).toBe("permission_required");
    expect(owner.grantors).toEqual(["agency_owner", "agency_admin"]);
  });

  it("names no grantor when a grant would not help", () => {
    expect(explainAccess("partner", "sensitive_owner_data", "shared")).toEqual({
      ok: false,
      reason: "no_access",
      holders: [],
      grantors: [],
    });
    expect(explainAccess("compliance", "verification", "agency").ok).toBe(true);
  });
});
