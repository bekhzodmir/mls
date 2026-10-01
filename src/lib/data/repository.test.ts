import { describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import { validateTerms } from "@/lib/domain/commission";
import { districts } from "@/lib/domain/geo";
import { listingStatusRules } from "@/lib/domain/lifecycle";
import { toMajor } from "@/lib/domain/money";
import { normalizeUzPhone } from "@/lib/domain/phone";
import { foldText } from "@/lib/domain/text";
import type { CommissionTerms, ID, ParsedListingFields } from "@/lib/domain/types";
import { addWorkingDays, tashkentDateKey } from "@/lib/domain/working-days";
import { publicContacts } from "@/lib/site";
import * as repo from "./repository";
import { seed, VIEWER_AGENT_ID } from "./seed";
import { CHECKLIST_LABEL_KEYS } from "./views";

const ids = (items: readonly { id: ID }[]) => new Set(items.map((item) => item.id));

/** Every id in the dataset, including nested records. */
function allIds(): string[] {
  const out: string[] = [];
  const add = (items: readonly { id: ID }[]) => items.forEach((item) => out.push(item.id));
  add(seed.organizations);
  seed.organizations.forEach((org) => add([org.registry, org.insurance].filter((item) => item !== undefined)));
  add(seed.agents);
  seed.agents.forEach((agent) => add(agent.verifications));
  add(seed.owners);
  seed.owners.forEach((owner) => add(owner.consents));
  add(seed.properties);
  add(seed.listings);
  seed.listings.forEach((listing) => add(listing.verifications));
  add(seed.leads);
  add(seed.clients);
  seed.clients.forEach((client) => {
    add(client.household);
    add(client.consents);
    add(client.memory);
  });
  add(seed.requirements);
  add(seed.telegramSources);
  add(seed.telegramListings);
  add(seed.cooperationRequests);
  add(seed.viewings);
  add(seed.offers);
  add(seed.deals);
  seed.deals.forEach((deal) => {
    add(deal.checklist);
    add(deal.documents);
    add(deal.audit);
  });
  add(seed.tasks);
  add(seed.notifications);
  return out;
}

describe("demo seed integrity", () => {
  it("uses unique ids across all entities", () => {
    const list = allIds();
    const duplicates = list.filter((id, index) => list.indexOf(id) !== index);
    expect(duplicates).toEqual([]);
  });

  it("shows the owner in a deal only with the right to sensitive owner data (§19)", async () => {
    const accesses = new Set<string>();
    for (const deal of seed.deals) {
      const detail = await repo.getDeal(deal.id);
      if (!detail) continue;
      accesses.add(detail.listing.access);
      expect(detail.listing.ownerData, deal.id).toBe(detail.listing.access === "owner");
      if (!detail.listing.ownerData) expect(detail.owner, deal.id).toBeUndefined();
      else if (detail.listing.property.ownerId) expect(detail.owner?.id, deal.id).toBe(detail.listing.property.ownerId);
    }
    // The seed exercises both sides of the rule.
    expect([...accesses].some((access) => access === "owner" || access === "agency")).toBe(true);
    expect([...accesses].some((access) => access.startsWith("partner"))).toBe(true);
  });

  it("points every match link at a match the viewer can open", async () => {
    const refs = [...seed.tasks, ...seed.notifications].flatMap((item) =>
      item.related?.kind === "match" ? [item.related.id] : [],
    );
    expect(refs.length).toBeGreaterThan(0);
    for (const id of refs) expect(await repo.getMatch(id), id).toBeDefined();
  });

  it("resolves every id reference", () => {
    const orgs = ids(seed.organizations);
    const agents = ids(seed.agents);
    const owners = ids(seed.owners);
    const properties = ids(seed.properties);
    const listings = ids(seed.listings);
    const leads = ids(seed.leads);
    const clients = ids(seed.clients);
    const requirements = ids(seed.requirements);
    const sources = ids(seed.telegramSources);
    const posts = ids(seed.telegramListings);
    const cooperation = ids(seed.cooperationRequests);
    const viewings = ids(seed.viewings);
    const offers = ids(seed.offers);
    const deals = ids(seed.deals);
    const documents = new Set(seed.deals.flatMap((deal) => deal.documents.map((doc) => doc.id)));
    // Match ids are `${requirementId}--${targetId}`; that the pair still matches is checked below.
    const matchRefs = new Set(
      [...seed.tasks, ...seed.notifications]
        .map((item) => item.related)
        .filter((related) => related?.kind === "match")
        .map((related) => related!.id)
        .filter((id) => {
          const [requirementId, targetId] = id.split("--");
          return requirements.has(requirementId) && (listings.has(targetId) || posts.has(targetId));
        }),
    );
    const byKind: Record<string, Set<ID>> = {
      lead: leads,
      client: clients,
      requirement: requirements,
      match: matchRefs,
      listing: listings,
      deal: deals,
      viewing: viewings,
      cooperation,
      telegram: posts,
      offer: offers,
      document: documents,
    };

    const missing: string[] = [];
    const ref = (set: Set<ID>, id: ID | undefined, where: string) => {
      if (id !== undefined && !set.has(id)) missing.push(`${where} → ${id}`);
    };

    seed.agents.forEach((agent) => {
      ref(orgs, agent.organizationId, agent.id);
      agent.verifications.forEach((item) => ref(agents, item.performedById, item.id));
    });
    seed.properties.forEach((property) => ref(owners, property.ownerId, property.id));
    seed.listings.forEach((listing) => {
      ref(properties, listing.propertyId, listing.id);
      ref(agents, listing.agentId, listing.id);
      ref(orgs, listing.organizationId, listing.id);
      listing.priceHistory.forEach((change) => ref(agents, change.byAgentId, `${listing.id} price`));
    });
    seed.leads.forEach((lead) => {
      ref(agents, lead.assignedAgentId, lead.id);
      ref(clients, lead.duplicateCandidateClientId, lead.id);
    });
    seed.clients.forEach((client) => {
      ref(agents, client.responsibleAgentId, client.id);
      ref(leads, client.leadId, client.id);
    });
    seed.requirements.forEach((requirement) => {
      ref(clients, requirement.clientId, requirement.id);
      ref(agents, requirement.agentId, requirement.id);
      ref(orgs, requirement.organizationId, requirement.id);
    });
    seed.telegramListings.forEach((post) => {
      ref(sources, post.sourceId, post.id);
      post.duplicateCandidates.forEach((candidate) => ref(posts, candidate.listingId, post.id));
      post.linkedClientIds.forEach((clientId) => ref(clients, clientId, post.id));
    });
    seed.cooperationRequests.forEach((request) => {
      ref(listings, request.listingId, request.id);
      ref(requirements, request.requirementId, request.id);
      ref(agents, request.fromAgentId, request.id);
      ref(agents, request.toAgentId, request.id);
    });
    seed.viewings.forEach((viewing) => {
      ref(listings, viewing.listingId, viewing.id);
      ref(clients, viewing.clientId, viewing.id);
      ref(agents, viewing.agentId, viewing.id);
      ref(agents, viewing.partnerAgentId, viewing.id);
    });
    seed.offers.forEach((offer) => {
      ref(listings, offer.listingId, offer.id);
      ref(clients, offer.clientId, offer.id);
      ref(deals, offer.dealId, offer.id);
    });
    seed.deals.forEach((deal) => {
      ref(listings, deal.listingId, deal.id);
      ref(clients, deal.clientId, deal.id);
      ref(agents, deal.agentId, deal.id);
      ref(agents, deal.partnerAgentId, deal.id);
      ref(cooperation, deal.cooperationId, deal.id);
      deal.checklist.forEach((item) => ref(agents, item.doneById, item.id));
      deal.audit.forEach((event) => {
        ref(agents, event.actorId, event.id);
        const set = byKind[event.target.kind];
        if (!set) missing.push(`${event.id} → unknown kind ${event.target.kind}`);
        else ref(set, event.target.id, event.id);
      });
    });
    seed.tasks.forEach((task) => {
      ref(agents, task.assigneeId, task.id);
      if (task.related) ref(byKind[task.related.kind], task.related.id, task.id);
    });
    seed.notifications.forEach((notification) => {
      if (notification.related) ref(byKind[notification.related.kind], notification.related.id, notification.id);
    });
    seed.matchStatuses.forEach((record) => {
      ref(requirements, record.requirementId, "match status");
      ref(record.target.kind === "listing" ? listings : posts, record.target.id, `match status ${record.requirementId}`);
    });

    expect(missing).toEqual([]);
  });

  it("keeps organizations, parties and records consistent with each other", () => {
    const agent = (id: ID) => seed.agents.find((item) => item.id === id);
    const listing = (id: ID) => seed.listings.find((item) => item.id === id);
    for (const item of seed.listings) expect(item.organizationId, item.id).toBe(agent(item.agentId)?.organizationId);
    for (const item of seed.requirements) {
      expect(item.organizationId, item.id).toBe(agent(item.agentId)?.organizationId);
      const client = seed.clients.find((candidate) => candidate.id === item.clientId);
      expect(client?.responsibleAgentId, item.id).toBe(item.agentId);
    }
    // The partner on a viewing or deal is the listing agent when it is not the viewer's own listing.
    for (const item of [...seed.viewings, ...seed.deals]) {
      const listingAgent = listing(item.listingId)?.agentId;
      expect(item.partnerAgentId, item.id).toBe(listingAgent === item.agentId ? undefined : listingAgent);
    }
    for (const deal of seed.deals) {
      if (!deal.cooperationId) continue;
      const request = seed.cooperationRequests.find((item) => item.id === deal.cooperationId);
      expect(request?.listingId).toBe(deal.listingId);
      expect(request?.status).toBe("accepted");
      const accepted = request?.versions.find((version) => version.version === request.acceptedVersion);
      expect(deal.commission?.terms).toEqual(accepted?.terms);
    }
    for (const offer of seed.offers) {
      expect(offer.versions.map((version) => version.version)).toEqual(offer.versions.map((_, index) => index + 1));
      const deal = seed.deals.find((item) => item.id === offer.dealId);
      if (!deal) continue;
      expect([deal.listingId, deal.clientId]).toEqual([offer.listingId, offer.clientId]);
      if (offer.status === "accepted") {
        expect(deal.agreedPrice).toEqual(offer.versions[offer.versions.length - 1].amount);
      }
    }
    for (const request of seed.cooperationRequests) {
      expect(request.versions.map((version) => version.version)).toEqual(
        request.versions.map((_, index) => index + 1),
      );
      for (const version of request.versions) {
        expect([request.fromAgentId, request.toAgentId]).toContain(version.proposedById);
      }
      expect(request.versions[0].proposedById).toBe(request.fromAgentId);
    }
  });

  it("records a next action and feedback after every completed viewing (§14.8)", () => {
    for (const viewing of seed.viewings.filter((item) => item.status === "completed")) {
      expect(viewing.feedback, viewing.id).toBeDefined();
      expect(viewing.nextAction?.trim(), viewing.id).toBeTruthy();
    }
  });

  it("keeps the price history ordered, in one currency, ending at the current price", () => {
    for (const listing of seed.listings) {
      const history = listing.priceHistory;
      expect(history.length, listing.id).toBeGreaterThan(0);
      expect(history[history.length - 1].price, listing.id).toEqual(listing.price);
      expect([...history].sort((a, b) => a.at.localeCompare(b.at)), listing.id).toEqual(history);
      expect(new Set(history.map((change) => change.price.currency)).size, listing.id).toBe(1);
      expect(Number.isSafeInteger(listing.price.amountMinor)).toBe(true);
    }
  });

  it("satisfies the lifecycle entry rules of each listing's current status", () => {
    for (const listing of seed.listings) {
      const rules = listingStatusRules[listing.status] ?? [];
      expect(
        rules.flatMap((rule) => rule(listing, now())),
        `${listing.id} (${listing.status})`,
      ).toEqual([]);
    }
  });

  it("fully specifies every commission split and keeps it valid", () => {
    const terms: [string, CommissionTerms][] = [
      ...seed.listings.flatMap((listing) =>
        listing.cooperation ? [[listing.id, listing.cooperation] as [string, CommissionTerms]] : [],
      ),
      ...seed.cooperationRequests.flatMap((request) =>
        request.versions.map((version) => [`${request.id} v${version.version}`, version.terms] as [string, CommissionTerms]),
      ),
      ...seed.deals.flatMap((deal) =>
        deal.commission ? [[deal.id, deal.commission.terms] as [string, CommissionTerms]] : [],
      ),
    ];
    expect(terms.length).toBeGreaterThan(20);
    for (const [where, item] of terms) {
      expect(validateTerms(item), where).toEqual([]);
      expect(item.listingSidePercent + item.buyerSidePercent, where).toBe(100);
    }
  });

  it("uses only obviously fake phone numbers and never Binor's public one", () => {
    const phones = [
      ...seed.agents.map((agent) => agent.phone),
      ...seed.owners.map((owner) => owner.phone),
      ...seed.clients.flatMap((client) => [...client.phones, ...client.household.map((party) => party.phone)]),
      ...seed.leads.map((lead) => lead.phone),
      ...seed.telegramListings.map((post) => post.parsed.phone.value),
    ].filter((phone): phone is string => phone !== undefined);
    expect(phones.length).toBeGreaterThan(60);
    for (const phone of phones) {
      const normalized = normalizeUzPhone(phone);
      expect(normalized, phone).toBe(phone);
      // "+998 XX 000 XX XX"
      expect(normalized?.slice(6, 9), phone).toBe("000");
      expect(normalized).not.toBe(publicContacts.phoneE164);
    }
  });

  it("uses the checklist codes the deals namespace must label", () => {
    const used = new Set(seed.deals.flatMap((deal) => deal.checklist.map((item) => item.labelKey)));
    expect([...used].sort()).toEqual([...CHECKLIST_LABEL_KEYS].sort());
  });

  it("offers the same property through two agencies at different prices (Property ≠ Listing)", () => {
    const byProperty = new Map<ID, typeof seed.listings>();
    for (const listing of seed.listings) {
      byProperty.set(listing.propertyId, [...(byProperty.get(listing.propertyId) ?? []), listing]);
    }
    const shared = [...byProperty.values()].filter(
      (group) =>
        new Set(group.map((listing) => listing.organizationId)).size > 1 &&
        new Set(group.map((listing) => listing.price.amountMinor)).size > 1,
    );
    expect(shared.length).toBeGreaterThanOrEqual(2);
  });
});

describe("telegram posts", () => {
  const digits = (text: string) => text.replace(/\D/g, "");
  const variantsOf = (id: keyof typeof districts) =>
    [districts[id].ru, districts[id].uz, ...districts[id].variants].map(foldText);

  it("link to the original post on the source channel", () => {
    for (const post of seed.telegramListings) {
      const source = seed.telegramSources.find((item) => item.id === post.sourceId);
      expect(post.sourceUrl).toBe(`https://t.me/${source?.handle}/${post.messageId}`);
    }
  });

  it("keep parsed values consistent with the raw-text evidence", () => {
    for (const post of seed.telegramListings) {
      const fields = post.parsed as ParsedListingFields;
      for (const [name, field] of Object.entries(fields)) {
        const where = `${post.id}.${name}`;
        expect(field.confidence, where).toBeGreaterThanOrEqual(0);
        expect(field.confidence, where).toBeLessThanOrEqual(1);
        if (field.evidence !== undefined) expect(post.rawText, where).toContain(field.evidence);
        if (field.value === undefined) expect(field.confidence, where).toBeLessThan(0.6);
        else expect(field.evidence, where).toBeDefined();
      }
      const evidence = (field: { evidence?: string }) => field.evidence ?? "";
      for (const name of ["rooms", "areaTotal", "floor", "floorsTotal"] as const) {
        const field = fields[name];
        if (field.value !== undefined) expect(evidence(field), `${post.id}.${name}`).toContain(String(field.value));
      }
      const price = fields.price;
      if (price.value) {
        expect(digits(evidence(price)), `${post.id}.price`).toBe(String(toMajor(price.value)));
        expect(evidence(price), `${post.id}.price currency`).toMatch(
          price.value.currency === "USD" ? /\$|у\.е\./ : /сум|so‘m/,
        );
      }
      if (fields.phone.value) expect(normalizeUzPhone(evidence(fields.phone))).toBe(fields.phone.value);
      const district = fields.district;
      if (district.value && district.confidence >= 0.6) {
        const folded = foldText(evidence(district));
        expect(variantsOf(district.value).some((variant) => folded.includes(variant)), post.id).toBe(true);
      }
    }
  });

  it("suggest duplicates in both directions and never link a post to itself", () => {
    for (const post of seed.telegramListings) {
      for (const candidate of post.duplicateCandidates) {
        expect(candidate.listingId).not.toBe(post.id);
        expect(candidate.reasons.length).toBeGreaterThan(0);
        const other = seed.telegramListings.find((item) => item.id === candidate.listingId);
        expect(other?.duplicateCandidates.map((item) => item.listingId), post.id).toContain(post.id);
      }
    }
  });

  it("include ambiguous posts that stay Unknown below the confidence threshold", () => {
    const lowConfidence = seed.telegramListings.filter((post) =>
      Object.values(post.parsed).some((field) => field.confidence > 0 && field.confidence < 0.6),
    );
    const unknownPrice = seed.telegramListings.filter((post) => post.parsed.price.value === undefined);
    expect(lowConfidence.length).toBeGreaterThanOrEqual(3);
    expect(unknownPrice.length).toBeGreaterThanOrEqual(2);
  });
});

describe("repository", () => {
  it("returns the viewer with their organization", async () => {
    const viewer = await repo.getViewer();
    expect(viewer.agent.id).toBe(VIEWER_AGENT_ID);
    expect(viewer.organization?.id).toBe(viewer.agent.organizationId);
  });

  it("finds at least one visible match for every active requirement of the viewer", async () => {
    const active = seed.requirements.filter(
      (requirement) => requirement.agentId === VIEWER_AGENT_ID && requirement.status === "active",
    );
    expect(active.length).toBeGreaterThanOrEqual(10);
    for (const requirement of active) {
      const matches = await repo.getMatchesForRequirement(requirement.id);
      expect(matches.length, requirement.id).toBeGreaterThan(0);
      for (const match of matches) {
        expect(match.ranked.band).not.toBe("hidden");
        expect(match.ranked.reasons.length).toBe(7);
      }
    }
  });

  it("returns no matches for paused, closed or foreign requirements", async () => {
    expect(await repo.getMatchesForRequirement("req-11")).toEqual([]); // paused
    expect(await repo.getMatchesForRequirement("req-13")).toEqual([]); // closed
    expect(await repo.getMatchesForRequirement("req-17")).toEqual([]); // a partner's requirement
  });

  it("overlays recorded reactions onto computed matches", async () => {
    for (const record of seed.matchStatuses) {
      const matches = await repo.getMatchesForRequirement(record.requirementId);
      const match = matches.find((item) => item.id === repo.matchId(record.requirementId, record.target));
      expect(match, `${record.requirementId} × ${record.target.id}`).toBeDefined();
      expect(match?.status).toBe(record.status);
      expect(match?.rejectionReason).toBe(record.rejectionReason);
    }
    const match = await repo.getMatch("req-03--lst-12");
    expect(match?.status).toBe("rejected");
    expect(match?.rejectionReason).toBe("price");
  });

  it("masks partner listings and hides restricted ones", async () => {
    const masked = await repo.getListing("lst-16");
    expect(masked?.access).toBe("partner_masked");
    expect(masked?.owner).toBeUndefined();
    expect(masked?.property.address).toBeUndefined();
    expect(masked?.property.cadastralNumber).toBeUndefined();
    expect(masked?.property.ownerId).toBeUndefined();
    expect(masked?.property.geo?.precision).toBe("district");

    const shared = await repo.getListing("lst-29");
    expect(shared?.access).toBe("partner_shared");
    expect(shared?.property.address).toBeDefined();
    expect(shared?.owner).toBeUndefined();

    const own = await repo.getListing("lst-01");
    expect(own?.access).toBe("owner");
    expect(own?.owner?.id).toBe("owner-01");
    expect(own?.property.address).toBeDefined();

    // An agency agent sees a colleague's listing and address, but owner data needs a permission (§19).
    const colleague = await repo.getListing("lst-12");
    expect(colleague?.access).toBe("agency");
    expect(colleague?.ownerData).toBe(false);
    expect(colleague?.owner).toBeUndefined();
    expect(colleague?.property.ownerId).toBeUndefined();
    expect(colleague?.property.address).toBeDefined();

    // A partner's off-market listing does not exist for the viewer.
    expect(await repo.getListing("lst-21")).toBeUndefined();
    // Nor does a partner's listing that is not yet published to the MLS (§11.1).
    expect(seed.listings.find((listing) => listing.id === "lst-28")?.status).toBe("verified");
    expect(await repo.getListing("lst-28")).toBeUndefined();
    expect(await repo.getReverseMatches("lst-21")).toEqual([]);
    const all = await repo.listListings();
    expect(all.map((view) => view.listing.id)).not.toContain("lst-21");
    for (const view of all) {
      if (view.access === "partner_masked") expect(view.property.address, view.listing.id).toBeUndefined();
    }
  });

  it("separates listing scopes", async () => {
    const mine = await repo.listListings({ scope: "mine" });
    const agency = await repo.listListings({ scope: "agency" });
    const mls = await repo.listListings({ scope: "mls" });
    expect(mine.every((view) => view.access === "owner")).toBe(true);
    expect(agency.every((view) => view.access === "owner" || view.access === "agency")).toBe(true);
    expect(agency.length).toBeGreaterThan(mine.length);
    // The viewer's off-market listing stays out of the MLS.
    expect(mine.map((view) => view.listing.id)).toContain("lst-06");
    expect(mls.map((view) => view.listing.id)).not.toContain("lst-06");
    // So does a listing not yet published (§11.1): verified is not yet Active MLS.
    expect(mine.map((view) => view.listing.id)).toContain("lst-09");
    expect(mls.map((view) => view.listing.id)).not.toContain("lst-09");
    expect(mls.some((view) => view.access === "partner_masked")).toBe(true);
  });

  it("applies listing filters without silent currency conversion", async () => {
    const cheap = await repo.listListings({ dealType: "sale", priceMax: 75_000 });
    expect(cheap.length).toBeGreaterThan(0);
    for (const view of cheap) {
      expect(view.listing.price.currency).toBe("USD");
      expect(view.listing.price.amountMinor).toBeLessThanOrEqual(7_500_000);
    }
    const uzsRent = await repo.listListings({ dealType: "rent", currency: "UZS", priceMax: 9_000_000 });
    expect(uzsRent.length).toBeGreaterThan(0);
    expect(uzsRent.every((view) => view.listing.price.currency === "UZS")).toBe(true);
    const threeRooms = await repo.listListings({ district: "chilanzar", roomsMin: 3, roomsMax: 3 });
    expect(threeRooms.every((view) => view.property.rooms === 3 && view.property.district === "chilanzar")).toBe(
      true,
    );
    const stale = await repo.listListings({ freshness: "needs_confirmation" });
    expect(stale.map((view) => view.listing.id)).toContain("lst-08");
  });

  it("keeps partner clients out of the viewer's CRM and masks undisclosed buyers", async () => {
    const clients = await repo.listClients();
    expect(clients.length).toBe(14);
    expect(clients.every((item) => item.client.responsibleAgentId === VIEWER_AGENT_ID)).toBe(true);
    expect(await repo.getClient("cl-15")).toBeUndefined();

    const incoming = await repo.getCooperation("coop-03");
    expect(incoming?.direction).toBe("incoming");
    expect(incoming?.awaitingViewer).toBe(true);
    expect(incoming?.requirement?.disclosed).toBe(false);
    expect(incoming?.requirement?.clientName).toBeUndefined();

    const accepted = await repo.getCooperation("coop-01");
    expect(accepted?.accepted?.version).toBe(3);
    expect(accepted?.requirement?.clientName).toBe("Алишер Хасанов");
  });

  it("flags lead SLAs and duplicate candidates", async () => {
    const leads = await repo.listLeads();
    expect(leads.length).toBe(12);
    const states = new Set(leads.map((view) => view.sla.state));
    expect(states).toEqual(new Set(["breached", "due_soon", "responded"]));
    const duplicates = leads.filter((view) => view.duplicateCandidate);
    expect(duplicates.map((view) => view.lead.id).sort()).toEqual(["lead-06", "lead-12"]);
    const sources = new Set(seed.leads.map((lead) => lead.source));
    for (const source of ["telegram", "phone", "instagram", "unknown"] as const) expect(sources).toContain(source);
  });

  it("detects overlapping viewings", async () => {
    const vw03 = await repo.getViewing("vw-03");
    const vw04 = await repo.getViewing("vw-04");
    expect(vw03?.conflictsWith).toEqual(["vw-04"]);
    expect(vw04?.conflictsWith).toEqual(["vw-03"]);
    const all = await repo.listViewings();
    const conflicted = all.filter((view) => view.conflictsWith.length > 0).map((view) => view.viewing.id);
    expect(conflicted).toEqual(["vw-03", "vw-04"]);
  });

  it("tracks the 3-working-day MLS deadline on the co-broking deal", async () => {
    const deal = await repo.getDeal("deal-06");
    expect(deal?.deal.actSignedAt).toBeDefined();
    expect(deal?.deal.mlsReportedAt).toBeUndefined();
    // Signed two working days before the demo "now".
    expect(tashkentDateKey(addWorkingDays(deal?.deal.actSignedAt ?? "", 2))).toBe(tashkentDateKey(now()));
    expect(deal?.mlsReport).toMatchObject({ state: "due", workingDaysLeft: 1 });
    expect(deal?.cooperation?.request.id).toBe("coop-01");
    const stages = (await repo.listDeals()).map((view) => view.deal.stage);
    for (const stage of ["viewing", "negotiation", "under_contract", "verification", "closing"] as const) {
      expect(stages).toContain(stage);
    }
  });

  it("fills every block of the Today feed", async () => {
    const feed = await repo.getTodayFeed();
    const blocks = {
      overdueTasks: feed.overdueTasks,
      todayTasks: feed.todayTasks,
      todayViewings: feed.todayViewings,
      slaLeads: feed.slaLeads,
      newMatches: feed.newMatches,
      incomingCooperation: feed.incomingCooperation,
      expiringContracts: feed.expiringContracts,
      staleListings: feed.staleListings,
      priceDrops: feed.priceDrops,
      dealsNeedingAttention: feed.dealsNeedingAttention,
    };
    for (const [name, block] of Object.entries(blocks)) expect(block.length, name).toBeGreaterThan(0);

    expect(feed.todayViewings.map((view) => view.viewing.id)).toEqual(["vw-01", "vw-02"]);
    expect(feed.newMatches.length).toBeLessThanOrEqual(5);
    for (const match of feed.newMatches) {
      expect(match.status).toBe("new");
      expect(["excellent", "good"]).toContain(match.ranked.band);
    }
    for (const item of feed.expiringContracts) expect(item.daysLeft).toBeLessThanOrEqual(14);
    for (const item of feed.priceDrops) {
      expect(item.current.amountMinor).toBeLessThan(item.previous.amountMinor);
    }
    expect(feed.priceDrops.some((item) => item.affectedRequirementsCount > 0)).toBe(true);
    expect(feed.staleListings.map((view) => view.listing.id).sort()).toEqual(["lst-07", "lst-08"]);
  });

  it("finds Chilanzar listings by Russian and Uzbek district names", async () => {
    for (const query of ["Чиланзар", "Chilonzor", "чиланзаре"]) {
      const results = await repo.searchAll(query);
      expect(results.listings.length, query).toBeGreaterThan(0);
      expect(results.listings.length).toBeLessThanOrEqual(8);
      expect(results.listings.every((view) => view.property.district === "chilanzar"), query).toBe(true);
      expect(results.telegram.length, query).toBeGreaterThan(0);
    }
  });

  it("searches by phone fragments, names and ids but not by hidden addresses", async () => {
    const byPhone = await repo.searchAll("+998 93 000 03 02");
    expect(byPhone.clients.map((item) => item.client.id)).toEqual(["cl-02"]);
    expect(byPhone.leads.map((view) => view.lead.id)).toEqual(["lead-06"]);
    expect((await repo.searchAll("0302")).clients.map((item) => item.client.id)).toEqual(["cl-02"]);
    expect((await repo.searchAll("Гульнара")).clients.map((item) => item.client.id)).toEqual(["cl-02"]);
    expect((await repo.searchAll("deal-06")).deals.map((view) => view.deal.id)).toEqual(["deal-06"]);
    // The viewer's own restricted address is searchable…
    expect((await repo.searchAll("ул. Нукус")).listings.map((view) => view.listing.id)).toEqual(["lst-02"]);
    // …a masked partner address is not (prop-16: "Юнусабад-4, дом 20, кв. 51").
    expect((await repo.searchAll("кв. 51")).listings.map((view) => view.listing.id)).not.toContain("lst-16");
    expect(await repo.searchAll("   ")).toMatchObject({ clients: [], listings: [], deals: [] });
  });

  it("is deterministic across calls", async () => {
    expect(await repo.getTodayFeed()).toEqual(await repo.getTodayFeed());
    expect(await repo.listMatchFeed()).toEqual(await repo.listMatchFeed());
    expect(await repo.listListings()).toEqual(await repo.listListings());
    expect(await repo.searchAll("Юнусабад")).toEqual(await repo.searchAll("Юнусабад"));
  });

  it("returns copies and never lets callers mutate the seed", async () => {
    expect(Object.isFrozen(seed.listings[0].priceHistory)).toBe(true);
    const first = await repo.getListing("lst-01");
    if (!first) throw new Error("lst-01 must be visible");
    first.listing.price.amountMinor = 1;
    first.listing.priceHistory.reverse();
    first.property.district = "bektemir";
    const second = await repo.getListing("lst-01");
    expect(second?.listing.price.amountMinor).toBe(10_800_000);
    expect(second?.listing.priceHistory[0].price.amountMinor).toBe(11_500_000);
    expect(second?.property.district).toBe("yunusabad");
  });

  it("counts unread notifications and covers every category", async () => {
    const all = await repo.listNotifications();
    expect(all.length).toBe(15);
    expect(await repo.countUnreadNotifications()).toBe(all.filter((item) => !item.read).length);
    expect(new Set(all.map((item) => item.category))).toEqual(
      new Set(["action", "clients", "matches", "deals", "system"]),
    );
    expect(all.some((item) => item.kind === "security")).toBe(true);
    const system = await repo.listNotifications({ category: "system" });
    expect(system.every((item) => item.category === "system")).toBe(true);
  });

  it("builds a client profile with everything linked to the client", async () => {
    const client = await repo.getClient("cl-02");
    expect(client?.requirements.map((view) => view.requirement.id)).toEqual(["req-03"]);
    expect(client?.viewings.map((view) => view.viewing.id)).toEqual(["vw-07", "vw-01"]);
    expect(client?.offers.map((view) => view.offer.id)).toEqual(["offer-05"]);
    expect(client?.deals.map((view) => view.deal.id)).toEqual(["deal-01"]);
    expect(client?.tasks.map((view) => view.task.id)).toEqual(["task-04", "task-05"]);
    expect(client?.matches.total).toBeGreaterThan(0);
    expect(client?.matches.top.every((match) => match.status !== "rejected")).toBe(true);
  });
});
