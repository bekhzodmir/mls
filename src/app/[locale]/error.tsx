"use client";

import { useParams } from "next/navigation";
import { ErrorView } from "@/components/error-view";
import { sitePath } from "@/components/site/site-config";
import { defaultLocale, hasLocale } from "@/i18n/config";

/**
 * Locale-level error boundary (§23.3). A segment's own `error.tsx` does not
 * wrap that segment's layout, so this one catches failures in the site and
 * workspace layouts themselves (e.g. the shell's data) inside the root layout,
 * in the page language.
 */
export default function LocaleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = hasLocale(params.locale) ? params.locale : defaultLocale;
  return <ErrorView locale={locale} error={error} retry={retry} homeHref={sitePath(locale, "home")} className="px-4 py-16" />;
}
