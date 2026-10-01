"use client";

import { useParams } from "next/navigation";
import { ErrorView } from "@/components/error-view";
import { sitePath } from "@/components/site/site-config";
import { defaultLocale, hasLocale } from "@/i18n/config";

/**
 * Public-site error boundary (§23.3): a failing page keeps the site header and
 * footer around a localized explanation, a retry and a link home — never the
 * framework's English default screen.
 */
export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = hasLocale(params.locale) ? params.locale : defaultLocale;
  return <ErrorView locale={locale} error={error} retry={retry} homeHref={sitePath(locale, "home")} className="px-4 py-16" />;
}
