import { describe, expect, it } from "vitest";
import { localizedHref, localizedPath } from "./locale-switch";

describe("localizedHref", () => {
  it("keeps the query string, so switching language keeps the record context and filters", () => {
    expect(
      localizedHref("/ru/app/mls/cooperation/new", "uz", "listingId=lst-23&requirementId=req-01"),
    ).toBe("/uz/app/mls/cooperation/new?listingId=lst-23&requirementId=req-01");
    expect(localizedHref("/uz/app/properties", "ru", "?status=active_mls&district=chilanzar")).toBe(
      "/ru/app/properties?status=active_mls&district=chilanzar",
    );
  });

  it("adds no empty query", () => {
    expect(localizedHref("/ru/faq", "uz", "")).toBe("/uz/faq");
    expect(localizedPath("/", "uz")).toBe("/uz/");
  });
});
