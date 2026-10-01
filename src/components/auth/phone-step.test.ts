import { describe, expect, it } from "vitest";
import { phoneInputState, phoneMessage, phoneProblem } from "./phone-step";

describe("phoneInputState", () => {
  it("normalizes common spellings to +998 E.164", () => {
    for (const raw of ["90 123 45 67", "+998 (90) 123-45-67", "998901234567", "8 90 123 45 67"]) {
      expect(phoneInputState(raw)).toEqual({ state: "valid", e164: "+998901234567" });
    }
  });

  it("treats missing digits as incomplete, not as an error", () => {
    expect(phoneInputState("90 12")).toEqual({ state: "incomplete" });
    expect(phoneInputState("+998")).toEqual({ state: "incomplete" });
    expect(phoneInputState("+998 90 123 45")).toEqual({ state: "incomplete" });
  });

  it("rejects numbers that more digits cannot fix", () => {
    expect(phoneInputState("0 90 123")).toEqual({ state: "invalid" });
    expect(phoneInputState("+998 09 123 45 67")).toEqual({ state: "invalid" });
    expect(phoneInputState("90 123 45 67 89 0")).toEqual({ state: "invalid" });
  });

  it("is empty without digits", () => {
    expect(phoneInputState("")).toEqual({ state: "empty" });
    expect(phoneInputState("+ ( )")).toEqual({ state: "empty" });
  });
});

describe("phoneProblem", () => {
  it("names what blocks a required phone", () => {
    expect(phoneProblem("")).toBe("required");
    expect(phoneProblem("90 1")).toBe("incomplete");
    expect(phoneProblem("0123")).toBe("invalid");
    expect(phoneProblem("+998 90 123 45 67")).toBeNull();
  });
});

describe("phoneMessage", () => {
  const typing = { touched: false, submitted: false };

  it("hints while typing and confirms a recognized number", () => {
    expect(phoneMessage("", typing)).toEqual({ tone: "hint", key: "hint" });
    expect(phoneMessage("90 12", typing)).toEqual({ tone: "hint", key: "incomplete" });
    expect(phoneMessage("901234567", typing)).toEqual({ tone: "valid", e164: "+998901234567" });
  });

  it("turns missing digits into an error after leaving the field", () => {
    expect(phoneMessage("90 12", { touched: true, submitted: false })).toEqual({ tone: "error", key: "incomplete" });
  });

  it("asks for an empty required phone only after a submit attempt", () => {
    expect(phoneMessage("", { touched: true, submitted: false })).toEqual({ tone: "hint", key: "hint" });
    expect(phoneMessage("", { touched: false, submitted: true })).toEqual({ tone: "error", key: "required" });
  });

  it("never requires an optional phone", () => {
    expect(phoneMessage("", { touched: true, submitted: true, required: false })).toEqual({ tone: "hint", key: "hint" });
    expect(phoneMessage("90 1", { touched: true, submitted: true, required: false })).toEqual({
      tone: "error",
      key: "incomplete",
    });
  });

  it("flags an impossible number at once", () => {
    expect(phoneMessage("0", typing)).toEqual({ tone: "error", key: "invalid" });
  });
});
