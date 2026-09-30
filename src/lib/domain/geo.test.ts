import { describe, expect, it } from "vitest";
import { areNeighbours, districtName, districtNeighbours, districts } from "./geo";
import { districtIds } from "./types";

describe("districts", () => {
  it("covers exactly the twelve Tashkent districts", () => {
    expect(Object.keys(districts).sort()).toEqual([...districtIds].sort());
    expect(Object.keys(districtNeighbours).sort()).toEqual([...districtIds].sort());
  });

  it("keeps parser variants lower-case and unique", () => {
    for (const id of districtIds) {
      const { variants } = districts[id];
      for (const variant of variants) expect(variant).toBe(variant.toLocaleLowerCase("ru"));
      expect(new Set(variants).size).toBe(variants.length);
    }
  });

  it("names districts in both languages with Uzbek ‘ (U+2018)", () => {
    expect(districtName("chilanzar", "ru")).toBe("Чиланзар");
    expect(districtName("chilanzar", "uz")).toBe("Chilonzor");
    expect(districtName("mirzo_ulugbek", "uz")).toBe("Mirzo Ulug‘bek");
    for (const id of districtIds) expect(districts[id].uz).not.toMatch(/['ʻʼ`]/);
  });
});

describe("district neighbours", () => {
  it("lists every neighbour relation in both directions", () => {
    for (const a of districtIds) {
      for (const b of districtNeighbours[a]) {
        expect(districtNeighbours[b], `${b} should list ${a}`).toContain(a);
      }
    }
  });

  it("is symmetric, irreflexive and free of unknown ids", () => {
    for (const a of districtIds) {
      expect(areNeighbours(a, a)).toBe(false);
      for (const b of districtNeighbours[a]) expect(districtIds).toContain(b);
      for (const b of districtIds) expect(areNeighbours(a, b)).toBe(areNeighbours(b, a));
    }
  });

  it("gives every district at least one neighbour", () => {
    for (const id of districtIds) expect(districtNeighbours[id].length).toBeGreaterThan(0);
  });

  it("matches a few well-known adjacencies", () => {
    expect(areNeighbours("chilanzar", "uchtepa")).toBe(true);
    expect(areNeighbours("yunusabad", "mirzo_ulugbek")).toBe(true);
    expect(areNeighbours("bektemir", "uchtepa")).toBe(false);
  });
});
