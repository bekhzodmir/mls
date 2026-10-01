import { formatUzPhone } from "@/lib/domain/phone";
import {
  districtIds,
  propertyTypes,
  type DistrictId,
  type Language,
  type ProfessionalStatus,
  type PropertyType,
  type UserRole,
} from "@/lib/domain/types";
import { phoneProblem } from "./phone-step";
import type { LoginHandoff } from "./session-store";

/**
 * State of the onboarding wizard (§21.4 screens 5–9, §20.3 progressive
 * disclosure). Pure: the client component keeps it in `useReducer` and copies
 * it to sessionStorage, so a reload keeps progress. Nothing is sent anywhere.
 *
 * Each step asks only for what it needs; optional fields never block, but a
 * value that was typed must be well-formed (a half-typed phone, a malformed
 * Telegram username).
 */

/* ------------------------------------------------------------ vocabulary */

/** Roles offered at sign-up; the other `UserRole`s are granted inside an organization. */
export const onboardingRoles = ["individual_realtor", "agency_agent", "agency_owner"] as const satisfies readonly UserRole[];
export type OnboardingRole = (typeof onboardingRoles)[number];

/**
 * Legal status is a separate question from the work format (§38.2): a
 * certified realtor and a real-estate agent (self-employed / sole trader) are
 * different statuses under ZRU-1163. "unconfirmed" is the «Пока не знаю» answer.
 * Whatever is chosen is self-declared and never shown as verified (§41 D14).
 */
export const legalStatusOptions = [
  "certified_realtor",
  "real_estate_agent",
  "unconfirmed",
] as const satisfies readonly ProfessionalStatus[];

export const workLanguages = ["ru", "uz"] as const satisfies readonly Language[];

export const agencyModes = ["create", "join"] as const;
export type AgencyMode = (typeof agencyModes)[number];

export const onboardingSteps = ["language", "work", "profile", "agency", "done"] as const;
export type StepId = (typeof onboardingSteps)[number];

/** Demo invitations: any code of at least this many characters is "found". */
export const MIN_INVITE_CODE_LENGTH = 6;

/** Upper bounds for typed text, mirrored by `maxLength` on the inputs. */
export const fieldLimits = {
  name: 120,
  phone: 32,
  telegram: 64,
  certificate: 64,
  agencyName: 120,
  agencyPhone: 32,
  agencyBranch: 120,
  inviteCode: 64,
} as const;

export type TextField = keyof typeof fieldLimits;

export interface OnboardingData {
  role?: OnboardingRole;
  legalStatus?: ProfessionalStatus;
  name: string;
  /** As typed; normalized with `normalizeUzPhone` when shown in the summary. */
  phone: string;
  telegram: string;
  districts: DistrictId[];
  propertyTypes: PropertyType[];
  languages: Language[];
  /** Self-declared; Binor has not checked it. */
  certificate: string;
  agencyMode?: AgencyMode;
  agencyName: string;
  agencyPhone: string;
  agencyBranch: string;
  inviteCode: string;
}

export interface OnboardingState {
  step: StepId;
  data: OnboardingData;
  /** Steps where Next was pressed at least once; their errors are shown live. */
  attempted: StepId[];
  /** A step opened from the summary: Next goes straight back to it when all is valid. */
  reviewing: boolean;
  /** The phone was handed over by the sign-in screen (explained next to the field). */
  phoneFromLogin: boolean;
}

export function initialOnboardingState(language: Language): OnboardingState {
  return {
    step: "language",
    data: {
      name: "",
      phone: "",
      telegram: "",
      districts: [],
      propertyTypes: [],
      // Smart default (§20.4): the interface language is usually a working one.
      languages: [language],
      certificate: "",
      agencyName: "",
      agencyPhone: "",
      agencyBranch: "",
      inviteCode: "",
    },
    attempted: [],
    reviewing: false,
    phoneFromLogin: false,
  };
}

/* ----------------------------------------------------------------- steps */

export function isAgencyRole(role: OnboardingRole | undefined): boolean {
  return role === "agency_agent" || role === "agency_owner";
}

/**
 * The steps this person goes through. The agency step is skipped only once
 * "Индивидуальный риэлтор" is chosen; before the choice it is still counted,
 * so the total can only shrink.
 */
export function visibleSteps(role: OnboardingRole | undefined): StepId[] {
  return role === "individual_realtor" ? onboardingSteps.filter((step) => step !== "agency") : [...onboardingSteps];
}

/** 1-based position for "Шаг 2 из 5". */
export function stepPosition(state: Pick<OnboardingState, "step" | "data">): { current: number; total: number } {
  const steps = visibleSteps(state.data.role);
  return { current: steps.indexOf(state.step) + 1, total: steps.length };
}

/* ------------------------------------------------------------ validation */

