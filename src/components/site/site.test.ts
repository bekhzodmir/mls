import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { summarizeMatch } from "@/components/domain/match-explanation";
import { locales } from "@/i18n/config";
import site from "@/i18n/messages/site";
import siteAbout from "@/i18n/messages/site-about";
import siteContacts from "@/i18n/messages/site-contacts";
import siteFaq from "@/i18n/messages/site-faq";
import siteHome from "@/i18n/messages/site-home";
import siteHow from "@/i18n/messages/site-how";
import { matchedCriteria } from "@/lib/domain/matching";
import { publicContacts, siteUrl } from "@/lib/site";
import { faqEntries, faqOrder } from "./faq-content";
import { exampleReasons } from "./illustrations";
import { sitePageMetadata } from "./metadata";
import {
  absoluteUrl,
  isCurrentPage,
  languageAlternates,
  neutralPath,
  sitePages,
  sitePath,
  type SitePage,
} from "./site-config";
import { faqPageJsonLd, organizationJsonLd, serializeJsonLd } from "./structured-data";

const namespaces = [
  ["site", site],
  ["site-home", siteHome],
  ["site-how", siteHow],
  ["site-about", siteAbout],
  ["site-contacts", siteContacts],
  ["site-faq", siteFaq],
] as const;

function leaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).flatMap(leaves);
}

function shape(value: unknown, path = ""): string[] {
  if (typeof value !== "object" || value === null) return [`${path}:${typeof value}`];
  if (Array.isArray(value)) return [`${path}:array(${value.length})`];
  return Object.keys(value)
    .sort()
    .flatMap((key) => shape((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key));
}

describe("site-config", () => {
  it("prefixes every page with its locale", () => {
    expect(sitePath("ru", "home")).toBe("/ru");
    expect(sitePath("uz", "home")).toBe("/uz");
    expect(sitePath("ru", "howItWorks")).toBe("/ru/how-it-works");
    expect(sitePath("uz", "faq")).toBe("/uz/faq");
  });

  it("uses the locale-less path as x-default (the proxy picks the language)", () => {
    expect(neutralPath("home")).toBe("/");
    expect(neutralPath("about")).toBe("/about");
    expect(languageAlternates("contacts")).toEqual({
      ru: "/ru/contacts",
      uz: "/uz/contacts",
      "x-default": "/contacts",
    });
  });

  it("builds absolute URLs on the canonical origin", () => {
    expect(absoluteUrl("/ru/faq")).toBe(new URL("/ru/faq", siteUrl).toString());
    expect(absoluteUrl("/ru/faq").startsWith(siteUrl)).toBe(true);
  });

  it("recognises the current page, tolerating a trailing slash", () => {
    expect(isCurrentPage("/ru", "ru", "home")).toBe(true);
    expect(isCurrentPage("/ru/", "ru", "home")).toBe(true);
    expect(isCurrentPage("/ru/about/", "ru", "about")).toBe(true);
    expect(isCurrentPage("/ru/about", "ru", "home")).toBe(false);
    expect(isCurrentPage("/uz/about", "ru", "about")).toBe(false);
  });
});

describe("page metadata", () => {
  const copy: Record<SitePage, (typeof siteHome)["ru"]["meta"][]> = {
    home: [siteHome.ru.meta, siteHome.uz.meta],
    howItWorks: [siteHow.ru.meta, siteHow.uz.meta],
    about: [siteAbout.ru.meta, siteAbout.uz.meta],
    contacts: [siteContacts.ru.meta, siteContacts.uz.meta],
    faq: [siteFaq.ru.meta, siteFaq.uz.meta],
  };

  it("gives every page a self canonical and ru/uz/x-default alternates", () => {
    for (const page of sitePages) {
      locales.forEach((locale, index) => {
        const metadata = sitePageMetadata(locale, page, copy[page][index]);
        expect(metadata.alternates?.canonical).toBe(sitePath(locale, page));
        expect(metadata.alternates?.languages).toEqual(languageAlternates(page));
        expect(metadata.openGraph).toMatchObject({ url: sitePath(locale, page), siteName: "Binor" });
      });
    }
  });

  it("references the localized share image with a localized alt", () => {
    const metadata = sitePageMetadata("uz", "faq", siteFaq.uz.meta);
    expect(metadata.openGraph?.images).toEqual([
      { url: "/uz/opengraph-image", width: 1200, height: 630, alt: site.uz.meta.ogAlt },
    ]);
  });

  it("keeps the home title absolute and templates the rest", () => {
    expect(sitePageMetadata("ru", "home", siteHome.ru.meta).title).toEqual({ absolute: siteHome.ru.meta.title });
    expect(sitePageMetadata("ru", "about", siteAbout.ru.meta).title).toBe(siteAbout.ru.meta.title);
  });

  it("has unique titles and descriptions per locale", () => {
    for (const [index] of locales.entries()) {
      const titles = sitePages.map((page) => copy[page][index].title);
      const descriptions = sitePages.map((page) => copy[page][index].description);
      expect(new Set(titles).size).toBe(titles.length);
      expect(new Set(descriptions).size).toBe(descriptions.length);
    }
  });
});

describe("sitemap.xml", () => {
  const entries = sitemap();

  it("lists every public page in every locale, and nothing else", () => {
    expect(entries).toHaveLength(sitePages.length * locales.length);
    expect(entries.map((entry) => entry.url)).toEqual(
      expect.arrayContaining([absoluteUrl("/ru"), absoluteUrl("/uz/how-it-works"), absoluteUrl("/ru/faq")]),
    );
    for (const entry of entries) {
      expect(entry.url.startsWith(siteUrl)).toBe(true);
      expect(entry.url).not.toMatch(/\/app(\/|$)/);
    }
  });

  it("pairs each URL with absolute ru, uz and x-default alternates", () => {
    const about = entries.find((entry) => entry.url === absoluteUrl("/uz/about"));
    expect(about?.alternates?.languages).toEqual({
      ru: absoluteUrl("/ru/about"),
      uz: absoluteUrl("/uz/about"),
      "x-default": absoluteUrl("/about"),
    });
  });
});

describe("robots.txt", () => {
  it("allows the site, blocks the workspace and API, points at the sitemap", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toEqual(expect.arrayContaining(["/api/", "/ru/app", "/uz/app"]));
    expect(result.sitemap).toBe(absoluteUrl("/sitemap.xml"));
  });
});

