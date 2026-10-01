/**
 * Client side of the Telegram Mini App sign-in (screen 4, §6.2, §39.3).
 *
 * The page loads https://telegram.org/js/telegram-web-app.js; inside Telegram
 * it exposes the signed launch data as `window.Telegram.WebApp.initData`.
 * The string is sent as-is to `POST /api/telegram/auth`, which checks the
 * signature with the bot token — the client never trusts or parses it.
 * Outside Telegram (or when the script is blocked) there is no initData.
 */

export const TELEGRAM_WEB_APP_SCRIPT = "https://telegram.org/js/telegram-web-app.js";

export const TELEGRAM_AUTH_ENDPOINT = "/api/telegram/auth";

interface TelegramWebAppLike {
  initData?: unknown;
  ready?: unknown;
}

function webApp(scope: unknown): TelegramWebAppLike | undefined {
  if (typeof scope !== "object" || scope === null) return undefined;
  const telegram = (scope as { Telegram?: unknown }).Telegram;
  if (typeof telegram !== "object" || telegram === null) return undefined;
  const app = (telegram as { WebApp?: unknown }).WebApp;
  return typeof app === "object" && app !== null ? (app as TelegramWebAppLike) : undefined;
}

/**
 * The raw launch data when the page runs inside Telegram, otherwise null.
 * Pass `window`; any other shape (no script, a browser tab) yields null.
 */
export function readTelegramInitData(scope: unknown): string | null {
  const initData = webApp(scope)?.initData;
  return typeof initData === "string" && initData.trim() !== "" ? initData : null;
}

/** Tells Telegram the Mini App is ready to be shown (hides its loader). Safe outside Telegram. */
export function signalTelegramReady(scope: unknown): void {
  const ready = webApp(scope)?.ready;
  if (typeof ready === "function") {
    try {
      ready.call(webApp(scope));
    } catch {
      // A broken host API must not break the sign-in screen.
    }
  }
}

export interface TelegramGreeting {
  firstName: string;
  lastName?: string;
  username?: string;
}

/**
 * What the screen should show for an auth response:
 * - `success` — the server verified the signature (no session yet, see the route);
 * - `not_configured` — 503 with `telegram_auth_not_configured` (no bot token);
 * - `invalid` — 401: bad or missing signature, expired or malformed data;
 * - `rejected` — the request itself was refused (400/413/415/422);
 * - `unavailable` — anything else from the server (5xx, proxies); retrying may help.
 * `message` is the server's localized text (§23.3) when it sent one.
 */
export type TelegramAuthOutcome =
  | { kind: "success"; user: TelegramGreeting }
  | { kind: "not_configured" | "invalid" | "rejected" | "unavailable"; message?: string };

const MAX_MESSAGE_LENGTH = 400;

function text(value: unknown, max = MAX_MESSAGE_LENGTH): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export function interpretTelegramAuthResponse(status: number, body: unknown): TelegramAuthOutcome {
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const message = text(record.message);
  const withMessage = <K extends string>(kind: K) => (message ? { kind, message } : { kind });

  if (status === 200) {
    const user = typeof record.user === "object" && record.user !== null ? (record.user as Record<string, unknown>) : {};
    // The route answers with the camel-cased public user (see `publicUser`).
    const firstName = text(user.firstName, 64);
    if (!firstName) return withMessage("rejected");
    const greeting: TelegramGreeting = { firstName };
    const lastName = text(user.lastName, 64);
    const username = text(user.username, 32);
    if (lastName) greeting.lastName = lastName;
    if (username) greeting.username = username;
    return { kind: "success", user: greeting };
  }
  // A 503 without our code comes from a gateway, not from a missing token.
  if (status === 503 && record.error === "telegram_auth_not_configured") return withMessage("not_configured");
  if (status === 401) return withMessage("invalid");
  if (status === 400 || status === 413 || status === 415 || status === 422) return withMessage("rejected");
  return withMessage("unavailable");
}