export type FieldId =
  | "role"
  | "legalStatus"
  | "name"
  | "phone"
  | "telegram"
  | "agencyMode"
  | "agencyName"
  | "agencyPhone"
  | "inviteCode";

/** Order in which fields appear on screen: the first invalid one gets focus. */
export const fieldOrder: readonly FieldId[] = [
  "role",
  "legalStatus",
  "name",
  "phone",
  "telegram",
  "agencyMode",
  "agencyName",
  "agencyPhone",
  "inviteCode",
];

export type FieldProblem = "required" | "incomplete" | "invalid" | "tooShort";

export type StepErrors = Partial<Record<FieldId, FieldProblem>>;

/** "@binor_agent", "t.me/binor_agent", "https://t.me/binor_agent/" → "binor_agent". */
export function normalizeTelegramUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
}

/** Telegram usernames: 5–32 characters, Latin letters, digits and "_", starting with a letter. */
export function isValidTelegramUsername(username: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username);
}

/** Demo stand-in for an invitation lookup: any code of six or more characters. */
export function isDemoInviteCode(code: string): boolean {
  return code.trim().length >= MIN_INVITE_CODE_LENGTH;
}

function optionalPhoneProblem(raw: string): FieldProblem | undefined {
  const problem = phoneProblem(raw);
  return problem === null || problem === "required" ? undefined : problem;
}

export function validateStep(step: StepId, data: OnboardingData): StepErrors {
  const errors: StepErrors = {};
  switch (step) {
    case "work":
      if (!data.role) errors.role = "required";
      if (!data.legalStatus) errors.legalStatus = "required";
      break;
    case "profile": {
      if (!data.name.trim()) errors.name = "required";
      const phone = phoneProblem(data.phone);
      if (phone) errors.phone = phone;
      const telegram = normalizeTelegramUsername(data.telegram);
      if (telegram && !isValidTelegramUsername(telegram)) errors.telegram = "invalid";
      break;
    }
    case "agency":
      if (!isAgencyRole(data.role)) break;
      if (!data.agencyMode) {
        errors.agencyMode = "required";
      } else if (data.agencyMode === "create") {
        if (!data.agencyName.trim()) errors.agencyName = "required";
        const phone = optionalPhoneProblem(data.agencyPhone);
        if (phone) errors.agencyPhone = phone;
      } else if (!data.inviteCode.trim()) {
        errors.inviteCode = "required";
      } else if (!isDemoInviteCode(data.inviteCode)) {
        errors.inviteCode = "tooShort";
      }
      break;
    case "language":
    case "done":
      break;
  }
  return errors;
}

export function hasErrors(errors: StepErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function firstErrorField(errors: StepErrors): FieldId | undefined {
  return fieldOrder.find((field) => errors[field] !== undefined);
}

/** Errors to display: only on a step where Next was already pressed. */
export function visibleErrors(state: OnboardingState): StepErrors {
  return state.attempted.includes(state.step) ? validateStep(state.step, state.data) : {};
}

/** The first step (before "done") that still has a problem, or null when all are fine. */
export function firstInvalidStep(data: OnboardingData): StepId | null {
  for (const step of visibleSteps(data.role)) {
    if (step === "done") break;
    if (hasErrors(validateStep(step, data))) return step;
  }
  return null;
}

/* --------------------------------------------------------------- reducer */

export type OnboardingAction =
  | { type: "text"; field: TextField; value: string }
  | { type: "role"; role: OnboardingRole }
  | { type: "legalStatus"; status: ProfessionalStatus }
  | { type: "agencyMode"; mode: AgencyMode }
  | { type: "toggleDistrict"; id: DistrictId }
  | { type: "togglePropertyType"; id: PropertyType }
  | { type: "toggleLanguage"; id: Language }
  | { type: "next" }
  | { type: "back" }
  | { type: "goTo"; step: StepId };

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function withData(state: OnboardingState, patch: Partial<OnboardingData>): OnboardingState {
  return { ...state, data: { ...state.data, ...patch } };
}

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case "text": {
      const next = withData(state, { [action.field]: action.value.slice(0, fieldLimits[action.field]) });
      // Once edited, the phone is the person's own entry, not the hand-over.
      return action.field === "phone" ? { ...next, phoneFromLogin: false } : next;
    }
    case "role": {
      const patch: Partial<OnboardingData> = { role: action.role };
      // Smart default (§20.4): owners usually create the agency, agents join one.
      if (!state.data.agencyMode && isAgencyRole(action.role)) {
        patch.agencyMode = action.role === "agency_owner" ? "create" : "join";
      }
      return withData(state, patch);
    }
    case "legalStatus":
      return withData(state, { legalStatus: action.status });
    case "agencyMode":
      return withData(state, { agencyMode: action.mode });
    case "toggleDistrict":
      return withData(state, { districts: toggle(state.data.districts, action.id) });
    case "togglePropertyType":
      return withData(state, { propertyTypes: toggle(state.data.propertyTypes, action.id) });
    case "toggleLanguage":
      return withData(state, { languages: toggle(state.data.languages, action.id) });
    case "next": {
      if (state.step === "done") return state;
      if (hasErrors(validateStep(state.step, state.data))) {
        return state.attempted.includes(state.step) ? state : { ...state, attempted: [...state.attempted, state.step] };
      }
      if (state.reviewing) {
        // Back to the summary unless an edit made another step necessary
        // (e.g. switching to an agency role adds the agency step).
        const pending = firstInvalidStep(state.data);
        return pending ? { ...state, step: pending } : { ...state, step: "done", reviewing: false };
      }
      const steps = visibleSteps(state.data.role);
      return { ...state, step: steps[steps.indexOf(state.step) + 1] ?? "done" };
    }
    case "back": {
      const steps = visibleSteps(state.data.role);
      const index = steps.indexOf(state.step);
      return index > 0 ? { ...state, step: steps[index - 1] } : state;
    }
    case "goTo": {
      const steps = visibleSteps(state.data.role);
      if (!steps.includes(action.step) || action.step === state.step) return state;
      // From the summary any step can be edited; otherwise only earlier steps are reachable.
      if (state.step === "done") return { ...state, step: action.step, reviewing: true };
      return steps.indexOf(action.step) < steps.indexOf(state.step) ? { ...state, step: action.step } : state;
    }
  }
}

