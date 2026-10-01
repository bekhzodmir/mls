"use client";

import { useParams } from "next/navigation";
import { ErrorView } from "@/components/error-view";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { appHref } from "@/lib/routes";

/**
 * Workspace error boundary (§23.3, §36.6): a human explanation, a retry and a
 * safe way back. No status codes or error digests are shown to the user; the
 * workspace chrome (navigation, "+") stays usable around it.
 */
export default function WorkspaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = hasLocale(params.locale) ? params.locale : defaultLocale;
  return <ErrorView locale={locale} error={error} retry={retry} homeHref={appHref(locale, "today")} />;
}
