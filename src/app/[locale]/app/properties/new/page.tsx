import type { Metadata } from "next";
import { ExternalLink, Radar } from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { duplicatePool } from "@/components/app/inventory/duplicate-pool";
import { NewPropertyForm } from "@/components/app/inventory/new-property-form";
import { emptyValues, prefillFromTelegram, type PrefillField, type TelegramPrefill } from "@/components/app/inventory/new-property";
import { PageHeader } from "@/components/app/page-header";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import { intlLocale, type Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import properties from "@/i18n/messages/properties";
import { getLocale } from "@/i18n/server";
import { getTelegramListing, listListings, listTelegramListings } from "@/lib/data/repository";
import { districtName } from "@/lib/domain/geo";
import { dealTypes, districtIds, propertyTypes } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: properties[locale].meta.new };
}

const prefillFieldLabel: Record<PrefillField, keyof (typeof properties)["ru"]["new"]["field"]> = {
  dealType: "dealType",
  propertyType: "propertyType",
  district: "district",
  price: "price",
  rooms: "rooms",
  areaTotal: "area",
  floor: "floor",
  floorsTotal: "floorsTotal",
};

function TelegramNotice({ locale, prefill }: { locale: Locale; prefill: TelegramPrefill }) {
  const t = properties[locale].new;
  const uncertain = prefill.uncertain.map((field) => t.field[prefillFieldLabel[field]].toLocaleLowerCase(intlLocale[locale]));
  return (
    <Notice
      kind="info"
      title={t.fromTelegram.title}
      action={
        <div className="flex flex-wrap gap-2">
          <ButtonAnchor href={prefill.sourceUrl} target="_blank" rel="noopener noreferrer" variant="secondary">
            <ExternalLink aria-hidden className="size-4" />
            {t.fromTelegram.original}
          </ButtonAnchor>
          <ButtonLink href={appPath(locale, `/radar/${encodeURIComponent(prefill.postId)}`)} variant="ghost">
            <Radar aria-hidden className="size-4" />
            {t.fromTelegram.radar}
          </ButtonLink>
        </div>
      }
    >
      <p>{t.fromTelegram.text}</p>
      {uncertain.length > 0 ? (
        <p className="pt-1">
          {format(t.fromTelegram.uncertain, {
            list: new Intl.ListFormat(intlLocale[locale], { type: "conjunction" }).format(uncertain),
          })}
        </p>
      ) : null}
    </Notice>
  );
}

/**
 * New property (§20.3, §22.5, Screen 32–33): step one plus a Duplicate Check
 * against everything the viewer can see. `?fromTelegram=<postId>` prefills
 * confident fields from a Telegram Radar post (§35.5) and links the original.
 */
export default async function NewPropertyPage({ searchParams }: PageProps<"/[locale]/app/properties/new">) {
  const locale = await getLocale();
  const t = properties[locale];
  const d = domain[locale];
  const raw = (await searchParams).fromTelegram;
  const fromTelegram = (Array.isArray(raw) ? raw[0] : raw)?.trim();

  const [post, listings, posts] = await Promise.all([
    fromTelegram ? getTelegramListing(fromTelegram) : Promise.resolve(undefined),
    listListings(),
    listTelegramListings(),
  ]);
  const prefill = post ? prefillFromTelegram(post.post) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        title={t.new.title}
        subtitle={t.new.subtitle}
        backHref={appPath(locale, "/properties")}
        className="mb-0"
      >
        <CrmTabs locale={locale} />
      </PageHeader>

      {fromTelegram && !prefill ? <Notice kind="warning">{t.new.fromTelegram.notFound}</Notice> : null}
      {prefill ? <TelegramNotice locale={locale} prefill={prefill} /> : null}

      <NewPropertyForm
        locale={locale}
        labels={t.new}
        restrictedLabel={t.detail.restricted}
        options={{
          propertyTypes: propertyTypes.map((value) => ({ value, label: d.propertyType[value] })),
          dealTypes: dealTypes.map((value) => ({ value, label: d.dealType[value] })),
          districts: [...districtIds]
            .map((value) => ({ value, label: districtName(value, locale) }))
            .sort((a, b) => a.label.localeCompare(b.label, locale)),
          signals: d.duplicateSignal,
          conflicts: d.dedupConflict,
        }}
        initialValues={prefill?.values ?? emptyValues()}
        prefill={prefill ? { postId: prefill.postId, marks: prefill.marks, dedup: prefill.dedup } : undefined}
        pool={duplicatePool(locale, listings, posts)}
        appBase={appPath(locale, "")}
      />
    </div>
  );
}
