import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import errors from "@/i18n/messages/errors";
import type { Locale } from "@/i18n/config";

/**
 * Every error boundary answers in the page language with a retry and a way
 * home — never the framework's English default screen (§23.3).
 */

let currentLocale: Locale = "ru";
vi.mock("next/navigation", () => ({ useParams: () => ({ locale: currentLocale }) }));

const boundaries = {
  workspace: () => import("@/app/[locale]/app/error"),
  site: () => import("@/app/[locale]/(site)/error"),
  locale: () => import("@/app/[locale]/error"),
};

const props = { error: new Error("boom"), retry: () => undefined };

describe.each(["ru", "uz"] as const)("error boundaries (%s)", (locale) => {
  beforeEach(() => {
    currentLocale = locale;
  });

  it.each(Object.entries(boundaries))("%s boundary is localized with a retry and a link home", async (name, load) => {
    const { default: Boundary } = await load();
    const html = renderToStaticMarkup(createElement(Boundary, props));
    const t = errors[locale].boundary;
    expect(html).toContain(t.title);
    expect(html).toContain(t.retry);
    expect(html).toContain(name === "workspace" ? `href="/${locale}/app"` : `href="/${locale}"`);
    expect(html).not.toContain("boom");
  });
});

describe("global error", () => {
  it("shows both languages without the error message", async () => {
    const { default: GlobalError } = await import("@/app/global-error");
    const html = renderToStaticMarkup(createElement(GlobalError, props));
    expect(html).toContain(errors.ru.boundary.title);
    expect(html).toContain(errors.uz.boundary.title);
    expect(html).toContain('lang="uz-Latn"');
    expect(html).not.toContain("boom");
  });
});
