import { describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import { getOwner, listOwners, listVerificationQueue } from "@/lib/data/repository";
import type { Listing } from "@/lib/domain/types";
import {
  callsTimelineHref,
  consentGaps,
  listingHistory,
  ownerFacts,
  ownerHref,
  ownerTimeline,
  propertyGroups,
} from "./owner-model";

const at = now();

describe("propertyGroups", () => {
  it("groups the registered owner's listings under each property", async () => {
    const detail = (await getOwner("owner-01"))!;
    const groups = propertyGroups(detail);
    expect(groups.map((group) => [group.property.id, group.listings.map((view) => view.listing.id), group.viaContract])).toEqual([
      ["prop-01", ["lst-01"], false],
    ]);
  });

  it("reaches a co-owner's property through the contract, marked as such", async () => {
    const detail = (await getOwner("owner-34"))!;
    expect(detail.rightHolderOnly).toBe(true);
    expect(detail.listings).toEqual([]);
    const [group] = propertyGroups(detail);
    expect(group.property.id).toBe("prop-33");
    expect(group.listings.map((view) => view.listing.id)).toEqual(["lst-35"]);
    expect(group.viaContract).toBe(true);
  });
});

describe("ownerFacts", () => {
  it("adds the contract listing's facts for a co-owner, without duplicates", async () => {
    const detail = (await getOwner("owner-34"))!;
    const queue = await listVerificationQueue({ target: "listing" });
    expect(detail.verification).toEqual([]);
    const facts = ownerFacts(detail.verification, queue, propertyGroups(detail));
    expect(facts.map((entry) => entry.key)).toEqual(["listing:lst-35:ver-lst-35-owner_consent"]);
    expect(ownerFacts(facts, queue, propertyGroups(detail))).toHaveLength(1);
  });

  it("keeps the registered owner's own facts as they are", async () => {
    const detail = (await getOwner("owner-03"))!;
    const queue = await listVerificationQueue();
    expect(ownerFacts(detail.verification, queue, propertyGroups(detail))).toEqual(detail.verification);
  });
});

describe("consentGaps (art. 37)", () => {
  it("flags the contract where a co-owner's consent is missing, for both right holders", async () => {
    const coOwner = (await getOwner("owner-34"))!;
    expect(consentGaps(coOwner.contracts, "owner-34").map((gap) => [gap.contract.contract.number, gap.ownMissing])).toEqual([
      ["DR-2026-061", true],
    ]);
    const customer = (await getOwner("owner-33"))!;
    const [gap] = consentGaps(customer.contracts, "owner-33");
    expect(gap.ownMissing).toBe(false);
    expect(gap.missing.map((holder) => holder.ownerId)).toEqual(["owner-34"]);
  });

  it("is empty when every right holder consented", async () => {
    const detail = (await getOwner("owner-01"))!;
    expect(consentGaps(detail.contracts, "owner-01")).toEqual([]);
  });
});

describe("ownerTimeline", () => {
  it("shows a call that has a timeline entry once, as that entry", async () => {
    const detail = (await getOwner("owner-06"))!;
    expect(detail.calls.map((view) => view.call.id)).toEqual(["call-06"]);
    const entries = ownerTimeline(detail);
    expect(entries.map((entry) => [entry.kind, entry.id])).toEqual([["communication", "comm-24"]]);
  });

  it("keeps calls without an entry and orders newest first", async () => {
    const detail = (await getOwner("owner-08"))!;
    const entries = ownerTimeline({
      communications: detail.communications,
      calls: [
        ...detail.calls,
        { ...detail.calls[0], call: { ...detail.calls[0].call, id: "call-x", startedAt: "2026-09-29T23:00:00.000Z" } },
      ],
    });
    expect(entries[0]).toMatchObject({ kind: "call", id: "call-x" });
    expect(entries.filter((entry) => entry.kind === "call").map((entry) => entry.id)).toEqual(["call-x"]);
    const times = entries.map((entry) => entry.at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("only holds the viewer's own touchpoints: nothing for a colleague's owner", async () => {
    const detail = (await getOwner("owner-13"))!;
    expect(detail.contactVisible).toBe(false);
    expect(detail.owner.phone).toBeUndefined();
    expect(ownerTimeline(detail)).toEqual([]);
  });
});

describe("listingHistory", () => {
  const usd = (amount: number) => ({ amountMinor: amount * 100, currency: "USD" as const });
  const listing: Pick<Listing, "price" | "priceHistory" | "status" | "publishedAt" | "lastConfirmedAt" | "updatedAt"> = {
    price: usd(90_000),
    priceHistory: [
      { price: usd(95_000), at: "2026-08-01T05:00:00.000Z", byAgentId: "agent-01" },
      { price: usd(92_000), at: "2026-09-01T05:00:00.000Z", byAgentId: "agent-01" },
      { price: usd(90_000), at: "2026-09-20T05:00:00.000Z", byAgentId: "agent-01" },
    ],
    status: "active_mls",
    publishedAt: "2026-08-01T05:00:00.000Z",
    lastConfirmedAt: "2026-09-25T05:00:00.000Z",
    updatedAt: "2026-09-25T05:00:00.000Z",
  };

  it("lists publication, each change with the previous price, confirmation and status, newest first", () => {
    expect(listingHistory(listing, at)).toEqual([
      { kind: "status", at: "2026-09-25T05:00:00.000Z", status: "active_mls" },
      { kind: "confirmed", at: "2026-09-25T05:00:00.000Z" },
      { kind: "price", at: "2026-09-20T05:00:00.000Z", price: usd(90_000), previous: usd(92_000) },
      { kind: "price", at: "2026-09-01T05:00:00.000Z", price: usd(92_000), previous: usd(95_000) },
      { kind: "published", at: "2026-08-01T05:00:00.000Z", price: usd(95_000) },
    ]);
  });

  it("invents no events: no confirmation recorded, none shown; nothing after now", () => {
    const events = listingHistory({ ...listing, lastConfirmedAt: undefined, updatedAt: "2026-10-05T05:00:00.000Z" }, at);
    expect(events.map((event) => event.kind)).toEqual(["price", "price", "published"]);
  });

  it("works on every seeded listing of the viewer's owners", async () => {
    for (const item of await listOwners()) {
      const detail = (await getOwner(item.owner.id))!;
      for (const view of detail.listings) {
        const events = listingHistory(view.listing, at);
        expect(events.filter((event) => event.kind === "published")).toHaveLength(1);
        expect(events.filter((event) => event.kind === "price")).toHaveLength(view.listing.priceHistory.length - 1);
      }
    }
  });
});

describe("links", () => {
  it("encodes ids", () => {
    expect(ownerHref("ru", "owner-34")).toBe("/ru/app/owners/owner-34");
    expect(callsTimelineHref("uz", "owner-06")).toBe("/uz/app/calls/timeline?ownerId=owner-06");
  });
});
