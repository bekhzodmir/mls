import { describe, expect, it } from "vitest";
import { getTelegramListing, listListings, listTelegramListings } from "@/lib/data/repository";
import { money } from "@/lib/domain/money";
import type { TelegramListing } from "@/lib/domain/types";
import { duplicatePool } from "./duplicate-pool";
import {
  checkDuplicates,
  DRAFT_RECORD_ID,
  draftDedupRecord,
  emptyValues,
  fieldsFor,
  prefillFromTelegram,
  validateNewProperty,
  type NewPropertyValues,
} from "./new-property";

async function post(id: string): Promise<TelegramListing> {
  const detail = await getTelegramListing(id);
  if (!detail) throw new Error(`missing ${id}`);
  return detail.post;
}

function values(overrides: Partial<NewPropertyValues>): NewPropertyValues {
  return { ...emptyValues(), ...overrides };
}

describe("prefillFromTelegram", () => {
  it("fills confident fields and remembers their evidence", async () => {
    const prefill = prefillFromTelegram(await post("tg-01"));
    expect(prefill.values).toMatchObject({
      dealType: "sale",
      propertyType: "apartment",
      district: "chilanzar",
      price: "68000",
      currency: "USD",
      rooms: "2",
      areaTotal: "54",
      floor: "3",
      floorsTotal: "4",
      address: "",
    });
    expect(prefill.marks.price).toEqual({ confidence: 0.9, evidence: "68 000 $" });
    expect(prefill.uncertain).toEqual([]);
    expect(prefill.dedup.phone).toBe("+998970005101");
    expect(prefill.sourceUrl).toMatch(/^https:\/\/t\.me\//);
  });

  it("leaves weakly parsed fields empty and lists them", async () => {
    // tg-04 names a district with confidence 0.4 and no price at all.
    const prefill = prefillFromTelegram(await post("tg-04"));
    expect(prefill.values.district).toBeUndefined();
    expect(prefill.values.price).toBe("");
    expect(prefill.values.currency).toBeUndefined();
    expect(prefill.uncertain).toEqual(["district"]);
    expect(prefill.marks.district).toBeUndefined();
  });
});

describe("validateNewProperty", () => {
  it("requires type, deal, district, price and an explicit currency", () => {
    const result = validateNewProperty(emptyValues());
    expect(result).toEqual({
      ok: false,
      errors: { propertyType: "required", dealType: "required", district: "required", price: "required", currency: "required" },
    });
    const noCurrency = validateNewProperty(
      values({ propertyType: "apartment", dealType: "sale", district: "mirabad", price: "92 000" }),
    );
    expect(noCurrency).toEqual({ ok: false, errors: { currency: "required" } });
  });

  it("parses amounts exactly into minor units", () => {
    const result = validateNewProperty(
      values({ propertyType: "apartment", dealType: "rent", district: "yakkasaray", price: "5 500 000", currency: "UZS" }),
    );
    expect(result).toEqual({
      ok: true,
      draft: { propertyType: "apartment", dealType: "rent", district: "yakkasaray", price: money(5_500_000, "UZS") },
    });
  });

  it("explains bad numbers and an impossible floor", () => {
    const result = validateNewProperty(
      values({
        propertyType: "apartment",
        dealType: "sale",
        district: "chilanzar",
        price: "70к",
        currency: "USD",
        rooms: "2.5",
        areaTotal: "abc",
        floor: "7",
        floorsTotal: "5",
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: { price: "amount", rooms: "integer", areaTotal: "decimal", floor: "floor_above_total" },
    });
  });

  it("drops attributes the property type does not have", () => {
    expect(fieldsFor("land")).toEqual({ rooms: false, floor: false, floorsTotal: false });
    const result = validateNewProperty(
      values({
        propertyType: "land",
        dealType: "sale",
        district: "bektemir",
        price: "30000",
        currency: "USD",
        rooms: "junk",
        floor: "junk",
        areaTotal: "600",
      }),
    );
    expect(result.ok && result.draft).toEqual({
      propertyType: "land",
      dealType: "sale",
      district: "bektemir",
      price: money(30000, "USD"),
      areaTotal: 600,
    });
  });
});

describe("checkDuplicates", () => {
  async function pool() {
    return duplicatePool("ru", await listListings(), await listTelegramListings());
  }

  it("finds a repost of the same Telegram ad and never the source post itself", async () => {
    const source = await post("tg-01");
    const prefill = prefillFromTelegram(source);
    const result = validateNewProperty(prefill.values);
    if (!result.ok) throw new Error("tg-01 should prefill a valid draft");
    const target = draftDedupRecord(result.draft, prefill.dedup);
    expect(target.id).toBe(DRAFT_RECORD_ID);

    const matches = checkDuplicates(target, await pool(), [source.id]);
    expect(matches.map((match) => match.entry.id)).not.toContain("tg-01");
    expect(matches[0].entry.id).toBe("tg-07");
    expect(matches[0].candidate.recommendation).toBe("likely_duplicate");
    expect(matches[0].candidate.signals).toContain("same_phone");
  });

  it("suggests both listings of one physical property and leaves the decision to the agent", async () => {
    const result = validateNewProperty(
      values({
        propertyType: "apartment",
        dealType: "sale",
        district: "chilanzar",
        price: "69 000",
        currency: "USD",
        rooms: "2",
        areaTotal: "52",
        floor: "2",
        floorsTotal: "4",
      }),
    );
    if (!result.ok) throw new Error("draft should be valid");
    const matches = checkDuplicates(draftDedupRecord(result.draft), await pool());
    const listings = matches.filter((match) => match.entry.kind === "listing");
    expect(listings.map((match) => match.entry.id).sort()).toEqual(["lst-17", "lst-22"]);
    expect(new Set(listings.map((match) => match.entry.propertyId))).toEqual(new Set(["prop-17"]));
    // Physical attributes alone never make a "likely duplicate" (§34.5).
    expect(listings.every((match) => match.candidate.recommendation === "review")).toBe(true);
  });

  it("builds pool labels without restricted data", async () => {
    const entries = await pool();
    const masked = entries.find((entry) => entry.id === "lst-16");
    expect(masked?.access).toBe("partner_masked");
    expect(masked?.record.phone).toBeUndefined();
    expect(JSON.stringify(masked)).not.toMatch(/кв\.\s*\d/);
    expect(masked?.path).toBe("/properties/lst-16");
  });
});
