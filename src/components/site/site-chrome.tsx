import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import site from "@/i18n/messages/site";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * Header, main landmark and footer shared by the site layout and the
 * localized 404 (which renders outside the `(site)` group).
 */
export function SiteChrome({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-3 focus:shadow-float"
      >
        {site[locale].skipToContent}
      </a>
      <SiteHeader locale={locale} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
