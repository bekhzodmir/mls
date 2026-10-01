import type { Metadata } from "next";
import Link from "next/link";
import { LocaleSwitch } from "@/components/locale-switch";
import { sitePath } from "@/components/site/site-config";
import { BinorMark } from "@/components/ui/brand-mark";
import { format } from "@/i18n/define-messages";
import auth from "@/i18n/messages/auth";
import { getLocale } from "@/i18n/server";
import { telHref } from "@/lib/domain/phone";
import { publicContacts } from "@/lib/site";

export const metadata: Metadata = {
  title: { template: `%s · ${publicContacts.brand}`, default: publicContacts.brand },
};

/**
 * Minimal chrome for sign-in and onboarding (§21.4 screens 2–9): the brand
 * mark back to the public site, the language switch and one support line —
 * neither the marketing header nor the workspace shell, so nothing competes
 * with the one task on screen. A single centred column on every width.
 */
export default async function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const t = auth[locale].layout;
  const linkClass =
    "inline-flex min-h-11 items-center rounded-sm font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-primary";

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-3 focus:shadow-float"
      >
        {t.skipToContent}
      </a>

      <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href={sitePath(locale, "home")} aria-label={t.home} className="flex h-11 items-center rounded-md">
          <BinorMark />
        </Link>
        <LocaleSwitch locale={locale} label={t.language} />
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-xl flex-1 px-4 py-6 focus:outline-none sm:py-10">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="flex flex-wrap items-center gap-x-3 border-t border-border pt-3 text-caption text-fg-muted">
          <span>{t.support}</span>
          <a href={telHref(publicContacts.phoneE164)} className={linkClass}>
            {format(t.phone, { phone: publicContacts.phoneDisplay, ...publicContacts.supportHours })}
          </a>
          <a href={publicContacts.telegramBotUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {format(t.bot, { bot: publicContacts.telegramBot })}
            <span className="sr-only"> ({t.newTab})</span>
          </a>
        </p>
      </footer>
    </div>
  );
}
