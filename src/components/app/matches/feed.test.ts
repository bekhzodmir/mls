import { describe, expect, it } from "vitest";
import { getMatchesForRequirement, listMatchFeed } from "@/lib/data/repository";
import {
  bandCounts,
  cooperationRequestHref,
  groupByRequirement,
  isPartnerListing,
  isSetAside,
  matchFeedHref,
  parseMatchFeedParams,
  parseShortlistParams,
  partitionShortlist,
  requirementDetailHref,
  statusCounts,
  targetFacts,
  targetHref,
  targetPrice,
} from "./feed";

describe("URL params", () => {
  it("keeps known band and status values only", () => {
    expect(parseMatchFeedParams({ band: "good", status: "rejected" })).toEqual({ band: "good", status: "rejected" });
    expect(parseMatchFeedParams({ band: "hidden", status: "maybe" })).toEqual({});
    expect(parseShortlistParams({})).toEqual({ sort: "relevance", source: "internal" });
    expect(parseShortlistParams({ sort: ["price", "freshness"], source: "telegram" })).toEqual({
      sort: "price",
      source: "telegram",
    });
    expect(parseShortlistParams({ sort: "distance", source: "olx" })).toEqual({ sort: "relevance", source: "internal" });
  });

  it("builds links without default values", () => {
    expect(matchFeedHref("ru", {})).toBe("/ru/app/matches");
    expect(matchFeedHref("uz", { band: "excellent", status: "new" })).toBe("/uz/app/matches?band=excellent&status=new");
    expect(requirementDetailHref("ru", "req-01")).toBe("/ru/app/requirements/req-01");
    expect(requirementDetailHref("ru", "req-01", { source: "telegram", sort: "price" })).toBe(
      "/ru/app/requirements/req-01?source=telegram&sort=price",
    );
    expect(cooperationRequestHref("ru", "lst-16", "req-03")).toBe(
      "/ru/app/mls/cooperation/new?listingId=lst-16&requirementId=req-03",
    );
  });
});

describe("feed grouping", () => {
  it("groups by requirement, best group first, keeping the feed order inside", async () => {
    const feed = await listMatchFeed();
    const groups = groupByRequirement(feed);
    expect(groups.reduce((sum, group) => sum + group.matches.length, 0)).toBe(feed.length);
    expect(new Set(groups.map((group) => group.requirement.id)).size).toBe(groups.length);
    expect(groups[0].matches[0]).toBe(feed[0]);
    for (const group of groups) {
      const indexes = group.matches.map((match) => feed.indexOf(match));
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
      expect(group.matches.every((match) => match.client.id === group.client.id)).toBe(true);
    }
  });

  it("counts statuses in lifecycle order and bands without hidden", async () => {
    const feed = await listMatchFeed();
    const statuses = statusCounts(feed);
    expect(statuses[0].status).toBe("new");
    expect(statuses.reduce((sum, item) => sum + item.count, 0)).toBe(feed.length);
    const bands = bandCounts(feed);
    expect(bands.excellent + bands.good + bands.possible).toBe(feed.length);
  });
});

describe("shortlist", () => {
  it("sets rejected and duplicate matches aside without dropping them", async () => {
    const matches = await getMatchesForRequirement("req-01");
    const { active, setAside } = partitionShortlist(matches);
    expect(active.length + setAside.length).toBe(matches.length);
    expect(setAside.map((match) => match.status).every(isSetAside)).toBe(true);
    expect(setAside.map((match) => match.id)).toContain("req-01--lst-22");
  });
});

describe("targets", () => {
  it("describes partner listings, own listings and Telegram posts", async () => {
    const matches = await getMatchesForRequirement("req-03");
    const partner = matches.find((match) => match.id === "req-03--lst-16");
    const own = matches.find((match) => match.id === "req-03--lst-01");
    const post = matches.find((match) => match.id === "req-03--tg-02");
    if (!partner || !own || !post) throw new Error("seeded matches missing");

    expect(isPartnerListing(partner)).toBe(true);
    expect(isPartnerListing(own)).toBe(false);
    expect(isPartnerListing(post)).toBe(false);
    expect(targetHref("ru", partner)).toBe("/ru/app/properties/lst-16");
    expect(targetHref("uz", post)).toBe("/uz/app/radar/tg-02");
    expect(targetPrice(post)?.currency).toBe("USD");
    expect(targetFacts(post)).toMatchObject({ propertyType: "apartment", district: "yunusabad", rooms: 3 });
    expect(targetFacts(partner)).toMatchObject({ district: "yunusabad", rooms: 3 });
  });
});
