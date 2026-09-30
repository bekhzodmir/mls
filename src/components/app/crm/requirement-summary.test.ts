import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import type { Requirement } from "@/lib/domain/types";
import {
  formatArea,
  formatBudget,
  formatDistricts,
  formatRooms,
  requirementChips,
  requirementSummary,
} from "./requirement-summary";

const base: Pick<Requirement, "dealType" | "propertyTypes" | "districts" | "rooms" | "area" | "budget"> = {
  dealType: "sale",
  propertyTypes: ["apartment"],
  districts: ["chilanzar"],
  rooms: { min: 2, max: 3 },
  area: {},
  budget: { max: money(75_000, "USD"), currency: "USD" },
};

describe("ranges", () => {
  it("formats rooms in Russian and Uzbek word order", () => {
    expect(formatRooms("ru", { min: 2, max: 3 })).toBe("2–3 комн.");
    expect(formatRooms("ru", { min: 2, max: 2 })).toBe("2-комн.");
    expect(formatRooms("ru", { min: 2 })).toBe("от 2 комн.");
    expect(formatRooms("uz", { max: 3 })).toBe("3 xonaligacha");
    expect(formatRooms("uz", { min: 2 })).toBe("kamida 2 xonali");
    expect(formatRooms("ru", {})).toBeUndefined();
  });

  it("formats area and budget", () => {
    expect(formatArea("ru", { min: 50, max: 75.5 })).toBe("50–75,5 м²");
    expect(formatBudget("ru", { max: money(75_000, "USD") })).toMatch(/^до \$75\s000$/);
    expect(formatBudget("uz", { max: money(6_000_000, "UZS") })).toMatch(/^6\s000\s000 so‘m gacha$/);
    expect(formatBudget("ru", { min: money(70_000, "USD"), max: money(95_000, "USD") })).toMatch(
      /^\$70\s000 – \$95\s000$/,
    );
    expect(formatBudget("ru", {})).toBeUndefined();
  });

  it("names up to two districts and counts the rest, or says 'any district'", () => {
    expect(formatDistricts("ru", [])).toBe("Любой район");
    expect(formatDistricts("uz", ["chilanzar", "yunusabad", "mirabad"])).toBe("Chilonzor, Yunusobod +1");
  });
});

describe("requirementChips", () => {
  it("lists only what the requirement says, in reading order", () => {
    expect(requirementChips("ru", base).slice(0, 4)).toEqual(["Продажа", "Квартира", "Чиланзар", "2–3 комн."]);
    expect(requirementChips("ru", base)).toHaveLength(5);
  });

  it("does not invent a property type or area when none is set", () => {
    const chips = requirementChips("uz", { ...base, propertyTypes: [], rooms: {}, budget: { currency: "USD" } });
    expect(chips).toEqual(["Sotuv", "Chilonzor"]);
  });

  it("joins the chips into one line", () => {
    expect(requirementSummary("ru", { ...base, budget: { currency: "USD" } })).toBe(
      "Продажа · Квартира · Чиланзар · 2–3 комн.",
    );
  });
});
