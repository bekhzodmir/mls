import { describe, expect, it } from "vitest";
import * as repo from "./repository";
import { seed, VIEWER_AGENT_ID } from "./seed";
import { SYSTEM_ACTOR_ID } from "./views";

/**
 * Contracts, consents, owners, calls, verification, team, partners, audit
 * and offers: what the viewer (agent-01, agency agent at Demo Realty) may see.
 */

const PHONE = /\+?998\d{9}/;
const idsOf = <T>(items: T[], id: (item: T) => string) => items.map(id);

describe("contracts", () => {
  it("lists the organization's contracts only — never a partner's", async () => {
    const all = await repo.listContracts();
    expect(all.length).toBeGreaterThan(20);
    expect(all.every((view) => view.contract.organizationId === "org-01")).toBe(true);
    expect(new Set(all.map((view) => view.scope))).toEqual(new Set(["own", "agency"]));
    for (const view of all) expect(view.scope === "own", view.contract.id).toBe(view.contract.agentId === VIEWER_AGENT_ID);
    // Partner agency and individual realtor contracts do not exist for the viewer.
    expect(await repo.getContract("ctr-ne-2026-131")).toBeUndefined();
    expect(await repo.getContract("ctr-mn-2026-009")).toBeUndefined();
    expect(await repo.getContractByNumber("TM-2026-074")).toBeUndefined();
    expect(all.map((view) => view.contract.id)).not.toContain("ctr-tm-2026-074");
  });

  it("finds the contract behind a listing's contract number", async () => {
    for (const listing of seed.listings.filter((item) => item.organizationId === "org-01" && item.contractId)) {
      const contract = await repo.getContractByNumber(listing.contractId ?? "");
      expect(contract?.contract.listingId, listing.id).toBe(listing.id);
      expect(contract?.contract.endsAt, listing.id).toBe(listing.contractExpiresAt);
    }
  });

  it("flags contracts ending within 14 Tashkent days, matching the Today block", async () => {
    const expiring = await repo.listContracts({ status: "expiring" });
    expect(expiring.map((view) => [view.contract.number, view.daysLeft])).toEqual([
      ["DR-2026-055", 5],
      ["DR-2026-041", 10],
      ["DR-2026-052", 13],
    ]);
    expect(expiring.every((view) => view.expiring && view.contract.status === "active")).toBe(true);
    const feed = await repo.getTodayFeed();
    for (const item of feed.expiringContracts) {
      const contract = await repo.getContractByNumber(item.view.listing.contractId ?? "");
      expect(contract?.expiring, item.view.listing.id).toBe(true);
      expect(contract?.daysLeft, item.view.listing.id).toBe(item.daysLeft);
    }
    const expired = await repo.listContracts({ status: "expired" });
    expect(expired.map((view) => view.contract.number)).toEqual(["DR-2026-019"]);
    expect(expired[0].daysLeft).toBeLessThan(0);
    expect(expired[0].expiring).toBe(false);
  });

  it("shows owner contacts only with the right to owner data (§34.2)", async () => {
    const all = await repo.listContracts();
    for (const view of all) {
      if (view.customer.kind !== "owner") continue;
      if (view.scope === "own") {
        expect(view.customer.phone, view.contract.id).toMatch(PHONE);
      } else {
        expect(view.customer.phone, view.contract.id).toBeUndefined();
        expect(view.customer.contactHidden, view.contract.id).toBe("owner_data_permission");
      }
    }
    const colleague = await repo.getContract("ctr-dr-2026-047");
    expect(colleague?.scope).toBe("agency");
    expect(JSON.stringify(colleague?.customer)).not.toMatch(PHONE);
    expect(colleague?.listing?.ownerData).toBe(false);
  });

  it("exposes the compliance facts the contract screen warns about", async () => {
    const draft = await repo.getContract("ctr-dr-2026-061");
    expect(draft?.contract.status).toBe("awaiting_signature");
    expect(draft?.missingConsents).toBe(1);
    expect(draft?.rightHolders.map((holder) => [holder.ownerId, holder.status, holder.isCustomer])).toEqual([
      ["owner-33", "confirmed", true],
      ["owner-34", "missing", false],
    ]);
    expect(draft?.rightHolders[0].consent?.id).toBe("cons-owner-33-listing");
    expect((await repo.getContract("ctr-dr-2026-043"))?.missingClauses).toEqual(["insuranceDetails"]);
    expect((await repo.getContract("ctr-dr-2026-052"))?.hasSimpleElectronicSignature).toBe(true);
    expect((await repo.getContract("ctr-dr-2026-041"))?.hasSimpleElectronicSignature).toBe(false);
    const renewal = await repo.getContract("ctr-dr-2026-055");
    expect(renewal?.related.map((view) => view.contract.id)).toEqual(["ctr-dr-2026-062"]);
  });

  it("links a co-broking agreement to its accepted request and deal", async () => {
    const agreement = await repo.getContract("ctr-co-2026-004");
    expect(agreement?.contract.kind).toBe("cooperation");
    expect(agreement?.cooperation?.request.id).toBe("coop-01");
    expect(agreement?.deal?.deal.id).toBe("deal-06");
    // Contacts are shared after the accepted cooperation.
    expect(agreement?.customer.phone).toMatch(PHONE);
    const buyer = await repo.getContract("ctr-drb-2026-011");
    expect(buyer?.customer).toMatchObject({ kind: "client", id: "cl-06" });
    expect(buyer?.deal?.deal.id).toBe("deal-02");
    expect(buyer?.requirement?.id).toBe("req-07");
  });

  it("filters by kind, status and free text", async () => {
    const buyer = await repo.listContracts({ kind: "buyer_service" });
    expect(buyer.length).toBeGreaterThanOrEqual(2);
    expect(buyer.every((view) => view.contract.kind === "buyer_service")).toBe(true);
    expect((await repo.listContracts({ status: "terminated" })).map((view) => view.contract.number)).toEqual([
      "DRB-2026-003",
    ]);
    expect((await repo.listContracts({ q: "DR-2026-043" })).map((view) => view.contract.id)).toEqual([
      "ctr-dr-2026-043",
    ]);
    expect((await repo.listContracts({ q: "Цой" })).map((view) => view.contract.id)).toEqual(["ctr-dr-2026-038"]);
    // A colleague's owner cannot be found by the hidden phone.
    expect(await repo.listContracts({ q: "0212" })).toEqual([]);
  });
});

