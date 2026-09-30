import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import type { Listing, TelegramListing, VerificationItem } from "@/lib/domain/types";
import {
  attributeChips,
  latestPriceChange,
  locationLine,
  propertyTitle,
  telegramFacts,
  typeLabel,
  verificationSummary,
} from "./labels";

describe("titles", () => {
  it("names type, rooms and the massif — never the address", () => {
    expect(
      propertyTitle("ru", { propertyType: "apartment", rooms: 3, district: "yunusabad", areaName: "Юнусабад-19 квартал" }),
    ).toBe("3-комн. квартира · Юнусабад-19 квартал");
    expect(propertyTitle("uz", { propertyType: "apartment", rooms: 2, district: "chilanzar" })).toBe(
      "2 xonali kvartira · Chilonzor",
    );
  });

  it("does not attach room counts to land or single rooms", () => {
    expect(typeLabel("ru", { propertyType: "land", rooms: 3 })).toBe("Участок");
    expect(typeLabel("ru", { propertyType: "room", rooms: 1 })).toBe("Комната");
  });

  it("says Unknown instead of inventing a type or place", () => {
    expect(propertyTitle("ru", {})).toBe("Тип неизвестен · Район неизвестен");
    expect(propertyTitle("uz", { rooms: 2 })).toBe("2 xonali · Tuman noma’lum");
  });

  it("joins district, massif and landmark without repeats", () => {
    expect(
      locationLine("ru", { district: "yunusabad", areaName: "Юнусабад-19 квартал", landmark: "метро Шахристан" }),
    ).toBe("Юнусабад · Юнусабад-19 квартал · метро Шахристан");
    expect(locationLine("ru", { district: "chilanzar", areaName: "Чиланзар" })).toBe("Чиланзар");
  });
});

describe("attributeChips", () => {
  it("shows known values and marks missing relevant ones as unknown", () => {
    expect(attributeChips("ru", { propertyType: "apartment", rooms: 2, areaTotal: 54.5, floor: 3, floorsTotal: 4 })).toEqual([
      { key: "rooms", text: "2 комн.", unknown: false },
      { key: "area", text: "54,5 м²", unknown: false },
      { key: "floor", text: "3/4 этаж", unknown: false },
    ]);
    expect(attributeChips("ru", { propertyType: "apartment" }).map((chip) => chip.unknown)).toEqual([true, true, true]);
  });

  it("leaves out attributes that do not apply to the type", () => {
    expect(attributeChips("ru", { propertyType: "commercial", areaTotal: 140, floor: 1, floorsTotal: 5 }).map((c) => c.key)).toEqual([
      "area",
      "floor",
    ]);
    expect(attributeChips("ru", { propertyType: "land", areaTotal: 600 }).map((c) => c.key)).toEqual(["area"]);
    // A house has no "floor", but its storey count is still worth showing.
    expect(attributeChips("uz", { propertyType: "house", rooms: 4, areaTotal: 180, floorsTotal: 2 })).toEqual([
      { key: "rooms", text: "4 xona", unknown: false },
      { key: "area", text: "180 m²", unknown: false },
      { key: "floor", text: "Qavatlar: 2", unknown: false },
    ]);
  });
});

describe("latestPriceChange", () => {
  const step = (amount: number, at: string, currency: "USD" | "UZS" = "USD") => ({
    price: money(amount, currency),
    at,
    byAgentId: "agent-01",
  });

  it("reports the direction of the most recent change", () => {
    const listing: Pick<Listing, "priceHistory"> = {
      priceHistory: [step(115000, "2026-08-01T00:00:00Z"), step(112000, "2026-09-10T00:00:00Z"), step(108000, "2026-09-27T00:00:00Z")],
    };
    expect(latestPriceChange(listing)).toEqual({
      previous: money(112000, "USD"),
      current: money(108000, "USD"),
      at: "2026-09-27T00:00:00Z",
      direction: "down",
    });
  });

  it("ignores single prices, unchanged prices and currency switches", () => {
    expect(latestPriceChange({ priceHistory: [step(1, "2026-01-01T00:00:00Z")] })).toBeUndefined();
    expect(
      latestPriceChange({ priceHistory: [step(5, "2026-01-01T00:00:00Z"), step(5, "2026-02-01T00:00:00Z")] }),
    ).toBeUndefined();
    expect(
      latestPriceChange({
        priceHistory: [step(600, "2026-01-01T00:00:00Z"), step(7_000_000, "2026-02-01T00:00:00Z", "UZS")],
      }),
    ).toBeUndefined();
  });
});

describe("verificationSummary", () => {
  const item = (subject: VerificationItem["subject"], status: VerificationItem["status"]): VerificationItem => ({
    id: subject,
    subject,
    status,
    method: "official_source",
    source: "demo",
  });

  it("never counts an unavailable source as confirmed", () => {
    expect(
      verificationSummary([
        item("ownership", "confirmed"),
        item("encumbrance", "unavailable"),
        item("utility_debts", "pending"),
        item("cadastre", "problem"),
      ]),
    ).toEqual({ total: 4, confirmed: 1, pending: 1, unavailable: 1, problems: ["cadastre"] });
  });
});

describe("telegramFacts", () => {
  it("keeps only confident parsed fields", () => {
    const parsed: TelegramListing["parsed"] = {
      dealType: { value: "sale", confidence: 0.95 },
      propertyType: { value: "apartment", confidence: 0.9 },
      district: { value: "mirabad", confidence: 0.4 },
      rooms: { value: 3, confidence: 0.8 },
      areaTotal: { confidence: 0 },
      floor: { value: 5, confidence: 0.6 },
      floorsTotal: { value: 9, confidence: 0.59 },
      price: { confidence: 0 },
      phone: { value: "+998901234567", confidence: 0.95 },
    };
    expect(telegramFacts({ parsed })).toEqual({ propertyType: "apartment", rooms: 3, floor: 5 });
  });
});
