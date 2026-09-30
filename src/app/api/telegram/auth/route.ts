import { defaultLocale, hasLocale, type Locale } from "@/i18n/config";
import messages from "@/i18n/messages/telegram-auth";
import { validateInitData, type TelegramUser } from "@/lib/telegram/init-data";

/**
 * POST /api/telegram/auth — verifies Telegram Mini App launch data on the
 * server (§39.3 "Validate подписи Telegram на сервере").
 *
 * Request:  JSON `{ initData: string, locale?: "ru" | "uz" }` where `initData`
 *           is `Telegram.WebApp.initData` exactly as received.
 * Responses (always JSON, never cached):
 * - 200 `{ user, locale }` — minimal profile of the verified Telegram user;
 * - 400 `bad_request`, 413 `payload_too_large`, 415 `unsupported_media_type`;
 * - 401 `{ error: "missing_hash" | "bad_hash" | "expired" | "malformed" }`;
 * - 422 `telegram_user_missing` — valid data without a user to sign in;
 * - 503 `telegram_auth_not_configured` — `TELEGRAM_BOT_TOKEN` is not set.
 * Every error carries a human-readable `message` in the request locale
 * (§23.3), so the client never has to show a bare status code.
 *
 * Neither the initData nor the token is ever logged or echoed back.
 *
 * Next step (not implemented yet): exchange the verified user for a Binor
 * session — look up or invite the Agent by Telegram ID, issue a short-lived
 * httpOnly session cookie with rotation and revocation, record the device /
 * session audit event (§39.3) and add rate limiting (§39.6). Until then this
 * endpoint only proves who the Telegram user is; it grants no access.
 */

// node:crypto is used for the HMAC check.
export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;


type ErrorCode = keyof (typeof messages)["ru"];

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function failure(status: number, error: ErrorCode, locale: Locale): Response {
  return json(status, { error, message: messages[locale][error] });
}

/** Only what the client needs to greet the user; no photo, no flags. */
function publicUser(user: TelegramUser) {
  return {
    id: user.id,
    firstName: user.firstName,
    ...(user.lastName ? { lastName: user.lastName } : {}),
    ...(user.username ? { username: user.username } : {}),
    ...(user.languageCode ? { languageCode: user.languageCode } : {}),
  };
}

/** Explicit choice first, then the Telegram client language, then Russian. */
function pickLocale(requested: unknown, languageCode?: string): Locale {
  if (typeof requested === "string" && hasLocale(requested)) return requested;
  const primary = languageCode?.toLowerCase().split("-")[0];
  return hasLocale(primary) ? primary : defaultLocale;
}

export async function POST(request: Request): Promise<Response> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return failure(413, "payload_too_large", defaultLocale);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return failure(415, "unsupported_media_type", defaultLocale);
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return failure(413, "payload_too_large", defaultLocale);
    body = JSON.parse(text);
  } catch {
    return failure(400, "bad_request", defaultLocale);
  }
  const fields = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const requestedLocale = pickLocale(fields.locale);

  // Read per request, never at module load, so builds do not need the secret.
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return failure(503, "telegram_auth_not_configured", requestedLocale);

  if (typeof fields.initData !== "string" || fields.initData === "") {
    return failure(400, "bad_request", requestedLocale);
  }

  const result = validateInitData(fields.initData, botToken);
  if (!result.ok) return failure(401, result.reason, requestedLocale);

  const { user } = result.data;
  if (!user) return failure(422, "telegram_user_missing", requestedLocale);

  return json(200, { user: publicUser(user), locale: pickLocale(fields.locale, user.languageCode) });
}
