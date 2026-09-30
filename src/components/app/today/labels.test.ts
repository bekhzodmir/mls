import { describe, expect, it } from "vitest";
import { getTelegramListing, listListings } from "@/lib/data/repository";
import type { PropertyView } from "@/lib/data/views";
import { firstName, listingTitle, telegramTitle } from "./labels";
import { entityHref, listHref, matchHref } from "./links";

const flat = {
  id: "p",
  propertyType: "apartment",
  city: "tashkent",
  district: "yunusabad",
  areaName: "Юнусабад-19 квартал",
  rooms: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
} satisfies PropertyView;

describe("listingTitle", () => {
  it("names type, rooms and massif without the address", () => {
    expect(listingTitle("ru", flat)).toBe("3-комн. квартира · Юнусабад-19 квартал");
    expect(listingTitle("uz", flat)).toBe("3 xonali kvartira · Юнусабад-19 квартал");
  });

  it("falls back to the district and keeps unknown rooms unknown", () => {
    const bare: PropertyView = { ...flat, areaName: undefined, rooms: undefined };
    expect(listingTitle("ru", bare)).toBe("Квартира · Юнусабад");
    expect(listingTitle("uz", { ...bare, propertyType: "house" })).toBe("Hovli uy · Yunusobod");
  });

  it("never exposes the address of a masked partner listing", async () => {
    const masked = (await listListings()).filter((view) => view.access === "partner_masked");
    expect(masked.length).toBeGreaterThan(0);
    for (const view of masked) {
      expect(view.property.address).toBeUndefined();
      expect(listingTitle("ru", view.property)).not.toContain("undefined");
    }
  });
});

describe("telegramTitle", () => {
  it("uses only confident parsed fields", async () => {
    const post = (await getTelegramListing("tg-01"))?.post;
    expect(post).toBeDefined();
    if (!post) return;
    const unsure = {
      ...post,
      parsed: {
        ...post.parsed,
        district: { ...post.parsed.district, confidence: 0.3 },
        rooms: { confidence: 0 },
      },
    };
    expect(telegramTitle("ru", unsure)).toMatch(/ · Район неизвестен$/);
    expect(telegramTitle("uz", unsure)).toMatch(/ · Tumani noma’lum$/);
  });
});

describe("links", () => {
  it("maps every entity kind to its workspace route", () => {
    expect(entityHref("ru", { kind: "lead", id: "lead-01" })).toBe("/ru/app/leads/lead-01");
    expect(entityHref("uz", { kind: "listing", id: "lst-01" })).toBe("/uz/app/properties/lst-01");
    expect(entityHref("ru", { kind: "cooperation", id: "coop-03" })).toBe("/ru/app/mls/cooperation/coop-03");
    expect(entityHref("ru", { kind: "telegram", id: "tg-13" })).toBe("/ru/app/radar/tg-13");
    expect(matchHref("ru", "req-03--lst-16")).toBe("/ru/app/matches/req-03--lst-16");
  });

  it("builds filtered list URLs and skips empty values", () => {
    expect(listHref("ru", "/properties", { scope: "mine", freshness: "needs_confirmation", q: "" })).toBe(
      "/ru/app/properties?scope=mine&freshness=needs_confirmation",
    );
    expect(listHref("uz", "/deals")).toBe("/uz/app/deals");
  });

  it("uses the given name for greetings", () => {
    expect(firstName("Азиз Каримов")).toBe("Азиз");
    expect(firstName("  Zarina  ")).toBe("Zarina");
  });
});
