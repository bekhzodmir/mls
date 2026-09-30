import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { LOCALE_COOKIE } from "@/i18n/config";
import { negotiate, proxy } from "./proxy";

describe("negotiate (Accept-Language)", () => {
  it("falls back to Russian without a usable header", () => {
    expect(negotiate(null)).toBe("ru");
    expect(negotiate("")).toBe("ru");
    expect(negotiate("*")).toBe("ru");
    expect(negotiate("en-US,en;q=0.9,de;q=0.8")).toBe("ru");
  });

  it("matches primary tags, including uz-Latn and regional variants, case-insensitively", () => {
    expect(negotiate("uz")).toBe("uz");
    expect(negotiate("uz-Latn")).toBe("uz");
    expect(negotiate("uz-Latn-UZ")).toBe("uz");
    expect(negotiate("UZ-latn-uz")).toBe("uz");
    expect(negotiate("ru-RU")).toBe("ru");
  });

  it("honours q-values rather than header order", () => {
    expect(negotiate("ru;q=0.5, uz;q=0.8")).toBe("uz");
    expect(negotiate("en;q=0.9, uz;q=0.8, ru;q=0.7")).toBe("uz");
    expect(negotiate("ru-RU,ru;q=0.9,uz;q=0.8,en;q=0.7")).toBe("ru");
    expect(negotiate("uz-Latn-UZ;q=0.4, ru ; q=0.3")).toBe("uz");
    expect(negotiate("uz; Q=0.9, ru;q=0.95")).toBe("ru");
  });

  it("allows optional whitespace around the ';' parameter separator (RFC 9110 weight = OWS \";\" OWS)", () => {
    expect(negotiate("en, uz ;q=0.5")).toBe("uz");
    expect(negotiate("en,uz\t; q=0.5")).toBe("uz");
  });

  it("keeps header order for equal quality", () => {
    expect(negotiate("uz, ru")).toBe("uz");
    expect(negotiate("ru,uz")).toBe("ru");
  });

  it("drops q=0 and unparsable qualities", () => {
    expect(negotiate("uz;q=0, ru;q=0.1")).toBe("ru");
    expect(negotiate("uz;q=0")).toBe("ru");
    expect(negotiate("uz;q=abc, en")).toBe("ru");
  });

  it("does not mistake other languages for ours", () => {
    expect(negotiate("en-UZ")).toBe("ru");
    expect(negotiate("rus")).toBe("ru");
    expect(negotiate("uzb, en")).toBe("ru");
  });
});

describe("proxy", () => {
  function request(path: string, init: { language?: string; cookie?: string } = {}) {
    const headers = new Headers();
    if (init.language) headers.set("accept-language", init.language);
    if (init.cookie) headers.set("cookie", `${LOCALE_COOKIE}=${init.cookie}`);
    return new NextRequest(new URL(path, "https://binor.test"), { headers });
  }

  it("redirects unprefixed paths to the negotiated locale, keeping path and query", () => {
    const response = proxy(request("/app/clients?tab=active", { language: "uz-Latn-UZ,ru;q=0.5" }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://binor.test/uz/app/clients?tab=active");
  });

  it("maps the root to the locale root", () => {
    expect(proxy(request("/")).headers.get("location")).toBe("https://binor.test/ru");
  });

  it("prefers the remembered cookie over Accept-Language, ignoring invalid values", () => {
    expect(proxy(request("/app", { language: "ru", cookie: "uz" })).headers.get("location")).toBe(
      "https://binor.test/uz/app",
    );
    expect(proxy(request("/app", { language: "uz", cookie: "en" })).headers.get("location")).toBe(
      "https://binor.test/uz/app",
    );
  });

  it("passes through paths that already carry a locale", () => {
    for (const path of ["/ru", "/uz", "/uz/app/deals"]) {
      const response = proxy(request(path));
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("does not treat look-alike segments as a locale prefix", () => {
    expect(proxy(request("/ruble")).headers.get("location")).toBe("https://binor.test/ru/ruble");
  });
});
