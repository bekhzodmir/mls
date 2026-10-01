import { describe, expect, it } from "vitest";
import {
  applyLoginHandoff,
  firstErrorField,
  firstInvalidStep,
  initialOnboardingState,
  isValidTelegramUsername,
  normalizeTelegramUsername,
  type OnboardingAction,
  onboardingReducer,
  type OnboardingState,
  parseOnboardingState,
  serializeOnboardingState,
  stepPosition,
  validateStep,
  visibleErrors,
  visibleSteps,
} from "./onboarding-state";

function run(state: OnboardingState, ...actions: OnboardingAction[]): OnboardingState {
  return actions.reduce(onboardingReducer, state);
}

const start = initialOnboardingState("ru");

/** An individual realtor who filled in the required fields. */
const individualAtProfile = run(
  start,
  { type: "next" },
  { type: "role", role: "individual_realtor" },
  { type: "legalStatus", status: "unconfirmed" },
  { type: "next" },
);

describe("steps", () => {
  it("skips the agency step only for an individual realtor", () => {
    expect(visibleSteps(undefined)).toEqual(["language", "work", "profile", "agency", "done"]);
    expect(visibleSteps("agency_agent")).toContain("agency");
    expect(visibleSteps("individual_realtor")).toEqual(["language", "work", "profile", "done"]);
  });

  it("reports the position for the progress indicator", () => {
    expect(stepPosition(start)).toEqual({ current: 1, total: 5 });
    expect(stepPosition(individualAtProfile)).toEqual({ current: 3, total: 4 });
  });

  it("defaults the working languages to the interface language", () => {
    expect(initialOnboardingState("uz").data.languages).toEqual(["uz"]);
  });
});

describe("validation", () => {
  it("needs a work format and a legal status (with «Пока не знаю» available)", () => {
    expect(validateStep("work", start.data)).toEqual({ role: "required", legalStatus: "required" });
    expect(validateStep("work", { ...start.data, role: "agency_agent", legalStatus: "unconfirmed" })).toEqual({});
  });

  it("needs only a name and a valid phone on the profile step", () => {
    expect(validateStep("profile", start.data)).toEqual({ name: "required", phone: "required" });
    expect(validateStep("profile", { ...start.data, name: "Aziz", phone: "90 123 45 67" })).toEqual({});
  });

  it("never blocks on empty optional fields but rejects a malformed value", () => {
    const base = { ...start.data, name: "Aziz", phone: "+998 90 123 45 67" };
    expect(validateStep("profile", { ...base, telegram: "", certificate: "" })).toEqual({});
    expect(validateStep("profile", { ...base, telegram: "@ab" })).toEqual({ telegram: "invalid" });
    expect(validateStep("profile", { ...base, phone: "90 12" })).toEqual({ phone: "incomplete" });
  });

  it("checks the agency step only for agency roles", () => {
    const agent = { ...start.data, role: "agency_agent" as const };
    expect(validateStep("agency", { ...start.data, role: "individual_realtor" })).toEqual({});
    expect(validateStep("agency", agent)).toEqual({ agencyMode: "required" });
    expect(validateStep("agency", { ...agent, agencyMode: "create" })).toEqual({ agencyName: "required" });
    expect(validateStep("agency", { ...agent, agencyMode: "create", agencyName: "Uy", agencyPhone: "90 1" })).toEqual({
      agencyPhone: "incomplete",
    });
    expect(validateStep("agency", { ...agent, agencyMode: "create", agencyName: "Uy" })).toEqual({});
    expect(validateStep("agency", { ...agent, agencyMode: "join" })).toEqual({ inviteCode: "required" });
    expect(validateStep("agency", { ...agent, agencyMode: "join", inviteCode: "abc" })).toEqual({
      inviteCode: "tooShort",
    });
    expect(validateStep("agency", { ...agent, agencyMode: "join", inviteCode: " DEMO-42 " })).toEqual({});
  });

  it("picks the first invalid field in screen order", () => {
    expect(firstErrorField({ phone: "required", name: "required" })).toBe("name");
    expect(firstErrorField({})).toBeUndefined();
  });
});

describe("telegram username", () => {
  it("accepts the forms people paste", () => {
    for (const raw of ["@binor_agent", "binor_agent", "t.me/binor_agent", "https://t.me/binor_agent/"]) {
      expect(normalizeTelegramUsername(raw)).toBe("binor_agent");
    }
  });

  it("follows Telegram's rules", () => {
    expect(isValidTelegramUsername("binor_agent")).toBe(true);
    expect(isValidTelegramUsername("abcd")).toBe(false);
    expect(isValidTelegramUsername("1binor")).toBe(false);
    expect(isValidTelegramUsername("бинор_агент")).toBe(false);
  });
});

