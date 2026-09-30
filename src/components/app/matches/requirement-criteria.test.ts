import { describe, expect, it } from "vitest";
import { getRequirement } from "@/lib/data/repository";
import { propertyListHref } from "@/components/app/inventory/filters";
import { propertySearchFor, requirementCriteria } from "./requirement-criteria";

/** Intl separates thousands with no-break spaces; compare with plain ones. */
function plainSpaces<T extends { value: string }>(items: T[]): T[] {
  return items.map((item) => ({ ...item, value: item.value.replace(/[\u00a0\u202f]/g, " ") }));
}

async function requirement(id: string) {
  const view = await getRequirement(id);
  if (!view) throw new Error(`missing ${id}`);
  return view.requirement;
}

describe("requirementCriteria", () => {
  it("lists what the client asked for, marking hard constraints", async () => {
    const { items, unset } = requirementCriteria("ru", await requirement("req-01"));
    expect(plainSpaces(items)).toEqual([
      { key: "dealType", value: "Продажа", hard: true },
      { key: "propertyType", value: "Квартира", hard: false },
      { key: "location", value: "Чиланзар", hard: true },
      { key: "rooms", value: "2–3", hard: false },
      { key: "area", value: "50–75 м²", hard: false },
      { key: "price", value: "до $75 000", hard: false },
      { key: "floor", value: "не первый", hard: false },
      { key: "buildingKind", value: "Вторичка", hard: false },
    ]);
    expect(unset).toEqual(["renovation", "mortgage", "extras"]);
  });

  it("speaks Uzbek word order and keeps exact ranges short", async () => {
    const items = plainSpaces(requirementCriteria("uz", await requirement("req-08")).items);
    expect(items).toContainEqual({ key: "rooms", value: "2", hard: false });
    expect(items).toContainEqual({ key: "area", value: "55 m² dan", hard: false });
    expect(items).toContainEqual({ key: "price", value: "$90 000 gacha", hard: false });
    expect(items).toContainEqual({ key: "buildingKind", value: "Yangi bino", hard: true });
    expect(items).toContainEqual({ key: "mortgage", value: "kerak", hard: false });
  });
});

describe("propertySearchFor", () => {
  it("turns unambiguous criteria into property-list filters with an explicit currency", async () => {
    const params = propertySearchFor(await requirement("req-01"));
    expect(propertyListHref("ru", params)).toBe(
      "/ru/app/properties?dealType=sale&propertyType=apartment&district=chilanzar&roomsMin=2&roomsMax=3&priceMax=75000&currency=USD",
    );
  });
});
