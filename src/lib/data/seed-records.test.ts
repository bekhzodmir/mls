import { describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import type { ID } from "@/lib/domain/types";
import { tashkentDateKey } from "@/lib/domain/working-days";
import { seed } from "./seed";
import { contractIdFor } from "./seed-contracts";
import { ORG_AUDIT_ACTIONS, ORG_AUDIT_TARGET_KINDS, SYSTEM_ACTOR_ID } from "./views";

/**
 * Integrity of the contracts, calls, communications, teams, routing and
 * organization-journal seed: every reference resolves, contract numbers and
 * end dates agree with the listings, and recording rules hold (§36.5).
 */

const ids = (items: readonly { id: ID }[]) => new Set(items.map((item) => item.id));
const agents = ids(seed.agents);
const owners = ids(seed.owners);
const clients = ids(seed.clients);
const leads = ids(seed.leads);
const listings = ids(seed.listings);
const deals = ids(seed.deals);
const requirements = ids(seed.requirements);
const organizations = ids(seed.organizations);
const agent = (id: ID) => seed.agents.find((item) => item.id === id);
const nowIso = now().toISOString();

describe("contracts seed", () => {
  it("has exactly one contract per listing contract number, with the listing's end date and owner", () => {
    for (const listing of seed.listings) {
      if (!listing.contractId) continue;
      const matching = seed.contracts.filter((contract) => contract.number === listing.contractId);
      expect(matching.length, listing.id).toBe(1);
      const [contract] = matching;
      const property = seed.properties.find((item) => item.id === listing.propertyId);
      expect(contract.id, listing.id).toBe(contractIdFor(listing.contractId));
      expect(contract.endsAt, listing.id).toBe(listing.contractExpiresAt);
      expect(contract.listingId, listing.id).toBe(listing.id);
      expect(contract.kind, listing.id).toBe("owner_service");
      expect(contract.customer, listing.id).toEqual({ kind: "owner", id: property?.ownerId });
      expect(contract.agentId, listing.id).toBe(listing.agentId);
      expect(contract.organizationId, listing.id).toBe(listing.organizationId);
    }
    expect(new Set(seed.contracts.map((contract) => contract.number)).size).toBe(seed.contracts.length);
  });

  it("resolves every reference and keeps the agent's organization", () => {
    for (const contract of seed.contracts) {
      expect(agents.has(contract.agentId), contract.id).toBe(true);
      expect(contract.organizationId, contract.id).toBe(agent(contract.agentId)?.organizationId);
      if (contract.organizationId) expect(organizations.has(contract.organizationId), contract.id).toBe(true);
      if (contract.listingId) expect(listings.has(contract.listingId), contract.id).toBe(true);
      if (contract.dealId) expect(deals.has(contract.dealId), contract.id).toBe(true);
      if (contract.requirementId) expect(requirements.has(contract.requirementId), contract.id).toBe(true);
      const customer = contract.customer;
      const set = customer.kind === "owner" ? owners : customer.kind === "client" ? clients : agents;
      expect(set.has(customer.id), contract.id).toBe(true);
      for (const holder of contract.rightHolderConsents) {
        const owner = seed.owners.find((item) => item.id === holder.ownerId);
        expect(owner, `${contract.id} → ${holder.ownerId}`).toBeDefined();
        if (holder.consentId) {
          expect(holder.status, contract.id).toBe("confirmed");
          expect(owner?.consents.map((consent) => consent.id), contract.id).toContain(holder.consentId);
        }
      }
      for (const signature of contract.signatures) {
        if (signature.party === "agent" || signature.party === "partner") {
          expect(agents.has(signature.signerName), contract.id).toBe(true);
        }
      }
    }
  });

  it("keeps statuses consistent with dates, signatures and right holders (art. 37)", () => {
    for (const contract of seed.contracts) {
      expect(contract.startsAt < contract.endsAt, contract.id).toBe(true);
      if (contract.kind === "owner_service") {
        expect(contract.rightHolderConsents.map((holder) => holder.ownerId), contract.id).toContain(
          contract.customer.id,
        );
      } else {
        expect(contract.rightHolderConsents, contract.id).toEqual([]);
      }
      const parties = new Set(contract.signatures.map((signature) => signature.party));
      // The other side signs as the customer, or as the partner on a co-broking agreement.
      const otherSide = contract.kind === "cooperation" ? "partner" : "customer";
      switch (contract.status) {
        case "active":
          expect(contract.endsAt > nowIso, contract.id).toBe(true);
          expect(parties.has("agent") && parties.has(otherSide), contract.id).toBe(true);
          // A signed property contract has every right holder's consent.
          expect(contract.rightHolderConsents.every((holder) => holder.status === "confirmed"), contract.id).toBe(true);
          break;
        case "expired":
          expect(contract.endsAt < nowIso, contract.id).toBe(true);
          break;
        case "terminated":
          expect(contract.terminatedAt && contract.terminationReason, contract.id).toBeTruthy();
          break;
        case "draft":
        case "awaiting_signature":
          expect(parties.has(otherSide), contract.id).toBe(false);
          break;
      }
      if (contract.status !== "terminated") expect(contract.terminatedAt, contract.id).toBeUndefined();
    }
  });

  it("covers every demo scenario the contract screens rely on", () => {
    const byNumber = (number: string) => seed.contracts.find((contract) => contract.number === number);
    const statuses = new Set(seed.contracts.map((contract) => contract.status));
    expect(statuses).toEqual(new Set(["draft", "awaiting_signature", "active", "expired", "terminated"]));
    expect(byNumber("DR-2026-061")?.rightHolderConsents).toContainEqual({ ownerId: "owner-34", status: "missing" });
    expect(byNumber("DR-2026-043")?.clauses.insuranceDetails).toBe(false);
    expect(byNumber("DR-2026-052")?.signatures.some((signature) => signature.method === "simple_electronic")).toBe(
      true,
    );
    const buyer = seed.contracts.filter(
      (contract) => contract.kind === "buyer_service" && contract.agentId === "agent-01",
    );
    expect(buyer.length).toBeGreaterThanOrEqual(2);
    for (const contract of buyer) {
      const client = seed.clients.find((item) => item.id === contract.customer.id);
      expect(client?.responsibleAgentId, contract.id).toBe("agent-01");
    }
    const cooperation = byNumber("CO-2026-004");
    const deal = seed.deals.find((item) => item.id === cooperation?.dealId);
    const request = seed.cooperationRequests.find((item) => item.id === deal?.cooperationId);
    expect(request?.status).toBe("accepted");
    expect(cooperation?.listingId).toBe(request?.listingId);
    expect([request?.fromAgentId, request?.toAgentId]).toContain(cooperation?.customer.id);
    // Money is integer minor units (§34.1).
    for (const contract of seed.contracts) {
      const { remuneration } = contract;
      if (remuneration.kind === "fixed") expect(Number.isSafeInteger(remuneration.amount?.amountMinor)).toBe(true);
      else expect(remuneration.percent, contract.id).toBeGreaterThan(0);
      expect(remuneration.paymentTerms.trim(), contract.id).toBeTruthy();
    }
  });
});

describe("calls and communications seed", () => {
  it("never keeps a transcript or AI summary without recording consent (§36.5)", () => {
    for (const call of seed.calls) {
      if (call.recording.consent !== "granted") {
        expect(call.transcript, call.id).toBeUndefined();
        expect(call.summary, call.id).toBeUndefined();
        expect(call.recording.available, call.id).toBe(false);
      }
      if (call.transcript) expect(call.recording.available, call.id).toBe(true);
      if (call.summary?.status === "confirmed") {
        expect(call.summary.confirmedAt && call.summary.confirmedById, call.id).toBeTruthy();
      } else if (call.summary) {
        expect(call.summary.confirmedAt, call.id).toBeUndefined();
      }
    }
    const consents = new Set(seed.calls.map((call) => call.recording.consent));
    expect(consents).toEqual(new Set(["granted", "refused", "not_requested"]));
    expect(seed.calls.filter((call) => call.summary?.status === "confirmed").length).toBe(1);
    expect(seed.calls.some((call) => call.summary?.extractedRequest)).toBe(true);
  });

  it("records missed and unanswered calls with zero duration", () => {
    for (const call of seed.calls) {
      if (call.outcome !== "answered") expect(call.durationSeconds, call.id).toBe(0);
      else expect(call.durationSeconds, call.id).toBeGreaterThan(0);
      if (call.outcome === "missed") expect(call.direction, call.id).toBe("inbound");
      expect(call.startedAt <= nowIso, call.id).toBe(true);
    }
  });

  it("resolves every call and communication reference", () => {
    for (const call of seed.calls) {
      expect(agents.has(call.agentId), call.id).toBe(true);
      if (call.leadId) expect(leads.has(call.leadId), call.id).toBe(true);
      if (call.clientId) expect(clients.has(call.clientId), call.id).toBe(true);
      if (call.ownerId) expect(owners.has(call.ownerId), call.id).toBe(true);
      if (call.listingId) expect(listings.has(call.listingId), call.id).toBe(true);
    }
    for (const item of seed.communications) {
      expect(agents.has(item.agentId), item.id).toBe(true);
      const subjects = [item.clientId, item.ownerId, item.leadId].filter(Boolean);
      expect(subjects.length, item.id).toBe(1);
      if (item.clientId) expect(clients.has(item.clientId), item.id).toBe(true);
      if (item.ownerId) expect(owners.has(item.ownerId), item.id).toBe(true);
      if (item.leadId) expect(leads.has(item.leadId), item.id).toBe(true);
      expect(item.at <= nowIso, item.id).toBe(true);
    }
  });

  it("ties phone touchpoints to their call and links only Telegram originals", () => {
    for (const item of seed.communications) {
      if (item.channel === "phone") {
        const call = seed.calls.find((candidate) => candidate.id === item.callId);
        expect(call, item.id).toBeDefined();
        expect([call?.clientId, call?.ownerId, call?.leadId], item.id).toEqual([
          item.clientId,
          item.ownerId,
          item.leadId,
        ]);
        expect(call?.agentId, item.id).toBe(item.agentId);
        expect(call?.startedAt, item.id).toBe(item.at);
      } else {
        expect(item.callId, item.id).toBeUndefined();
      }
      if (item.originalUrl) {
        expect(item.channel, item.id).toBe("telegram");
        expect(item.originalUrl, item.id).toMatch(/^https:\/\/t\.me\/[a-z0-9_]+_demo$/);
      }
    }
    expect(new Set(seed.communications.map((item) => item.channel))).toEqual(
      new Set(["phone", "telegram", "whatsapp", "instagram", "email", "meeting"]),
    );
  });
});

describe("team and routing seed", () => {
  it("builds teams of one organization with the lead among the members", () => {
    for (const team of seed.teams) {
      expect(organizations.has(team.organizationId), team.id).toBe(true);
      expect(team.memberIds, team.id).toContain(team.leadAgentId);
      for (const memberId of team.memberIds) expect(agent(memberId)?.organizationId, team.id).toBe(team.organizationId);
    }
  });

  it("gives every Demo Realty agent an availability entry", () => {
    const orgAgents = seed.agents.filter((item) => item.organizationId === "org-01").map((item) => item.id);
    expect(seed.agentAvailability.map((entry) => entry.agentId).sort()).toEqual(orgAgents.sort());
    const statuses = seed.agentAvailability.map((entry) => entry.status);
    expect(statuses).toContain("away");
    expect(statuses).toContain("busy");
    for (const entry of seed.agentAvailability) {
      if (entry.status === "away") expect(entry.awayUntil && entry.awayUntil > nowIso, entry.agentId).toBeTruthy();
    }
  });

  it("keeps routing rules consistent with their strategy", () => {
    for (const rule of seed.routingRules) {
      for (const agentId of rule.agentIds) expect(agent(agentId)?.organizationId, rule.id).toBe(rule.organizationId);
      if (rule.strategy === "manual") expect(rule.agentIds, rule.id).toEqual([]);
      else expect(rule.agentIds.length, rule.id).toBeGreaterThan(0);
      if (rule.strategy === "fixed_agent") expect(rule.agentIds.length, rule.id).toBe(1);
    }
    expect(new Set(seed.routingRules.map((rule) => rule.priority)).size).toBe(seed.routingRules.length);
    expect(seed.routingRules.some((rule) => !rule.active)).toBe(true);
    const catchAll = [...seed.routingRules].sort((a, b) => b.priority - a.priority)[0];
    expect(catchAll.when).toEqual({});
  });
});

describe("organization audit log seed", () => {
  it("is append-only and in time order, up to the demo now", () => {
    const times = seed.orgAuditLog.map((event) => event.at);
    expect([...times].sort()).toEqual(times);
    expect(times.every((at) => at <= nowIso)).toBe(true);
    expect(seed.orgAuditLog.length).toBeGreaterThanOrEqual(40);
  });

  it("uses known actions and targets that resolve", () => {
    const documents = new Set(seed.deals.flatMap((deal) => deal.documents.map((doc) => doc.id)));
    const consents = new Set([
      ...seed.clients.flatMap((client) => client.consents.map((consent) => consent.id)),
      ...seed.owners.flatMap((owner) => owner.consents.map((consent) => consent.id)),
    ]);
    const byKind: Partial<Record<(typeof ORG_AUDIT_TARGET_KINDS)[number], Set<ID>>> = {
      lead: leads,
      client: clients,
      owner: owners,
      listing: listings,
      contract: ids(seed.contracts),
      document: documents,
      agent: agents,
      consent: consents,
      cooperation: ids(seed.cooperationRequests),
      deal: deals,
    };
    for (const event of seed.orgAuditLog) {
      expect(ORG_AUDIT_ACTIONS as readonly string[], event.id).toContain(event.action);
      expect(ORG_AUDIT_TARGET_KINDS as readonly string[], event.id).toContain(event.target.kind);
      if (event.actorId !== SYSTEM_ACTOR_ID) expect(agents.has(event.actorId), event.id).toBe(true);
      const set = byKind[event.target.kind as keyof typeof byKind];
      if (set) expect(set.has(event.target.id), `${event.id} → ${event.target.id}`).toBe(true);
    }
    expect(new Set(seed.orgAuditLog.map((event) => event.action))).toEqual(new Set(ORG_AUDIT_ACTIONS));
  });

  it("gives reasons where the master document requires them", () => {
    const needsReason = new Set([
      "responsible_changed",
      "contact_revealed",
      "owner_contact_viewed",
      "restricted_document_viewed",
      "export_requested",
      "permission_granted",
      "permission_revoked",
      "role_changed",
      "lead_assigned",
      "merge_undone",
    ]);
    for (const event of seed.orgAuditLog) {
      if (needsReason.has(event.action)) expect(event.reason?.trim(), event.id).toBeTruthy();
    }
    // Automatic assignments name the rule that made them.
    for (const event of seed.orgAuditLog.filter((item) => item.action === "lead_assigned" && item.actorId === SYSTEM_ACTOR_ID)) {
      const ruleIds = seed.routingRules.map((rule) => rule.id);
      expect(ruleIds.some((id) => event.reason?.includes(id)), event.id).toBe(true);
      const lead = seed.leads.find((item) => item.id === event.target.id);
      expect(event.reason, event.id).toContain(`→ ${lead?.assignedAgentId}`);
    }
  });

  it("records the viewer's new-device login on the demo day, like the security notification", () => {
    const login = seed.orgAuditLog.find((event) => event.action === "login_new_device" && event.actorId === "agent-01");
    expect(login && tashkentDateKey(login.at)).toBe(tashkentDateKey(now()));
  });
});
