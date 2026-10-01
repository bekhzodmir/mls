import { describe, expect, it } from "vitest";
import { getPartner } from "@/lib/data/repository";
import type { PartnerCooperationView, PartnerDetailView, PartnerListingView } from "@/lib/data/views";
import {
  activeRequestByListing,
  contactState,
  cooperationTarget,
  parsePartnerParams,
  partnerHref,
  partnersHref,
} from "./partner-model";

async function partner(id: string): Promise<PartnerDetailView> {
  const detail = await getPartner(id);
  if (!detail) throw new Error(`${id} must be a partner`);
  return detail;
}

describe("partner params and links", () => {
  it("keeps a trimmed, bounded query and nothing else", () => {
    expect(parsePartnerParams({ q: "  Namuna " })).toEqual({ q: "Namuna" });
    expect(parsePartnerParams({ q: "" })).toEqual({});
    expect(parsePartnerParams({ q: ["Чиланзар", "x"], other: "1" })).toEqual({ q: "Чиланзар" });
    expect(parsePartnerParams({ q: "x".repeat(200) }).q).toHaveLength(80);
  });

  it("builds list and profile links, with the demo preview when given", () => {
    expect(partnersHref("ru")).toBe("/ru/app/partners");
    expect(partnersHref("uz", { q: "Мирабад" })).toBe("/uz/app/partners?q=%D0%9C%D0%B8%D1%80%D0%B0%D0%B1%D0%B0%D0%B4");
    expect(partnerHref("ru", "agent-04", "team_lead")).toBe("/ru/app/partners/agent-04?demoRole=team_lead");
  });
});

describe("partner contacts (§18.2)", () => {
  it("are shared after an accepted cooperation with shared contacts", async () => {
    const state = contactState(await partner("agent-04"));
    expect(state).toEqual({ kind: "shared", phone: "+998900000104", telegramUsername: "dilnoza_namuna_demo" });
  });

  it("wait for an open request instead of offering a competing one", async () => {
    const detail = await partner("agent-06");
    const state = contactState(detail);
    expect(state.kind).toBe("pending");
    expect(state.kind === "pending" ? state.requestId : undefined).toBe("coop-02");
  });

  it("stay hidden with a listing to request cooperation on, when there is no history", async () => {
    const detail = await partner("agent-09");
    const state = contactState(detail);
    expect(state.kind).toBe("hidden");
    const listingId = state.kind === "hidden" ? state.listingId : undefined;
    expect(listingId).toBeDefined();
    const target = detail.listings.find((view) => view.listing.id === listingId);
    expect(target?.listing.status).toBe("active_mls");
    expect(target?.access).toBe("partner_masked");
    expect(JSON.stringify(detail)).not.toContain("+998900000109");
  });

  it("never offers a listing that already has an open or accepted request", () => {
    const listing = (id: string, status = "active_mls", access = "partner_masked") =>
      ({ listing: { id, status }, access }) as unknown as PartnerListingView;
    const request = (id: string, listingId: string, status: string) =>
      ({ request: { id, listingId, status } }) as unknown as PartnerCooperationView;
    const listings = [listing("l1"), listing("l2"), listing("l3", "offer"), listing("l4", "active_mls", "partner_shared")];
    const history = [request("c1", "l1", "negotiation"), request("c2", "l2", "declined")];
    expect([...activeRequestByListing(history)]).toEqual([["l1", "c1"]]);
    expect(cooperationTarget(listings, history)?.listing.id).toBe("l2");
    expect(cooperationTarget([listings[0], listings[2], listings[3]], history)).toBeUndefined();
  });
});
