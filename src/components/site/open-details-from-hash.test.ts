import { describe, expect, it } from "vitest";
import { fragmentId } from "./open-details-from-hash";

describe("fragmentId", () => {
  it("decodes an escaped fragment", () => {
    expect(fragmentId("#visibility")).toBe("visibility");
    expect(fragmentId("#%D1%86%D0%B5%D0%BD%D0%B0")).toBe("цена");
    expect(fragmentId("")).toBe("");
  });

  it("keeps a malformed escape as typed instead of throwing", () => {
    expect(() => fragmentId("#50%-скидка")).not.toThrow();
    expect(fragmentId("#50%-скидка")).toBe("50%-скидка");
    expect(fragmentId("#%E0%A4%A")).toBe("%E0%A4%A");
  });
});
