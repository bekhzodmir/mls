import { normalizeUzPhone } from "@/lib/domain/phone";

/**
 * Tab-scoped storage for the demo sign-in and onboarding. Nothing here goes
 * to a server: sessionStorage lives only in this browser tab and is cleared
 * when it closes. Every access is wrapped — storage throws in some private
 * modes and embedded webviews, and the screens must keep working without it.
 */

export const ONBOARDING_STORAGE_KEY = "binor.onboarding.v1";
export const LOGIN_HANDOFF_STORAGE_KEY = "binor.login-handoff.v1";

/** The minimal storage surface, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function sessionStore(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStored(key: string, store: KeyValueStore | null = sessionStore()): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Returns false when the value could not be kept (quota, disabled storage). */
export function writeStored(key: string, value: string, store: KeyValueStore | null = sessionStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string, store: KeyValueStore | null = sessionStore()): void {
  try {
    store?.removeItem(key);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

/** True when a value can actually be kept (probes with a throw-away key). */
export function isStoreWritable(store: KeyValueStore | null = sessionStore()): boolean {
  const probe = "binor.storage-probe";
  if (!writeStored(probe, "1", store)) return false;
  removeStored(probe, store);
  return true;
}

/**
 * What the sign-in screen hands to onboarding so known details are not typed
 * twice (§20.4): the phone from the OTP step, or the name and username of a
 * Telegram account the server has verified. Only fills empty fields there.
 */
export interface LoginHandoff {
  /** E.164, e.g. "+998901234567". */
  phone?: string;
  telegram?: { firstName: string; lastName?: string; username?: string };
}

const MAX_NAME = 64;

function shortText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** Parses stored hand-off data defensively; anything unexpected is dropped. */
export function parseLoginHandoff(raw: string | null): LoginHandoff {
  if (!raw) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  const handoff: LoginHandoff = {};

  const phone = typeof record.phone === "string" ? normalizeUzPhone(record.phone) : null;
  if (phone) handoff.phone = phone;

  if (typeof record.telegram === "object" && record.telegram !== null) {
    const telegram = record.telegram as Record<string, unknown>;
    const firstName = shortText(telegram.firstName, MAX_NAME);
    if (firstName) {
      handoff.telegram = { firstName };
      const lastName = shortText(telegram.lastName, MAX_NAME);
      const username = shortText(telegram.username, 32);
      if (lastName) handoff.telegram.lastName = lastName;
      if (username) handoff.telegram.username = username;
    }
  }
  return handoff;
}

/** Merges into what an earlier sign-in step already handed over. */
export function saveLoginHandoff(patch: LoginHandoff, store: KeyValueStore | null = sessionStore()): boolean {
  const current = parseLoginHandoff(readStored(LOGIN_HANDOFF_STORAGE_KEY, store));
  return writeStored(LOGIN_HANDOFF_STORAGE_KEY, JSON.stringify({ ...current, ...patch }), store);
}

export function loadLoginHandoff(store: KeyValueStore | null = sessionStore()): LoginHandoff {
  return parseLoginHandoff(readStored(LOGIN_HANDOFF_STORAGE_KEY, store));
}