describe("consent registry", () => {
  it("lists consents of the organization's clients and linked owners only", async () => {
    const items = await repo.listConsents();
    const clientIds = new Set(items.filter((item) => item.subject.kind === "client").map((item) => item.subject.id));
    const ownerIds = new Set(items.filter((item) => item.subject.kind === "owner").map((item) => item.subject.id));
    expect(clientIds.has("cl-15")).toBe(false);
    expect(clientIds.has("cl-16")).toBe(false);
    expect(clientIds.has("cl-18")).toBe(true);
    expect(ownerIds.has("owner-15")).toBe(false);
    expect(ownerIds.has("owner-33")).toBe(true);
    for (const item of items) {
      expect(item.state).toBe(item.consent.revokedAt ? "revoked" : "active");
      expect(item.responsibleAgent.organizationId).toBe("org-01");
    }
  });

  it("filters by subject, purpose and state", async () => {
    const revoked = await repo.listConsents({ state: "revoked" });
    expect(revoked.map((item) => item.consent.id).sort()).toEqual(["cons-cl-11-contact", "cons-cl-18-marketing"]);
    expect((await repo.listConsents({ subject: "owner" })).every((item) => item.subject.kind === "owner")).toBe(true);
    const contact = await repo.listConsents({ purpose: "contact", subject: "client" });
    expect(contact.length).toBeGreaterThan(5);
    expect(contact.every((item) => item.consent.purpose === "contact")).toBe(true);
  });
});