/* ------------------------------------------------- hand-over and storage */

/** Fills empty fields from what the sign-in screen already knows (§20.4). */
export function applyLoginHandoff(state: OnboardingState, handoff: LoginHandoff): OnboardingState {
  const data = { ...state.data };
  let phoneFromLogin = state.phoneFromLogin;
  if (handoff.phone && !data.phone.trim()) {
    data.phone = formatUzPhone(handoff.phone);
    phoneFromLogin = true;
  }
  if (handoff.telegram) {
    const { firstName, lastName, username } = handoff.telegram;
    if (!data.name.trim()) data.name = [firstName, lastName].filter(Boolean).join(" ").slice(0, fieldLimits.name);
    if (!data.telegram.trim() && username) data.telegram = `@${username}`.slice(0, fieldLimits.telegram);
  }
  return { ...state, data, phoneFromLogin };
}

export function serializeOnboardingState(state: OnboardingState): string {
  return JSON.stringify({ v: 1, ...state });
}

function oneOf<T extends string>(options: readonly T[], value: unknown): T | undefined {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : undefined;
}

function listOf<T extends string>(options: readonly T[], value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is T => oneOf(options, item) !== undefined))];
}

function textOf(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * Restores a stored wizard defensively: unknown codes are dropped, text is
 * capped, and the step is moved back to the first one that is not complete,
 * so a stale or edited copy can never skip validation.
 */
export function parseOnboardingState(raw: string | null, language: Language): OnboardingState | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.v !== 1 || typeof record.data !== "object" || record.data === null) return null;
  const stored = record.data as Record<string, unknown>;

  const fallback = initialOnboardingState(language);
  const data: OnboardingData = {
    ...fallback.data,
    name: textOf(stored.name, fieldLimits.name),
    phone: textOf(stored.phone, fieldLimits.phone),
    telegram: textOf(stored.telegram, fieldLimits.telegram),
    districts: listOf(districtIds, stored.districts),
    propertyTypes: listOf(propertyTypes, stored.propertyTypes),
    languages: Array.isArray(stored.languages) ? listOf(workLanguages, stored.languages) : fallback.data.languages,
    certificate: textOf(stored.certificate, fieldLimits.certificate),
    agencyName: textOf(stored.agencyName, fieldLimits.agencyName),
    agencyPhone: textOf(stored.agencyPhone, fieldLimits.agencyPhone),
    agencyBranch: textOf(stored.agencyBranch, fieldLimits.agencyBranch),
    inviteCode: textOf(stored.inviteCode, fieldLimits.inviteCode),
  };
  const role = oneOf(onboardingRoles, stored.role);
  if (role) data.role = role;
  const legalStatus = oneOf(legalStatusOptions, stored.legalStatus);
  if (legalStatus) data.legalStatus = legalStatus;
  const agencyMode = oneOf(agencyModes, stored.agencyMode);
  if (agencyMode) data.agencyMode = agencyMode;

  const steps = visibleSteps(data.role);
  const wanted = oneOf(onboardingSteps, record.step);
  let step: StepId = wanted && steps.includes(wanted) ? wanted : "language";
  const pending = firstInvalidStep(data);
  if (pending && steps.indexOf(pending) < steps.indexOf(step)) step = pending;

  return {
    step,
    data,
    attempted: listOf(onboardingSteps, record.attempted),
    reviewing: step !== "done" && record.reviewing === true,
    phoneFromLogin: record.phoneFromLogin === true,
  };
}
