import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-side validation of Telegram Mini App launch data (§39.3: "Validate
 * подписи Telegram на сервере").
 *
 * Implements the algorithm documented at
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * (checked 2026-09-30):
 *
 *   secret_key        = HMAC_SHA256(key = "WebAppData", message = <bot_token>)
 *   data_check_string = every received field except `hash`, sorted by key,
 *                       as "key=<value>" joined with "\n"
 *   valid             = hex(HMAC_SHA256(key = secret_key, message = data_check_string)) == hash
 *
 * Values are the URL-decoded strings as received (the `user` JSON is hashed
 * verbatim). The newer `signature` field (Ed25519, for third parties without
 * the bot token) is "a signature of all passed parameters (except hash)", so
 * for bot-token validation it is an ordinary field and stays IN the
 * data-check-string; only the third-party scheme excludes it.
 *
 * `auth_date` must also be checked to reject replayed data. Never log the raw
 * initData or the bot token.
 */

/** The Mini App user, camel-cased. Only fields Telegram documents are kept. */
export interface TelegramUser {
  /** Up to 52 significant bits — safe as a JS number. */
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  /** IETF language tag of the user's Telegram client, e.g. "ru", "uz". */
  languageCode?: string;
  isPremium?: boolean;
  isBot?: boolean;
  allowsWriteToPm?: boolean;
  photoUrl?: string;
}

export interface InitData {
  user?: TelegramUser;
  authDate: Date;
  queryId?: string;
  startParam?: string;
}

export type InitDataFailure = "missing_hash" | "bad_hash" | "expired" | "malformed";

export type InitDataResult = { ok: true; data: InitData } | { ok: false; reason: InitDataFailure };

export interface ValidateOptions {
  /**
   * Maximum age of `auth_date`. Telegram prescribes no value; one hour keeps
   * a leaked initData short-lived while covering a normal session start.
   */
  maxAgeSeconds?: number;
  now?: Date;
}

export const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 3_600;

/** Tolerated clock difference for an `auth_date` slightly in the future. */
const CLOCK_SKEW_SECONDS = 300;

const HEX_SHA256 = /^[0-9a-f]{64}$/i;

/**
 * Checks integrity first, then freshness, then parses the payload. Returns a
 * reason instead of throwing so the route can map it to a status code.
 */
export function validateInitData(
  initData: string,
  botToken: string,
  options: ValidateOptions = {},
): InitDataResult {
  if (typeof initData !== "string" || initData.trim() === "" || !botToken) {
    return { ok: false, reason: "malformed" };
  }

  const fields = new Map<string, string>();
  for (const [key, value] of new URLSearchParams(initData)) {
    // Duplicate keys make the signed content ambiguous; Telegram never sends them.
    if (key === "" || fields.has(key)) return { ok: false, reason: "malformed" };
    fields.set(key, value);
  }

  const hash = fields.get("hash");
  if (!hash) return { ok: false, reason: "missing_hash" };
  if (!HEX_SHA256.test(hash)) return { ok: false, reason: "bad_hash" };

  const dataCheckString = [...fields]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const received = Buffer.from(hash, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: "bad_hash" };
  }

  // ---- Signed content from here on ------------------------------------
  const authDateRaw = fields.get("auth_date");
  if (!authDateRaw || !/^\d{1,12}$/.test(authDateRaw)) return { ok: false, reason: "malformed" };
  const authSeconds = Number(authDateRaw);
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const maxAge = options.maxAgeSeconds ?? DEFAULT_INIT_DATA_MAX_AGE_SECONDS;
  // Too old, or implausibly far in the future: either way reopen the Mini App.
  if (nowSeconds - authSeconds > maxAge || authSeconds - nowSeconds > CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: "expired" };
  }

  let user: TelegramUser | undefined;
  const userRaw = fields.get("user");
  if (userRaw !== undefined) {
    user = parseUser(userRaw);
    if (!user) return { ok: false, reason: "malformed" };
  }

  const data: InitData = { authDate: new Date(authSeconds * 1000) };
  if (user) data.user = user;
  const queryId = fields.get("query_id");
  if (queryId) data.queryId = queryId;
  const startParam = fields.get("start_param");
  if (startParam) data.startParam = startParam;
  return { ok: true, data };
}

function parseUser(raw: string): TelegramUser | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (!Number.isSafeInteger(record.id) || typeof record.first_name !== "string") return undefined;

  const user: TelegramUser = { id: record.id as number, firstName: record.first_name };
  const text = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : undefined);
  const flag = (key: string) => (typeof record[key] === "boolean" ? (record[key] as boolean) : undefined);
  const optional: Partial<TelegramUser> = {
    lastName: text("last_name"),
    username: text("username"),
    languageCode: text("language_code"),
    isPremium: flag("is_premium"),
    isBot: flag("is_bot"),
    allowsWriteToPm: flag("allows_write_to_pm"),
    photoUrl: text("photo_url"),
  };
  for (const [key, entry] of Object.entries(optional)) {
    if (entry !== undefined) Object.assign(user, { [key]: entry });
  }
  return user;
}