describe("owners", () => {
  it("lists owners of the organization's listings and right holders, own first", async () => {
    const owners = await repo.listOwners();
    const ids = owners.map((item) => item.owner.id);
    expect(ids).toContain("owner-34");
    expect(ids).toContain("owner-12");
    // Partner-only owners are not visible (a masked listing hides its owner).
    for (const id of ["owner-15", "owner-16", "owner-17", "owner-22", "owner-28"]) expect(ids).not.toContain(id);
    const firstAgency = owners.findIndex((item) => item.scope === "agency");
    expect(owners.slice(firstAgency).every((item) => item.scope === "agency")).toBe(true);
    expect(owners.find((item) => item.owner.id === "owner-34")?.rightHolderOnly).toBe(true);
  });

  it("hides contacts without the right to owner data and says why", async () => {
    for (const item of await repo.listOwners()) {
      if (item.contactVisible) {
        expect(item.owner.phone, item.owner.id).toMatch(PHONE);
        expect(item.contactHidden).toBeUndefined();
      } else {
        expect(item.owner.phone, item.owner.id).toBeUndefined();
        expect(item.contactHidden).toBe("owner_data_permission");
      }
    }
    const colleague = await repo.getOwner("owner-12");
    expect(colleague?.scope).toBe("agency");
    expect(JSON.stringify(colleague)).not.toContain("+998910000212");
    // Only the organization's listing, not the partner's lst-30 on the same flat.
    expect(colleague?.listings.map((view) => view.listing.id)).toEqual(["lst-12"]);
    expect(colleague?.properties[0]?.ownerId).toBeUndefined();
    // The colleague's call and timeline entry stay with the colleague.
    expect(colleague?.calls).toEqual([]);
    expect(colleague?.communications).toEqual([]);
    expect(await repo.getOwner("owner-15")).toBeUndefined();
  });

  it("searches by name and visible phone only", async () => {
    expect((await repo.listOwners({ q: "Норматов" })).map((item) => item.owner.id).sort()).toEqual([
      "owner-33",
      "owner-34",
    ]);
    expect((await repo.listOwners({ q: "0201" })).map((item) => item.owner.id)).toEqual(["owner-01"]);
    expect(await repo.listOwners({ q: "0212" })).toEqual([]);
    expect((await repo.listOwners({ q: "Мирзо-Улугбек" })).map((item) => item.owner.id)).toContain("owner-33");
  });

  it("builds the owner profile from everything linked to the owner", async () => {
    const owner = await repo.getOwner("owner-06");
    expect(owner?.contactVisible).toBe(true);
    expect(owner?.contracts.map((view) => view.contract.id)).toEqual(["ctr-dr-2026-055", "ctr-dr-2026-062"]);
    expect(owner?.calls.map((view) => view.call.id)).toEqual(["call-06"]);
    expect(owner?.communications.map((view) => view.communication.id)).toEqual(["comm-24"]);
    expect(owner?.verification.every((item) => item.target.kind === "listing")).toBe(true);
    expect(owner?.lastContactAt).toBe(seed.calls.find((call) => call.id === "call-06")?.startedAt);
    const coOwner = await repo.getOwner("owner-34");
    expect(coOwner?.properties.map((property) => property.id)).toEqual(["prop-33"]);
    expect(coOwner?.contracts.map((view) => view.contract.number)).toEqual(["DR-2026-061"]);
  });
});

