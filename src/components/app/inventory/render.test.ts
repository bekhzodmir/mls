import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import { getListing, getTelegramListing, listListings, listTelegramListings } from "@/lib/data/repository";
import { seed } from "@/lib/data/seed";
import properties from "@/i18n/messages/properties";
import domain from "@/i18n/messages/domain";
import { DetailActions } from "./detail-actions";
import {
  ContractSection,
  ListingSection,
  MlsSection,
  OwnerSection,
  PropertyHero,
  PropertySection,
  ReverseMatchesSection,
  VerificationSection,
} from "./detail-sections";
import { DistrictGroups } from "./district-groups";
import { duplicatePool } from "./duplicate-pool";
import { emptyValues, prefillFromTelegram } from "./new-property";
import { NewPropertyForm } from "./new-property-form";
import { PropertyCard } from "./property-card";

/**
 * Server-render smoke tests over the whole demo dataset: every card and
 * section renders in both languages, and restricted data never reaches the
 * markup of a view that may not see it (§16.3, §36.4).
 */

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element).replace(/[  ]/g, " ");

function restrictedStrings(propertyId: string): string[] {
  const property = seed.properties.find((item) => item.id === propertyId);
  if (!property) throw new Error(`missing ${propertyId}`);
  const owner = property.ownerId ? seed.owners.find((item) => item.id === property.ownerId) : undefined;
  return [property.address, property.cadastralNumber, owner?.name, owner?.phone].filter(
    (value): value is string => Boolean(value),
  );
}

describe("PropertyCard and DistrictGroups", () => {
  it("render every visible listing in both languages without restricted data", async () => {
    const views = await listListings();
    for (const locale of ["ru", "uz"] as const) {
      for (const view of views) {
        const markup = html(createElement(PropertyCard, { locale, view }));
        expect(markup).toContain(`/${locale}/app/properties/${view.listing.id}`);
        // Cards never show the full address, whatever the access level.
        for (const secret of restrictedStrings(view.property.id)) expect(markup).not.toContain(secret);
      }
      const grouped = html(createElement(DistrictGroups, { locale, views }));
      expect(grouped).toContain(properties[locale].list.view.mapNote);
    }
  });

  it("marks a price drop and mutes stale listings", async () => {
    const views = await listListings();
    const dropped = views.find((view) => view.listing.id === "lst-01");
    const stale = views.find((view) => view.listing.id === "lst-08");
    if (!dropped || !stale) throw new Error("seed changed");
    expect(html(createElement(PropertyCard, { locale: "ru", view: dropped }))).toContain("Цена снижена");
    expect(html(createElement(PropertyCard, { locale: "ru", view: stale }))).toContain("border-dashed");
  });
});

