import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { TelegramButton } from "@/components/site/cta";
import {
  AudienceSection,
  CobrokingSection,
  HomeHero,
  MatchingSection,
  RadarSection,
  TrustSection,
} from "@/components/site/home-sections";
import { sitePageMetadata } from "@/components/site/metadata";
import { CtaBand } from "@/components/site/primitives";
import { sitePath } from "@/components/site/site-config";
import { ButtonLink } from "@/components/ui/button";
import { format } from "@/i18n/define-messages";
import siteHome from "@/i18n/messages/site-home";
import { getLocale } from "@/i18n/server";
import { publicContacts } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return sitePageMetadata(locale, "home", siteHome[locale].meta);
}

export default async function HomePage() {
  const locale = await getLocale();
  const t = siteHome[locale].finalCta;

  return (
    <>
      <HomeHero locale={locale} />
      <MatchingSection locale={locale} />
      <RadarSection locale={locale} />
      <CobrokingSection locale={locale} />
      <TrustSection locale={locale} />
      <AudienceSection locale={locale} />
      <CtaBand id="start-title" title={t.title} text={format(t.text, { bot: publicContacts.telegramBot })}>
        <TelegramButton locale={locale} />
        <ButtonLink href={sitePath(locale, "howItWorks")} variant="secondary" size="lg">
          {t.howLink}
          <ArrowRight aria-hidden className="size-4.5" />
        </ButtonLink>
      </CtaBand>
    </>
  );
}
