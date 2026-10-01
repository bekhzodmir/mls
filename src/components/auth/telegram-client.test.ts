import { describe, expect, it, vi } from "vitest";
import { interpretTelegramAuthResponse, readTelegramInitData, signalTelegramReady } from "./telegram-client";

describe("readTelegramInitData", () => {
  it("returns the launch data inside Telegram", () => {
    const scope = { Telegram: { WebApp: { initData: "query_id=1&user=%7B%7D&auth_date=1&hash=ab" } } };
    expect(readTelegramInitData(scope)).toBe("query_id=1&user=%7B%7D&auth_date=1&hash=ab");
  });

  it("returns null in a browser tab, where the script leaves initData empty", () => {
    expect(readTelegramInitData({ Telegram: { WebApp: { initData: "" } } })).toBeNull();
    expect(readTelegramInitData({ Telegram: { WebApp: { initData: "   " } } })).toBeNull();
  });

  it("returns null when the script is missing or the shape is unexpected", () => {
    expect(readTelegramInitData({})).toBeNull();
    expect(readTelegramInitData(undefined)).toBeNull();
    expect(readTelegramInitData({ Telegram: null })).toBeNull();
    expect(readTelegramInitData({ Telegram: { WebApp: { initData: 42 } } })).toBeNull();
  });
});

describe("signalTelegramReady", () => {
  it("calls WebApp.ready when present and ignores its absence or failure", () => {
    const ready = vi.fn();
    signalTelegramReady({ Telegram: { WebApp: { ready } } });
    expect(ready).toHaveBeenCalledOnce();
    expect(() => signalTelegramReady({})).not.toThrow();
    expect(() =>
      signalTelegramReady({
        Telegram: {
          WebApp: {
            ready: () => {
              throw new Error("host");
            },
          },
        },
      }),
    ).not.toThrow();
  });
});

describe("interpretTelegramAuthResponse", () => {
  it("greets a verified user by first name", () => {
    expect(
      interpretTelegramAuthResponse(200, {
        user: { id: 1, firstName: "Dilnoza", lastName: "Karimova", username: "dilnoza_rieltor" },
        locale: "uz",
      }),
    ).toEqual({
      kind: "success",
      user: { firstName: "Dilnoza", lastName: "Karimova", username: "dilnoza_rieltor" },
    });
  });

  it("does not invent a greeting when the user is missing", () => {
    expect(interpretTelegramAuthResponse(200, { locale: "ru" }).kind).toBe("rejected");
  });

  it("passes the server's localized message through for each failure", () => {
    expect(
      interpretTelegramAuthResponse(503, { error: "telegram_auth_not_configured", message: "Вход не настроен" }),
    ).toEqual({ kind: "not_configured", message: "Вход не настроен" });
    expect(interpretTelegramAuthResponse(401, { error: "expired", message: "Данные устарели" })).toEqual({
      kind: "invalid",
      message: "Данные устарели",
    });
    for (const status of [400, 413, 415, 422]) {
      expect(interpretTelegramAuthResponse(status, { error: "x", message: "m" })).toEqual({
        kind: "rejected",
        message: "m",
      });
    }
  });

  it("treats a gateway 503 or any other failure as temporarily unavailable", () => {
    expect(interpretTelegramAuthResponse(503, null)).toEqual({ kind: "unavailable" });
    expect(interpretTelegramAuthResponse(500, "<html>")).toEqual({ kind: "unavailable" });
    expect(interpretTelegramAuthResponse(502, { message: "   " })).toEqual({ kind: "unavailable" });
  });
});
