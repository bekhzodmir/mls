import { describe, expect, it } from "vitest";
import { computeFreshness, daysBetween, defaultFreshnessConfig, needsAttention } from "./freshness";

const NOW = new Date("2026-09-30T06:00:00.000Z");
const DAY = 86_400_000;

/** ISO instant `days` (fractional allowed) before NOW. */
function ago(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

describe("daysBetween", () => {
  it("counts whole elapsed days and never goes negative", () => {
    expect(daysBetween(ago(0), NOW)).toBe(0);
    expect(daysBetween(ago(0.99), NOW)).toBe(0);
    expect(daysBetween(ago(1), NOW)).toBe(1);
    expect(daysBetween(ago(-2), NOW)).toBe(0);
  });
});

describe("computeFreshness bands (§13.4)", () => {
  const stateAt = (days: number) => computeFreshness({ publishedAt: ago(days) }, NOW).state;

  it("uses the 0–3 / 4–7 / 8–14 / 15+ boundaries", () => {
    expect(stateAt(0)).toBe("fresh");
    expect(stateAt(3)).toBe("fresh");
    expect(stateAt(3.99)).toBe("fresh");
    expect(stateAt(4)).toBe("normal");
    expect(stateAt(7)).toBe("normal");
    expect(stateAt(8)).toBe("aging");
    expect(stateAt(14)).toBe("aging");
    expect(stateAt(15)).toBe("needs_confirmation");
    expect(stateAt(90)).toBe("needs_confirmation");
  });

  it("decays the score linearly to 0.2 and floors at 0.1 until confirmed", () => {
    const scoreAt = (days: number) => computeFreshness({ publishedAt: ago(days) }, NOW).score;
    expect(scoreAt(0)).toBe(1);
    expect(scoreAt(7)).toBe(0.6);
    expect(scoreAt(14)).toBe(0.2);
    expect(scoreAt(15)).toBe(0.1);
    expect(scoreAt(365)).toBe(0.1);
  });

  it("respects a custom configuration", () => {
    const config = { ...defaultFreshnessConfig, freshMaxDays: 1 };
    expect(computeFreshness({ publishedAt: ago(2) }, NOW, config).state).toBe("normal");
  });
});

describe("computeFreshness basis", () => {
  it("measures from the confirmation when it is newer than the publication", () => {
    const result = computeFreshness({ publishedAt: ago(30), lastConfirmedAt: ago(2) }, NOW);
    expect(result).toMatchObject({ basis: "last_confirmed", ageDays: 2, state: "fresh" });
  });

  it("ignores a confirmation older than the publication", () => {
    const result = computeFreshness({ publishedAt: ago(5), lastConfirmedAt: ago(20) }, NOW);
    expect(result).toMatchObject({ basis: "published", ageDays: 5, state: "normal" });
  });

  it("uses the publication when there is no confirmation", () => {
    expect(computeFreshness({ publishedAt: ago(10) }, NOW)).toMatchObject({ basis: "published", ageDays: 10 });
  });
});

describe("expiry (§34.6)", () => {
  it("is expired from the expiry instant on, whatever the age", () => {
    const input = { publishedAt: ago(1), expiresAt: NOW.toISOString() };
    expect(computeFreshness(input, NOW)).toEqual({ state: "expired", score: 0, ageDays: 1, basis: "published" });
    expect(computeFreshness({ ...input, expiresAt: ago(-0.01) }, NOW).state).toBe("fresh");
  });

  it("flags only stale and expired offers for attention", () => {
    expect(needsAttention(computeFreshness({ publishedAt: ago(20) }, NOW))).toBe(true);
    expect(needsAttention(computeFreshness({ publishedAt: ago(1), expiresAt: ago(0.5) }, NOW))).toBe(true);
    expect(needsAttention(computeFreshness({ publishedAt: ago(10) }, NOW))).toBe(false);
  });
});