describe("structured data", () => {
  it("describes the organization only with public contacts (no legal entity claims)", () => {
    const json = organizationJsonLd("ru");
    const [organization, website] = json["@graph"] as Record<string, unknown>[];
    expect(organization).toMatchObject({
      "@type": "Organization",
      name: "Binor",
      sameAs: [publicContacts.telegramBotUrl, publicContacts.instagramUrl],
    });
    for (const key of ["legalName", "address", "email", "founder", "aggregateRating", "taxID"]) {
      expect(organization).not.toHaveProperty(key);
    }
    const [phone, bot] = organization.contactPoint as Record<string, unknown>[];
    expect(phone).toMatchObject({
      telephone: publicContacts.phoneE164,
      availableLanguage: ["ru", "uz"],
      hoursAvailable: { opens: "09:00:00+05:00", closes: "20:00:00+05:00" },
    });
    expect(bot).toMatchObject({ url: publicContacts.telegramBotUrl });
    expect(website).toMatchObject({ "@type": "WebSite", url: absoluteUrl("/ru"), inLanguage: "ru" });
  });

  it("builds FAQPage from exactly the answers shown on the page", () => {
    const entries = faqEntries("uz");
    const json = faqPageJsonLd("uz", entries);
    const questions = json.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(questions).toHaveLength(entries.length);
    expect(questions[0]).toEqual({
      "@type": "Question",
      name: entries[0].question,
      acceptedAnswer: { "@type": "Answer", text: entries[0].answer.join("\n\n") },
    });
  });

  it("escapes < so a payload cannot close the script element", () => {
    const text = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});

describe("FAQ", () => {
  it.each(locales)("has 8–10 unique, fully resolved entries in %s", (locale) => {
    const entries = faqEntries(locale);
    expect(entries.length).toBeGreaterThanOrEqual(8);
    expect(entries.length).toBeLessThanOrEqual(10);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(entries.map((entry) => entry.id)).toEqual([...faqOrder]);
    for (const entry of entries) {
      for (const paragraph of entry.answer) expect(paragraph, paragraph).not.toMatch(/\{\w+\}/);
    }
  });

  it("fills contacts and freshness thresholds from their single sources", () => {
    const ru = faqEntries("ru");
    const pricing = ru.find((entry) => entry.id === "pricing")!.answer.join(" ");
    expect(pricing).toContain(`@${publicContacts.telegramBot}`);
    expect(pricing).toContain(publicContacts.phoneDisplay);
    const duplicates = ru.find((entry) => entry.id === "duplicates")!.answer.join(" ");
    expect(duplicates).toContain("до 3 дней — «Свежий»");
    expect(duplicates).toContain("до 14 дней — «Устаревает»");
    const uz = faqEntries("uz").find((entry) => entry.id === "duplicates")!.answer.join(" ");
    expect(uz).toContain("7 kungacha — «Dolzarb»");
  });
});

describe("site messages", () => {
  it.each(namespaces)("keeps %s at full RU/UZ parity", (_name, messages) => {
    expect(shape(messages.uz)).toEqual(shape(messages.ru));
    for (const text of [...leaves(messages.ru), ...leaves(messages.uz)]) expect(text.trim()).not.toBe("");
  });

  it.each(namespaces)("uses Uzbek Latin orthography in %s", (_name, messages) => {
    for (const text of leaves(messages.uz)) {
      expect(text, text).not.toMatch(/['`ʻʼ]/);
      expect(text, text).not.toMatch(/[oOgG]’/);
      // Only the Russian language's self-name may appear in Cyrillic.
      expect(text.replace(/Русский/g, ""), text).not.toMatch(/[А-Яа-яЁё]/);
    }
  });

  it.each(namespaces)("publishes no internal metrics, prices or unverified claims in %s", (_name, messages) => {
    const forbidden = [
      /500\s?\+/, // S4 user count (§41 D4)
      /\b120\b/, // S4 deal count
      /\$\s?1[05]0\b|\$\s?29\b/, // S4 average commission and tariff hypotheses (§41 D3)
      /\b75\s?%/, // S4 retention
      /\b(60|30|10)\s?%/, // S4 market-share estimates (§41 D9)
      /MulkOS/i, // S9 concept name (§41 D8)
      /ASTOR|Biding/i, // unconfirmed ecosystem relationship (§41 D7)
      /\b77\b|100\s?\+|сотн\w* канал|yuzlab kanal/i, // channel counts (§41 D1)
      /бесплатн|bepul|не взима|не берёт|olmaydi/i, // pricing or fee claims not made publicly
    ];
    for (const text of [...leaves(messages.ru), ...leaves(messages.uz)]) {
      for (const pattern of forbidden) expect(text, `${pattern} in: ${text}`).not.toMatch(pattern);
    }
  });

  it("states the Radar volume only as the canonical claim", () => {
    expect(siteHome.ru.radar.lead).toContain("Более 10 000 объявлений из большого пула Telegram-источников");
    expect(siteHome.uz.radar.lead).toContain("10 000 dan ortiq e’lon");
    expect(siteHow.ru.principles.radar.text).toContain("Более 10 000 объявлений из большого пула Telegram-источников");
    expect(siteHow.uz.principles.radar.text).toContain("Katta Telegram manbalari to‘plamidan 10 000 dan ortiq e’lon");
  });

  it("describes the illustrated match with the criteria that actually fit", () => {
    // The summary line comes from the product's summarizeMatch, so it follows the reasons.
    expect(matchedCriteria(exampleReasons("x"))).toEqual(["location", "price", "rooms"]);
    expect(summarizeMatch("ru", exampleReasons("x"))).toBe("Подходит по району, бюджету и комнатам");
    expect(summarizeMatch("uz", exampleReasons("x"))).toBe("Tuman, byudjet va xonalar bo‘yicha mos keladi");
  });

  it("never presents the commission split as a Binor fee", () => {
    expect(siteHome.ru.cobroking.notFee).toMatch(/между риэлторами, а не плата Binor/);
    expect(siteHome.uz.cobroking.notFee).toMatch(/Binor to‘lovi emas/);
  });
});