describe("calls and communications", () => {
  it("lists only the viewer's own calls, newest first", async () => {
    const calls = await repo.listCalls();
    expect(calls.length).toBe(seed.calls.filter((call) => call.agentId === VIEWER_AGENT_ID).length);
    expect(calls.every((view) => view.call.agentId === VIEWER_AGENT_ID)).toBe(true);
    const times = calls.map((view) => view.call.startedAt);
    expect([...times].sort().reverse()).toEqual(times);
    expect(await repo.getCall("call-15")).toBeUndefined();
    expect(await repo.getCall("call-16")).toBeUndefined();
  });

  it("keeps transcripts and AI summaries to calls with recording consent", async () => {
    for (const view of await repo.listCalls()) {
      if (view.call.recording.consent !== "granted") {
        expect(view.call.transcript, view.call.id).toBeUndefined();
        expect(view.call.summary, view.call.id).toBeUndefined();
      }
    }
    const confirmed = await repo.getCall("call-05");
    expect(confirmed?.call.summary?.status).toBe("confirmed");
    const draft = await repo.getCall("call-02");
    expect(draft?.call.summary).toMatchObject({
      status: "draft",
      extractedRequest: "2–3 комнаты в Юнусабаде до 90 тысяч долларов",
    });
  });

  it("suggests records for unattached numbers and offers a lead for unknown ones", async () => {
    const unknown = await repo.listCalls({ linked: "unknown" });
    expect(idsOf(unknown, (view) => view.call.id).sort()).toEqual(["call-02", "call-03", "call-10"]);
    const byId = Object.fromEntries(unknown.map((view) => [view.call.id, view]));
    expect(byId["call-02"].unknownNumber).toBe(true);
    expect(byId["call-02"].phoneMatches).toEqual([]);
    expect(byId["call-03"].phoneMatches).toEqual([{ kind: "lead", id: "lead-04" }]);
    expect(byId["call-10"].phoneMatches).toEqual([
      { kind: "lead", id: "lead-12", name: "Мадина Эргашева" },
      { kind: "client", id: "cl-11", name: "Madina Ergasheva" },
    ]);
    const linked = await repo.listCalls({ linked: "linked" });
    expect(linked.every((view) => view.linked && view.phoneMatches.length === 0 && !view.unknownNumber)).toBe(true);
    expect(linked.length + unknown.length).toBe((await repo.listCalls()).length);
  });

  it("filters calls by direction and outcome", async () => {
    const missed = await repo.listCalls({ outcome: "missed" });
    expect(missed.map((view) => view.call.id).sort()).toEqual(["call-01", "call-10"]);
    expect(missed.every((view) => view.call.direction === "inbound")).toBe(true);
    const outbound = await repo.listCalls({ direction: "outbound" });
    expect(outbound.every((view) => view.call.direction === "outbound")).toBe(true);
  });

  it("opens a call with the party's other touchpoints", async () => {
    const call = await repo.getCall("call-05");
    expect(call?.client?.id).toBe("cl-01");
    expect(call?.linked).toEqual({ kind: "client", id: "cl-01", name: "Санжар Ибрагимов" });
    expect(call?.communications.map((view) => view.communication.id)).toEqual(["comm-02", "comm-01"]);
    const lead = await repo.getCall("call-01");
    expect(lead?.lead?.lead.id).toBe("lead-02");
    expect(lead?.communications).toEqual([]);
    const owner = await repo.getCall("call-06");
    expect(owner?.owner?.owner.id).toBe("owner-06");
    expect(owner?.listing?.listing.id).toBe("lst-06");
    const unknown = await repo.getCall("call-02");
    expect(unknown?.communications).toEqual([]);
    expect(unknown?.otherCalls).toEqual([]);
  });

  it("returns the viewer's own timeline, newest first", async () => {
    const timeline = await repo.listCommunications({ clientId: "cl-01" });
    expect(timeline.map((view) => view.communication.id)).toEqual(["comm-03", "comm-02", "comm-01"]);
    expect(timeline[0].call?.id).toBe("call-05");
    expect(timeline[0].subject).toEqual({ kind: "client", id: "cl-01", name: "Санжар Ибрагимов" });
    // Colleagues' entries and their clients' timelines are not shown.
    expect(await repo.listCommunications({ ownerId: "owner-12" })).toEqual([]);
    expect(await repo.listCommunications({ clientId: "cl-17" })).toEqual([]);
    const all = await repo.listCommunications();
    expect(all.every((view) => view.communication.agentId === VIEWER_AGENT_ID)).toBe(true);
    const telegram = await repo.listCommunications({ channel: "telegram" });
    expect(telegram.length).toBeGreaterThan(0);
    expect(telegram.every((view) => view.communication.originalUrl?.startsWith("https://t.me/"))).toBe(true);
    expect((await repo.listCommunications({ leadId: "lead-05" })).map((view) => view.communication.id)).toEqual([
      "comm-31",
    ]);
  });
});

