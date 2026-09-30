import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, FlaskConical, Search } from "lucide-react";
import { LocaleSwitch } from "@/components/locale-switch";
import { BinorMark } from "@/components/ui/brand-mark";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import shell from "@/i18n/messages/shell";
import { appHref } from "@/lib/routes";
import { BottomNav } from "./bottom-nav";
import { QuickCreate } from "./quick-create";
import { Sidebar } from "./sidebar";

/**
 * Mobile-first workspace chrome: top bar, content, bottom navigation and the
 * global "+" on phones; a sidebar with the same destinations on desktop.
 */
export function AppShell({
  locale,
  unreadCount,
  children,
}: {
  locale: Locale;
  unreadCount: number;
  children: ReactNode;
}) {
  const t = shell[locale];
  
  return (
    <div className="group/shell flex min-h-dvh flex-col bg-bg lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
      >
        {t.skipToContent}
      </a>

      <aside className="hidden w-64 shrink-0 flex-col gap-4 border-r border-border bg-surface px-3 py-4 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:overflow-y-auto">
        <Link href={appHref(locale, "today")} aria-label={t.topbar.home} className="flex h-11 items-center px-2">
          <BinorMark />
        </Link>
        <QuickCreate locale={locale} />
        <Sidebar locale={locale} />
        <div className="mt-auto px-2">
          <LocaleSwitch locale={locale} label={t.topbar.language} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-4">
            <Link href={appHref(locale, "today")} aria-label={t.topbar.home} className="mr-auto flex h-11 items-center">
              <BinorMark />
            </Link>
            <Link
              href={appHref(locale, "search")}
              className="inline-flex size-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted"
            >
              <Search aria-hidden className="size-5" />
              <span className="sr-only">{t.topbar.search}</span>
            </Link>
            <Link
              href={appHref(locale, "notifications")}
              className="relative inline-flex size-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted"
            >
              <Bell aria-hidden className="size-5" />
              <span className="sr-only">
                {t.topbar.notifications}
                {unreadCount > 0 ? `, ${format(t.topbar.unread, { n: unreadCount })}` : ""}
              </span>
              {unreadCount > 0 ? (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-1.5 inline-flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-bold text-primary-fg"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <LocaleSwitch locale={locale} label={t.topbar.language} className="ml-1" />
          </div>
        </header>

        <div className="border-b border-warning-border bg-warning-bg text-warning-fg">
          <p className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1.5 text-caption">
            <FlaskConical aria-hidden className="size-3.5 shrink-0" />
            <span className="font-semibold">{t.demo.badge}.</span>
            <span>{t.demo.text}</span>
          </p>
        </div>

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-bottom-nav lg:px-8 lg:pt-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* The phone "+" would cover the right end of a sticky action bar, so it
          steps aside while any `data-sticky-actions` bar is on the page. */}
      <div className="lg:hidden group-has-[[data-sticky-actions]]/shell:hidden">
        <QuickCreate locale={locale} />
      </div>
      <BottomNav locale={locale} />
    </div>
  );
}
