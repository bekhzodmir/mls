import type { Metadata } from "next";
import { JsonLd } from "@/components/site/json-ld";
import { siteTitleTemplate } from "@/components/site/metadata";
import { SiteChrome } from "@/components/site/site-chrome";
import { organizationJsonLd } from "@/components/site/structured-data";
import site from "@/i18n/messages/site";
import { getLocale } from "@/i18n/server";
import { publicContacts } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: { template: siteTitleTemplate, default: publicContacts.brand },
    description: site[locale].meta.defaultDescription,
  };
}

/**
 * Public marketing site in RU/UZ (§6.3, §9.5, §42): shared header and footer
 * plus Organization/WebSite structured data built only from public contacts.
 */
export default async function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();

  return (
    <SiteChrome locale={locale}>
      {children}
      <JsonLd data={organizationJsonLd(locale)} />
    </SiteChrome>
  );
}
