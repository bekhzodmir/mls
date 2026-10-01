import { LogIn } from "lucide-react";
import Link from "next/link";
import { loginPath } from "@/components/auth/auth-routes";
import { LocaleSwitch } from "@/components/locale-switch";
import { BinorMark } from "@/components/ui/brand-mark";
import { ButtonLink } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import site from "@/i18n/messages/site";
import { DemoButton, DemoNote, TelegramButton, TelegramIconButton } from "./cta";
import { MobileMenu } from "./mobile-menu";
import { Container } from "./primitives";
import { sitePath, type SitePage } from "./site-config";
import { SiteNavLinks } from "./site-nav";

export function navLabels(locale: Locale): Record<SitePage, string> {
  const nav = site[locale].nav;
  return {
    home: nav.home,
    howItWorks: nav.howItWorks,
    about: nav.about,
    contacts: nav.contacts,
    faq: nav.faq,
  };
}

/**
 * Sticky site header. Desktop (≥1024px): inline navigation, language switch,
 * "Войти" and the Telegram CTA. Phones: logo, "Войти", an icon-only Telegram
 * button and a disclosure menu with the same destinations. Every control is ≥44px.
 */
export function SiteHeader({ locale }: { locale: Locale }) {
  const t = site[locale];
  const labels = navLabels(locale);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <Container className="flex h-16 items-center gap-2">
        <Link
          href={sitePath(locale, "home")}
          aria-label={t.header.home}
          className="mr-auto flex h-11 items-center rounded-md"
        >
          <BinorMark />
        </Link>

        <nav aria-label={t.nav.label} className="hidden lg:block">
          <SiteNavLinks locale={locale} labels={labels} orientation="horizontal" />
        </nav>

        <LocaleSwitch locale={locale} label={t.header.language} className="hidden sm:flex" />
        {/* Sign-in (§21.4 screen 2). Icon only at 1024–1279px, where the inline nav needs the space. */}
        <ButtonLink
          href={loginPath(locale)}
          variant="ghost"
          title={t.header.login}
          className="lg:w-11 lg:px-0 xl:w-auto xl:px-4"
        >
          <LogIn aria-hidden className="hidden size-4.5 sm:block" />
          <span className="lg:sr-only xl:not-sr-only">{t.header.login}</span>
        </ButtonLink>
        {/* Full label where there is room; at 1024–1279px the inline nav needs the space. */}
        <TelegramButton locale={locale} size="md" className="hidden sm:inline-flex lg:hidden xl:inline-flex" />
        <TelegramButton locale={locale} size="md" compact className="hidden lg:inline-flex xl:hidden" />
        <TelegramIconButton locale={locale} className="sm:hidden" />

        <MobileMenu label={t.header.menu} className="lg:hidden">
          <Container className="space-y-4 py-4">
            <nav aria-label={t.nav.label}>
              <SiteNavLinks locale={locale} labels={labels} orientation="vertical" />
            </nav>
            <div className="sm:hidden">
              <LocaleSwitch locale={locale} label={t.header.language} className="w-fit" />
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <TelegramButton locale={locale} className="w-full" />
              <DemoButton locale={locale} className="w-full" />
              <DemoNote locale={locale} />
            </div>
          </Container>
        </MobileMenu>
      </Container>
    </header>
  );
}
