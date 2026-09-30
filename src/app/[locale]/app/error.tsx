"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { House, RotateCcw, TriangleAlert } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import errors from "@/i18n/messages/errors";
import { appHref } from "@/lib/routes";
import { publicContacts } from "@/lib/site";

/**
 * Workspace error boundary (§23.3, §36.6): a human explanation, a retry and a
 * safe way back. No status codes or error digests are shown to the user; the
 * workspace chrome (navigation, "+") stays usable around it.
 */
export default function WorkspaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = hasLocale(params.locale) ? params.locale : defaultLocale;
  const t = errors[locale].boundary;

  useEffect(() => {
    // Kept for the developer console and error reporting; never rendered.
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-warning-bg text-warning-fg">
        <TriangleAlert aria-hidden className="size-6" />
      </span>
      <h1 className="text-h1 text-fg">{t.title}</h1>
      <p className="text-small text-fg-muted">{t.text}</p>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button size="lg" onClick={() => retry()}>
          <RotateCcw aria-hidden className="size-5" />
          {t.retry}
        </Button>
        <Link href={appHref(locale, "today")} className={buttonClasses("secondary", "lg")}>
          <House aria-hidden className="size-5" />
          {t.home}
        </Link>
      </div>
      <p className="text-caption text-fg-muted">{format(t.support, { bot: publicContacts.telegramBot })}</p>
    </div>
  );
}