describe("property profile sections", () => {
  const at = now();

  it("hide owner, address and cadastre from a masked partner and explain how to get access", async () => {
    const detail = await getListing("lst-16");
    if (!detail) throw new Error("lst-16 should be visible");
    expect(detail.access).toBe("partner_masked");
    const markup = [
      html(createElement(PropertyHero, { locale: "ru", view: detail })),
      html(createElement(PropertySection, { locale: "ru", view: detail })),
      html(createElement(ListingSection, { locale: "ru", view: detail, at })),
      html(createElement(OwnerSection, { locale: "ru", detail })),
      html(createElement(ContractSection, { locale: "ru", view: detail, at })),
      html(createElement(MlsSection, { locale: "ru", detail })),
    ].join("\n");
    for (const secret of restrictedStrings(detail.property.id)) expect(markup).not.toContain(secret);
    expect(markup).toContain(properties.ru.detail.owner.maskedTitle);
    expect(markup).toContain("/ru/app/mls/cooperation/new?listingId=lst-16");
    expect(markup).toContain(properties.ru.detail.contract.partnerTitle);
  });

  it("show the owner, restricted markers and the contract warning to the listing agent", async () => {
    const detail = await getListing("lst-01");
    if (!detail?.owner) throw new Error("lst-01 is the viewer's own listing with an owner");
    const owner = html(createElement(OwnerSection, { locale: "ru", detail }));
    expect(owner).toContain(detail.owner.name);
    expect(owner).toContain(properties.ru.detail.restricted);
    const contract = html(createElement(ContractSection, { locale: "ru", view: detail, at }));
    expect(contract).toContain("Договор заканчивается через 10 дней");
    const property = html(createElement(PropertySection, { locale: "uz", view: detail }));
    expect(property).toContain(detail.property.address ?? "missing");
  });

  it("never presents an unavailable registry as verified", async () => {
    const detail = await getListing("lst-03");
    if (!detail) throw new Error("lst-03 missing");
    const markup = html(createElement(VerificationSection, { locale: "ru", items: detail.listing.verifications }));
    expect(markup).toContain(`${domain.ru.verificationSubject.encumbrance}: ${domain.ru.verificationStatus.unavailable}`);
    expect(markup).toContain(properties.ru.detail.verification.unavailableNote);
    const hero = html(createElement(PropertyHero, { locale: "ru", view: detail }));
    const confirmed = detail.listing.verifications.filter((item) => item.status === "confirmed").length;
    expect(hero).toContain(`Подтверждено фактов: ${confirmed} из ${detail.listing.verifications.length}`);
  });

  it("explains reverse matches with reasons and links, and renders the action bar", async () => {
    const detail = await getListing("lst-16");
    if (!detail) throw new Error("lst-16 missing");
    expect(detail.reverseMatches.length).toBeGreaterThan(0);
    const markup = html(
      createElement(ReverseMatchesSection, { locale: "ru", matches: detail.reverseMatches, listingId: "lst-16" }),
    );
    expect(markup).toContain("Подходит по ");
    expect(markup).toContain(`/ru/app/matches/${detail.reverseMatches[0].requirement.id}--lst-16`);
    const bar = html(
      createElement(DetailActions, {
        labels: properties.ru.detail.actions,
        call: { kind: "agent", href: "tel:+998900000000" },
        clients: [{ id: "cl-01", name: "Тест" }],
        masked: true,
        more: [{ href: "/ru/app/properties", label: "Все объекты" }],
      }),
    );
    expect(bar).toContain('aria-label="Позвонить агенту"');
    expect(bar).toContain("bottom-[calc(4rem+env(safe-area-inset-bottom))]");
  });
});

describe("NewPropertyForm", () => {
  it("renders step one with Telegram prefill marks and no prefilled currency guess", async () => {
    const post = await getTelegramListing("tg-01");
    if (!post) throw new Error("tg-01 missing");
    const prefill = prefillFromTelegram(post.post);
    const pool = duplicatePool("ru", await listListings(), await listTelegramListings());
    const props = {
      locale: "ru" as const,
      labels: properties.ru.new,
      restrictedLabel: properties.ru.detail.restricted,
      options: {
        propertyTypes: [{ value: "apartment" as const, label: "Квартира" }],
        dealTypes: [{ value: "sale" as const, label: "Продажа" }],
        districts: [{ value: "chilanzar" as const, label: "Чиланзар" }],
        signals: domain.ru.duplicateSignal,
        conflicts: domain.ru.dedupConflict,
      },
      pool,
      appBase: "/ru/app",
    };
    const withPrefill = html(
      createElement(NewPropertyForm, {
        ...props,
        initialValues: prefill.values,
        prefill: { postId: prefill.postId, marks: prefill.marks, dedup: prefill.dedup },
      }),
    );
    expect(withPrefill).toContain(properties.ru.new.fromTelegram.badge);
    expect(withPrefill).toContain('value="68000"');

    const blank = html(createElement(NewPropertyForm, { ...props, initialValues: emptyValues() }));
    expect(blank).not.toContain(properties.ru.new.fromTelegram.badge);
    expect(blank).not.toMatch(/value="(USD|UZS)" checked/);
  });
});
