import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DEFAULT_INIT_DATA_MAX_AGE_SECONDS, validateInitData } from "./init-data";

// A made-up token in Telegram's format; never a real bot.
const BOT_TOKEN = "123456789:TEST-token_for_unit_tests_only";
const NOW = new Date("2026-09-30T06:00:00.000Z");
const AUTH_DATE = String(Math.floor(NOW.getTime() / 1000) - 60);

const USER_JSON = JSON.stringify({
  id: 279058397,
  first_name: "Dilnoza",
  last_name: "Karimova",
  username: "dilnoza_rieltor",
  language_code: "uz",
  is_premium: true,
  allows_write_to_pm: true,
  photo_url: "https://t.me/i/userpic/320/demo.svg",
});

/**
 * Independent re-implementation of Telegram's signing side, written from the
 * documentation rather than shared with the validator, so a bug in one does
 * not hide a bug in the other.
 */
function sign(fields: Record<string, string>, token = BOT_TOKEN): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const baseFields = {
  auth_date: AUTH_DATE,
  query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
  start_param: "listing-42",
  user: USER_JSON,
};

describe("validateInitData", () => {
  it("accepts correctly signed data and returns the parsed user", () => {
    const result = validateInitData(sign(baseFields), BOT_TOKEN, { now: NOW });
    expect(result).toEqual({
      ok: true,
      data: {
        authDate: new Date(Number(AUTH_DATE) * 1000),
        queryId: "AAHdF6IQAAAAAN0XohDhrOrc",
        startParam: "listing-42",
        user: {
          id: 279058397,
          firstName: "Dilnoza",
          lastName: "Karimova",
          username: "dilnoza_rieltor",
          languageCode: "uz",
          isPremium: true,
          allowsWriteToPm: true,
          photoUrl: "https://t.me/i/userpic/320/demo.svg",
        },
      },
    });
  });

  it("hashes decoded values, so non-ASCII names and URL-unsafe characters work", () => {
    const user = JSON.stringify({ id: 1, first_name: "Ойбек & O‘tkir", last_name: "a+b=c" });
    const result = validateInitData(sign({ auth_date: AUTH_DATE, user }), BOT_TOKEN, { now: NOW });
    expect(result.ok && result.data.user).toEqual({ id: 1, firstName: "Ойбек & O‘tkir", lastName: "a+b=c" });
  });

  it("keeps the Ed25519 `signature` field inside the data-check-string", () => {
    const withSignature = { ...baseFields, signature: "c2lnbmF0dXJlLWJ5LXRlbGVncmFt" };
    expect(validateInitData(sign(withSignature), BOT_TOKEN, { now: NOW }).ok).toBe(true);

    // Signed without `signature`, then `signature` injected: the hash no longer matches.
    const params = new URLSearchParams(sign(baseFields));
    params.set("signature", "c2lnbmF0dXJlLWJ5LXRlbGVncmFt");
    expect(validateInitData(params.toString(), BOT_TOKEN, { now: NOW })).toEqual({ ok: false, reason: "bad_hash" });
  });

  it("does not depend on the order fields arrive in", () => {
    const params = new URLSearchParams(sign(baseFields));
    const reversed = new URLSearchParams([...params].reverse());
    expect(validateInitData(reversed.toString(), BOT_TOKEN, { now: NOW }).ok).toBe(true);
  });

  it("detects tampering with any field", () => {
    const params = new URLSearchParams(sign(baseFields));
    params.set("user", USER_JSON.replace("279058397", "279058398"));
    expect(validateInitData(params.toString(), BOT_TOKEN, { now: NOW })).toEqual({ ok: false, reason: "bad_hash" });

    const added = new URLSearchParams(sign(baseFields));
    added.set("chat_type", "private");
    expect(validateInitData(added.toString(), BOT_TOKEN, { now: NOW })).toEqual({ ok: false, reason: "bad_hash" });
  });

  it("rejects data signed with another bot's token", () => {
    const foreign = sign(baseFields, "987654321:another-bot-token");
    expect(validateInitData(foreign, BOT_TOKEN, { now: NOW })).toEqual({ ok: false, reason: "bad_hash" });
  });

  it("rejects a hash that is not 32 bytes of hex", () => {
    const params = new URLSearchParams(sign(baseFields));
    params.set("hash", "abc");
    expect(validateInitData(params.toString(), BOT_TOKEN, { now: NOW })).toEqual({ ok: false, reason: "bad_hash" });
    params.set("hash", "z".repeat(64));
    expect(validateInitData(params.toString(), BOT_TOKEN, { now: NOW })).toEqual({ ok: false, reason: "bad_hash" });
  });

  it("reports a missing hash", () => {
    const unsigned = new URLSearchParams(baseFields).toString();
    expect(validateInitData(unsigned, BOT_TOKEN, { now: NOW })).toEqual({ ok: false, reason: "missing_hash" });
    const empty = new URLSearchParams({ ...baseFields, hash: "" }).toString();
    expect(validateInitData(empty, BOT_TOKEN, { now: NOW })).toEqual({ ok: false, reason: "missing_hash" });
  });

  it("rejects data older than the allowed age", () => {
    const old = String(Math.floor(NOW.getTime() / 1000) - DEFAULT_INIT_DATA_MAX_AGE_SECONDS - 1);
    const initData = sign({ ...baseFields, auth_date: old });
    expect(validateInitData(initData, BOT_TOKEN, { now: NOW })).toEqual({ ok: false, reason: "expired" });
    expect(validateInitData(initData, BOT_TOKEN, { now: NOW, maxAgeSeconds: 86_400 }).ok).toBe(true);
  });

  it("accepts the exact age limit and small clock skew, rejects far-future dates", () => {
    const at = (offset: number) => String(Math.floor(NOW.getTime() / 1000) + offset);
    const check = (offset: number) =>
      validateInitData(sign({ ...baseFields, auth_date: at(offset) }), BOT_TOKEN, { now: NOW, maxAgeSeconds: 600 });
    expect(check(-600).ok).toBe(true);
    expect(check(-601)).toEqual({ ok: false, reason: "expired" });
    expect(check(120).ok).toBe(true);
    expect(check(3_600)).toEqual({ ok: false, reason: "expired" });
  });

  it("treats signed but unusable content as malformed", () => {
    expect(validateInitData(sign({ query_id: "x" }), BOT_TOKEN, { now: NOW })).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(validateInitData(sign({ ...baseFields, auth_date: "yesterday" }), BOT_TOKEN, { now: NOW })).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(validateInitData(sign({ ...baseFields, user: "{not json" }), BOT_TOKEN, { now: NOW })).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(
      validateInitData(sign({ ...baseFields, user: JSON.stringify({ id: "1", first_name: "A" }) }), BOT_TOKEN, {
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects empty input and duplicate keys", () => {
    expect(validateInitData("", BOT_TOKEN, { now: NOW })).toEqual({ ok: false, reason: "malformed" });
    const duplicated = `${sign(baseFields)}&auth_date=${AUTH_DATE}`;
    expect(validateInitData(duplicated, BOT_TOKEN, { now: NOW })).toEqual({ ok: false, reason: "malformed" });
  });

  it("allows launches without a user (e.g. keyboard buttons)", () => {
    const result = validateInitData(sign({ auth_date: AUTH_DATE }), BOT_TOKEN, { now: NOW });
    expect(result).toEqual({ ok: true, data: { authDate: new Date(Number(AUTH_DATE) * 1000) } });
  });
});
