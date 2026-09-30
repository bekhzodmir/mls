"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_COOKIE, localeLabels, locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";

/** Swaps the leading locale segment and keeps the rest of the path. */
export function localizedPath(pathname: string, target: Locale): string {
  const segments = pathname.split("/");
  if ((locales as readonly string[]).includes(segments[1] ?? "")) segments[1] = target;
  else segments.splice(1, 0, target);
  return segments.join("/") || `/${target}`;
}

/**
 * RU / UZ switcher. Remembers the explicit choice in a cookie so the proxy
 * sends locale-less URLs (e.g. from Telegram) to the same language next time.
 */
export function LocaleSwitch({
  locale,
  label,
  className,
}: {
  locale: Locale;
  label: string;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className={cn("flex items-center rounded-md border border-border p-0.5", className)}>
      {locales.map((target) => {
        const active = target === locale;
        const href = localizedPath(pathname, target);
        return (
          <Link
            key={target}
            href={href}
            hrefLang={target}
            lang={target === "uz" ? "uz-Latn" : target}
            aria-current={active ? "true" : undefined}
            title={localeLabels[target].long}
            onClick={() => {
              document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=31536000; samesite=lax`;
            }}
            className={cn(
              "inline-flex h-10 min-w-11 items-center justify-center rounded-sm px-2 text-caption font-semibold transition-colors",
              active ? "bg-primary text-primary-fg" : "text-fg-muted hover:bg-surface-muted",
            )}
          >
            {localeLabels[target].short}
          </Link>
        );
      })}
    </nav>
  );
}