describe("verification center", () => {
  it("aggregates the organization's listings, agents and organization", async () => {
    const queue = await repo.listVerificationQueue();
    const kinds = new Set(queue.map((item) => item.target.kind));
    expect(kinds).toEqual(new Set(["listing", "agent", "organization"]));
    const agents = await repo.listVerificationQueue({ target: "agent" });
    expect(new Set(agents.map((item) => item.target.kind === "agent" && item.target.agent.organizationId))).toEqual(
      new Set(["org-01"]),
    );
    expect(new Set(queue.map((item) => item.key)).size).toBe(queue.length);
  });

  it("shows partner listings the viewer works on as result only", async () => {
    const partner = (await repo.listVerificationQueue({ target: "listing" })).filter(
      (item) => item.scope === "partner",
    );
    const listingIds = new Set(partner.map((item) => (item.target.kind === "listing" ? item.target.view.listing.id : "")));
    expect(listingIds.has("lst-15")).toBe(true); // deal-06
    expect(listingIds.has("lst-16")).toBe(false); // no deal or cooperation with the viewer
    for (const item of partner) {
      expect(item.detailed).toBe(false);
      expect(item.item.source, item.key).toBeUndefined();
      expect(item.item.note, item.key).toBeUndefined();
    }
    // Colleagues' listings and profiles follow the same result-only rule.
    const colleague = (await repo.listVerificationQueue()).find((item) => item.key === "agent:agent-03:ver-agent-03-certificate");
    expect(colleague?.detailed).toBe(false);
    expect(colleague?.item.source).toBeUndefined();
    const own = (await repo.listVerificationQueue()).find((item) => item.key === "listing:lst-03:ver-lst-03-encumbrance");
    expect(own?.detailed).toBe(true);
    expect(own?.item.source).toBeDefined();
  });

  it("puts what needs attention first and flags expiring evidence", async () => {
    const queue = await repo.listVerificationQueue();
    const rank = (item: (typeof queue)[number]) =>
      item.item.status === "problem"
        ? 0
        : item.expired
          ? 1
          : item.item.status === "unavailable"
            ? 2
            : item.item.status === "pending"
              ? 3
              : item.expiresSoon
                ? 4
                : 5;
    const ranks = queue.map(rank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    const soon = queue.filter((item) => item.expiresSoon).map((item) => item.key);
    expect(soon).toEqual(["listing:lst-03:ver-lst-03-ownership", "listing:lst-11:ver-lst-11-ownership"]);
    // `unavailable` is never shown as confirmed (§16.4).
    const unavailable = await repo.listVerificationQueue({ status: "unavailable" });
    expect(unavailable.length).toBeGreaterThan(0);
    expect(unavailable.every((item) => !item.expiresSoon && !item.expired)).toBe(true);
    const subject = await repo.listVerificationQueue({ subject: "ownership" });
    expect(subject.every((item) => item.item.subject === "ownership")).toBe(true);
  });
});

describe("team and routing", () => {
  it("returns the viewer's team with workload computed from the records", async () => {
    const team = await repo.getMyTeam();
    expect(team?.team.id).toBe("team-01");
    expect(team?.lead.id).toBe("agent-02");
    expect(team?.members.map((member) => member.agent.id)).toEqual(["agent-02", "agent-01", "agent-03"]);
    const byId = Object.fromEntries((team?.members ?? []).map((member) => [member.agent.id, member]));
    expect(byId["agent-01"].isViewer).toBe(true);
    expect(byId["agent-02"].isLead).toBe(true);
    expect(byId["agent-03"].availability.status).toBe("away");
    expect(byId["agent-02"].availability.status).toBe("busy");
    // lead-14 was routed to Timur while he is away: the SLA is breached.
    expect(byId["agent-03"].metrics.slaBreaches).toBe(1);
    expect(byId["agent-02"].metrics.viewingsThisWeek).toBe(1);
    expect(byId["agent-01"].metrics.dealsInProgress).toBe(6);
    for (const member of team?.members ?? []) {
      expect(member.capacityLeft).toBe(
        Math.max(0, member.availability.dailyLeadCapacity - member.metrics.newLeadsToday),
      );
    }
    const sum = (key: keyof NonNullable<typeof team>["totals"]) =>
      (team?.members ?? []).reduce((total, member) => total + member.metrics[key], 0);
    expect(team?.totals.openLeads).toBe(sum("openLeads"));
    expect(team?.totals.activeListings).toBe(sum("activeListings"));
  });

  it("opens organization members only", async () => {
    const member = await repo.getTeamMember("agent-03");
    expect(member?.team?.id).toBe("team-01");
    expect(member?.routingRules.map((rule) => rule.id)).toEqual(["rule-01", "rule-05", "rule-99"]);
    expect(member?.listings.every((view) => view.listing.agentId === "agent-03" && view.access === "agency")).toBe(true);
    const owner = await repo.getTeamMember("agent-10");
    expect(owner?.team).toBeUndefined();
    expect(owner?.isLead).toBe(false);
    expect(await repo.getTeamMember("agent-04")).toBeUndefined();
  });

  it("feeds the routing simulator with rules, availability, workload and the unassigned queue", async () => {
    const context = await repo.getRoutingContext();
    expect(context.rules.map((rule) => rule.id)).toEqual(["rule-01", "rule-02", "rule-03", "rule-04", "rule-05", "rule-99"]);
    expect(context.rules.every((rule) => rule.organizationId === "org-01")).toBe(true);
    const agentIds = context.agents.map((agent) => agent.id);
    expect(agentIds).toEqual(["agent-01", "agent-02", "agent-03", "agent-10"]);
    expect(context.availability.map((entry) => entry.agentId)).toEqual(agentIds);
    expect(context.workloadToday.map((entry) => entry.agentId)).toEqual(agentIds);
    for (const entry of context.workloadToday) {
      expect(entry.remaining).toBe(Math.max(0, entry.capacity - entry.assignedToday));
    }
    expect(context.workloadToday.find((entry) => entry.agentId === "agent-03")?.awayUntil).toBeDefined();
    expect(context.unassignedLeads.map((view) => view.lead.id)).toEqual(["lead-04", "lead-06", "lead-01"]);
    expect(context.unassignedLeads.every((view) => !view.lead.assignedAgentId)).toBe(true);
  });
});

describe("partners", () => {
  it("lists professionals outside the organization with cooperation stats", async () => {
    const partners = await repo.listPartners();
    const ids = partners.map((item) => item.agent.id);
    expect(ids.sort()).toEqual(["agent-04", "agent-05", "agent-06", "agent-07", "agent-08", "agent-09"]);
    const byId = Object.fromEntries(partners.map((item) => [item.agent.id, item]));
    expect(byId["agent-07"].cooperation).toEqual({ total: 2, accepted: 0, declined: 1, inProgress: 0, other: 1 });
    expect(byId["agent-08"].cooperation).toMatchObject({ accepted: 1, inProgress: 1 });
    expect(byId["agent-09"].cooperation.total).toBe(0);
    expect(byId["agent-05"].activeMlsListings).toBeGreaterThan(0);
  });

  it("never exposes a partner's phone without an accepted cooperation", async () => {
    for (const item of await repo.listPartners()) {
      const raw = seed.agents.find((agent) => agent.id === item.agent.id);
      const json = JSON.stringify(item);
      if (item.contactsShared) {
        expect(item.agent.phone).toBe(raw?.phone);
      } else {
        expect(item.contactHidden).toBe("no_accepted_cooperation");
        expect(json, item.agent.id).not.toContain(raw?.phone ?? "");
        if (raw?.telegramUsername) expect(json, item.agent.id).not.toContain(raw.telegramUsername);
      }
      for (const fact of item.agent.verifications) expect(fact.source, item.agent.id).toBeUndefined();
    }
    expect((await repo.listPartners()).filter((item) => item.contactsShared).map((item) => item.agent.id).sort()).toEqual(
      ["agent-04", "agent-08"],
    );
    const masked = await repo.getPartner("agent-06");
    expect(JSON.stringify(masked)).not.toContain("+998900000106");
    expect(masked?.cooperationHistory.map((view) => view.request.id)).toEqual(["coop-02"]);
    expect(masked?.listings.length).toBeGreaterThan(0);
    for (const view of masked?.listings ?? []) {
      if (view.access === "partner_masked") expect(view.property.address).toBeUndefined();
    }
  });

  it("opens a partner with listings, cooperation history and deals", async () => {
    const partner = await repo.getPartner("agent-04");
    expect(partner?.contactsShared).toBe(true);
    expect(partner?.deals.map((deal) => deal.id)).toEqual(["deal-06"]);
    expect(partner?.cooperationHistory.map((view) => view.request.id)).toEqual(["coop-01"]);
    expect(partner?.organization?.id).toBe("org-02");
    expect(partner?.organization?.insurance?.source).toBeUndefined();
    expect(await repo.getPartner("agent-02")).toBeUndefined();
    expect(await repo.getPartner(VIEWER_AGENT_ID)).toBeUndefined();
    expect((await repo.listPartners({ q: "Namuna" })).map((item) => item.agent.id).sort()).toEqual([
      "agent-04",
      "agent-05",
    ]);
  });
});

describe("audit", () => {
  it("merges the organization journal with deal histories, newest first", async () => {
    const events = await repo.listAuditEvents();
    const dealEvents = seed.deals.reduce((total, deal) => total + deal.audit.length, 0);
    expect(events.length).toBe(seed.orgAuditLog.length + dealEvents);
    const times = events.map((view) => view.event.at);
    expect([...times].sort().reverse()).toEqual(times);
    expect(new Set(events.map((view) => view.log))).toEqual(new Set(["organization", "deal"]));
    for (const view of events.filter((item) => item.log === "deal")) expect(view.dealId).toBeDefined();
  });

  it("labels targets without restricted values", async () => {
    for (const view of await repo.listAuditEvents()) {
      expect(view.target.label.trim(), view.event.id).toBeTruthy();
      expect(view.target.label, view.event.id).not.toMatch(PHONE);
      expect(view.target.label, view.event.id).not.toMatch(/кв\.\s*\d/);
      if (view.system) {
        expect(view.event.actorId).toBe(SYSTEM_ACTOR_ID);
        expect(view.actor).toBeUndefined();
      } else {
        expect(view.actor?.id, view.event.id).toBe(view.event.actorId);
      }
    }
    const document = (await repo.listAuditEvents({ targetKind: "document" })).find(
      (view) => view.event.target.id === "doc-deal-03-3",
    );
    expect(document?.target.documentType).toBe("passport_copy");
  });

  it("marks sensitive events and tells their scope relative to the viewer", async () => {
    const events = await repo.listAuditEvents();
    const sensitive = await repo.listAuditEvents({ sensitiveOnly: true });
    expect(sensitive.length).toBeGreaterThan(5);
    expect(sensitive.every((view) => view.sensitive)).toBe(true);
    for (const action of ["owner_contact_viewed", "export_requested", "role_changed", "document.viewed"]) {
      expect(events.filter((view) => view.event.action === action).every((view) => view.sensitive), action).toBe(true);
    }
    expect(events.filter((view) => view.event.action === "contract_signed").some((view) => view.sensitive)).toBe(false);
    expect(new Set(events.map((view) => view.scope))).toEqual(new Set(["own", "team", "agency"]));
    for (const view of events) expect(view.scope, view.event.id).toBe(repo.auditScope(view.event));
    expect(events.filter((view) => view.event.actorId === VIEWER_AGENT_ID).every((view) => view.scope === "own")).toBe(
      true,
    );
    const ownerExport = events.find((view) => view.event.target.id === "export-2026-09-24-02");
    expect(ownerExport?.scope).toBe("agency");
    const teamLead = events.find((view) => view.event.target.id === "export-2026-09-29-01");
    expect(teamLead?.scope).toBe("team");
    // A colleague changing the viewer's own client is still the viewer's history.
    const responsible = events.find((view) => view.event.action === "responsible_changed" && view.event.target.id === "cl-10");
    expect(responsible?.scope).toBe("own");
  });

  it("filters by actor, action and target kind", async () => {
    const byActor = await repo.listAuditEvents({ actorId: "agent-10" });
    expect(byActor.length).toBeGreaterThan(0);
    expect(byActor.every((view) => view.event.actorId === "agent-10")).toBe(true);
    const assigned = await repo.listAuditEvents({ action: "lead_assigned" });
    expect(assigned.every((view) => view.event.action === "lead_assigned" && view.event.reason)).toBe(true);
    const contracts = await repo.listAuditEvents({ targetKind: "contract" });
    expect(contracts.every((view) => view.target.label.match(/^(DR|DRB|CO)-2026-\d{3}$/))).toBe(true);
  });
});

describe("offers", () => {
  it("carry listing, client, deal, latest version and whose answer is awaited", async () => {
    const offers = await repo.listOffers();
    expect(offers.length).toBeGreaterThan(0);
    for (const view of offers) {
      expect(view.latest).toEqual(view.offer.versions[view.offer.versions.length - 1]);
      if (view.offer.dealId) expect(view.deal?.id).toBe(view.offer.dealId);
      if (view.offer.status === "accepted") expect(view.awaitingSide).toBeUndefined();
    }
    const byId = Object.fromEntries(offers.map((view) => [view.offer.id, view]));
    expect(byId["offer-01"].awaitingSide).toBe("owner");
    expect(byId["offer-01"].deal?.stage).toBe("negotiation");
    expect(byId["offer-05"].awaitingSide).toBe("buyer");
    expect(byId["offer-05"].deal).toBeUndefined();
    expect((await repo.listOffers({ status: "countered" })).map((view) => view.offer.id).sort()).toEqual([
      "offer-01",
      "offer-05",
    ]);
  });
});

describe("new repository functions", () => {
  it("are deterministic and return copies", async () => {
    expect(await repo.listContracts()).toEqual(await repo.listContracts());
    expect(await repo.listVerificationQueue()).toEqual(await repo.listVerificationQueue());
    expect(await repo.listAuditEvents()).toEqual(await repo.listAuditEvents());
    expect(await repo.getMyTeam()).toEqual(await repo.getMyTeam());
    const contract = await repo.getContract("ctr-dr-2026-041");
    if (!contract) throw new Error("ctr-dr-2026-041 must be visible");
    contract.contract.signatures.length = 0;
    contract.contract.endsAt = "2000-01-01T00:00:00.000Z";
    const again = await repo.getContract("ctr-dr-2026-041");
    expect(again?.contract.signatures.length).toBe(2);
    expect(again?.contract.endsAt).toBe(seed.listings.find((listing) => listing.id === "lst-01")?.contractExpiresAt);
    expect(Object.isFrozen(seed.contracts[0].signatures)).toBe(true);
  });
});