describe("reducer", () => {
  it("does not advance past an invalid step and starts showing its errors", () => {
    const atWork = run(start, { type: "next" });
    expect(atWork.step).toBe("work");
    expect(visibleErrors(atWork)).toEqual({});
    const tried = run(atWork, { type: "next" });
    expect(tried.step).toBe("work");
    expect(visibleErrors(tried)).toEqual({ role: "required", legalStatus: "required" });
  });

  it("walks an individual realtor to the summary without the agency step", () => {
    const done = run(
      individualAtProfile,
      { type: "text", field: "name", value: "Aziz Rahimov" },
      { type: "text", field: "phone", value: "90 123 45 67" },
      { type: "next" },
    );
    expect(done.step).toBe("done");
  });

  it("goes through the agency step for agency roles and pre-selects a sensible mode", () => {
    const owner = run(start, { type: "next" }, { type: "role", role: "agency_owner" });
    expect(owner.data.agencyMode).toBe("create");
    const agent = run(start, { type: "role", role: "agency_agent" });
    expect(agent.data.agencyMode).toBe("join");

    const atAgency = run(
      owner,
      { type: "legalStatus", status: "certified_realtor" },
      { type: "next" },
      { type: "text", field: "name", value: "Aziz" },
      { type: "text", field: "phone", value: "901234567" },
      { type: "next" },
    );
    expect(atAgency.step).toBe("agency");
    expect(run(atAgency, { type: "next" }).step).toBe("agency");
    expect(run(atAgency, { type: "text", field: "agencyName", value: "Uy Realty" }, { type: "next" }).step).toBe("done");
  });

  it("goes back one visible step at a time", () => {
    expect(run(individualAtProfile, { type: "back" }).step).toBe("work");
    expect(run(start, { type: "back" }).step).toBe("language");
  });

  it("returns to the summary after editing a step from it", () => {
    const done = run(
      individualAtProfile,
      { type: "text", field: "name", value: "Aziz" },
      { type: "text", field: "phone", value: "901234567" },
      { type: "next" },
    );
    const editing = run(done, { type: "goTo", step: "work" });
    expect(editing).toMatchObject({ step: "work", reviewing: true });
    expect(run(editing, { type: "next" })).toMatchObject({ step: "done", reviewing: false });

    // Switching to an agency role makes the agency step necessary first.
    const nowAgent = run(editing, { type: "role", role: "agency_agent" }, { type: "next" });
    expect(nowAgent.step).toBe("agency");
    expect(run(nowAgent, { type: "text", field: "inviteCode", value: "DEMO-2026" }, { type: "next" }).step).toBe("done");
  });

  it("does not jump forward over unfinished steps", () => {
    expect(run(start, { type: "goTo", step: "profile" }).step).toBe("language");
    expect(run(individualAtProfile, { type: "goTo", step: "language" }).step).toBe("language");
  });

  it("toggles multi-select chips and caps typed text", () => {
    const state = run(
      start,
      { type: "toggleDistrict", id: "chilanzar" },
      { type: "toggleDistrict", id: "yunusabad" },
      { type: "toggleDistrict", id: "chilanzar" },
      { type: "togglePropertyType", id: "apartment" },
      { type: "toggleLanguage", id: "uz" },
      { type: "text", field: "certificate", value: "x".repeat(500) },
    );
    expect(state.data.districts).toEqual(["yunusabad"]);
    expect(state.data.propertyTypes).toEqual(["apartment"]);
    expect(state.data.languages).toEqual(["ru", "uz"]);
    expect(state.data.certificate).toHaveLength(64);
  });
});

describe("login hand-off", () => {
  it("prefills only empty fields", () => {
    const filled = applyLoginHandoff(start, {
      phone: "+998901234567",
      telegram: { firstName: "Dilnoza", lastName: "Karimova", username: "dilnoza_r" },
    });
    expect(filled.data).toMatchObject({ phone: "+998 90 123 45 67", name: "Dilnoza Karimova", telegram: "@dilnoza_r" });
    expect(filled.phoneFromLogin).toBe(true);

    const own = run(start, { type: "text", field: "name", value: "Aziz" });
    expect(applyLoginHandoff(own, { telegram: { firstName: "Dilnoza" } }).data.name).toBe("Aziz");
  });

  it("forgets the hand-over note once the phone is edited", () => {
    const filled = applyLoginHandoff(start, { phone: "+998901234567" });
    expect(run(filled, { type: "text", field: "phone", value: "+998 90 123 45 6" }).phoneFromLogin).toBe(false);
  });
});

describe("storage round trip", () => {
  it("restores what was saved", () => {
    const saved = run(individualAtProfile, { type: "text", field: "name", value: "Aziz" }, { type: "toggleDistrict", id: "mirabad" });
    expect(parseOnboardingState(serializeOnboardingState(saved), "ru")).toEqual(saved);
  });

  it("rejects garbage and unknown versions", () => {
    expect(parseOnboardingState(null, "ru")).toBeNull();
    expect(parseOnboardingState("{", "ru")).toBeNull();
    expect(parseOnboardingState(JSON.stringify({ v: 2, data: {} }), "ru")).toBeNull();
  });

  it("drops unknown codes and moves back to the first unfinished step", () => {
    const tampered = JSON.stringify({
      v: 1,
      step: "done",
      data: { role: "binor_admin", districts: ["chilanzar", "atlantis", "chilanzar"], name: 5 },
      attempted: ["work", "nope"],
    });
    const restored = parseOnboardingState(tampered, "uz");
    expect(restored?.data.role).toBeUndefined();
    expect(restored?.data.districts).toEqual(["chilanzar"]);
    expect(restored?.data.name).toBe("");
    expect(restored?.data.languages).toEqual(["uz"]);
    expect(restored?.attempted).toEqual(["work"]);
    expect(restored?.step).toBe("work");
    expect(firstInvalidStep(restored!.data)).toBe("work");
  });
});
