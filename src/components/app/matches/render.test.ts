import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getMatch, getRequirement, listMatchFeed } from "@/lib/data/repository";
import { seed } from "@/lib/data/seed";
import matchesScreen from "@/i18n/messages/matches-screen";
import requirementDetail from "@/i18n/messages/requirement-detail";
import { isSetAside, isStale } from "./feed";
import { MatchCard, termsLine } from "./match-card";
import { textLang } from "@/components/app/inventory/labels";
import { OriginalPhrase, RequirementCriteriaList } from "./requirement-view";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element).replace(/[  ]/g, " ");

async function match(id: string) {
  const view = await getMatch(id);
  if (!view) throw new Error(`missing ${id}`);
  return view;
}

describe("MatchCard", () => {
  it("renders every feed match in both languages, explained by reasons", async () => {
    const feed = await listMatchFeed();
    for (const locale of ["ru", "uz"] as const) {
      for (const view of feed) {
        const markup = html(createElement(MatchCard, { locale, match: view }));
        expect(markup).toContain(matchesScreen[locale].card.why);
        expect(markup).toContain(`/${locale}/app/matches/${view.id}`);
        // A bare score is only ever a tooltip on the band badge, never visible text (§12.4).
        let visible = markup.replace(/title="[^"]*"/g, "");
        const terms = view.target.kind === "listing" ? view.target.view.listing.cooperation : undefined;
        if (terms) visible = visible.replace(termsLine(locale, terms), "");
        expect(visible).not.toContain(`${view.ranked.score}%`);
        const muted = markup.includes("border-dashed");
        expect(muted).toBe(isStale(view.ranked.freshness) || isSetAside(view.status));
      }
    }
  });

  it("separates Telegram posts from internal listings and links the original post", async () => {
    const post = await match("req-03--tg-02");
    const markup = html(createElement(MatchCard, { locale: "ru", match: post }));
    expect(markup).toContain("Telegram");
    expect(markup).toContain('href="https://t.me/');
    expect(markup).toContain(matchesScreen.ru.card.telegramHint);
    expect(markup).toContain("/ru/app/radar/tg-02");
    expect(markup).not.toContain("/mls/cooperation/new");
  });

  it("shows the partner, the split with both roles, and the cooperation request link", async () => {
    const partner = await match("req-03--lst-16");
    if (partner.target.kind !== "listing") throw new Error("expected a listing");
    const listingView = partner.target.view;
    const terms = listingView.listing.cooperation;
    if (!terms) throw new Error("lst-16 has terms");
    const markup = html(createElement(MatchCard, { locale: "ru", match: partner }));
    expect(markup).toContain(termsLine("ru", terms));
    expect(termsLine("ru", terms)).toMatch(/стороне объекта.*стороне покупателя/);
    expect(markup).toContain("/ru/app/mls/cooperation/new?listingId=lst-16&amp;requirementId=req-03");
    expect(markup).toContain(matchesScreen.ru.card.masked);
    // Masked partner listing: no address or owner in the card.
    const property = seed.properties.find((item) => item.id === listingView.property.id);
    expect(markup).not.toContain(property?.address ?? "missing");
  });

  it("keeps a seeded rejection visible with its reason and without a second reject", async () => {
    const rejected = await match("req-03--lst-12");
    const markup = html(createElement(MatchCard, { locale: "uz", match: rejected }));
    expect(markup).toContain("Rad etildi · sababi: Narx");
    expect(markup).not.toContain(`>${matchesScreen.uz.actions.reject}<`);
  });
});

describe("requirement view", () => {
  it("marks hard and soft criteria and quotes the original phrase in its language", async () => {
    const view = await getRequirement("req-04");
    if (!view) throw new Error("req-04 missing");
    const criteria = html(createElement(RequirementCriteriaList, { locale: "ru", requirement: view.requirement }));
    expect(criteria).toContain(requirementDetail.ru.criteria.hard);
    expect(criteria).toContain(requirementDetail.ru.criteria.soft);
    const phrase = html(createElement(OriginalPhrase, { locale: "ru", requirement: view.requirement }));
    expect(phrase).toContain('lang="uz-Latn"');
    expect(phrase).toContain(view.requirement.naturalLanguageInput ?? "missing");
    expect(textLang("2-3 комнаты на Чиланзаре")).toBe("ru");
  });
});
