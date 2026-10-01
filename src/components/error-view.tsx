"use client";

import Link from "next/link";
import { useEffect } from "react";
import { House, RotateCcw, TriangleAlert } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import errors from "@/i18n/messages/errors";
import { cn } from "@/lib/cn";
import { publicContacts } from "@/lib/site";

/**
 * Shared body of the error boundaries (§23.3, §36.6): a human explanation in
 * the page language, a retry and a safe way back. No status codes or error
 * digests are shown; the error is kept for the console and error reporting.
 */
export function ErrorView({
  locale,
  error,
  retry,
  homeHref,
  className,
}: {
  locale: Locale;
  error: Error & { digest?: string };
  retry: () => void;
  homeHref: string;
  className?: string;
}) {
  const t = errors[locale].boundary;

  useEffect(() => {
    // Kept for the developer console and error reporting; never rendered.
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className={cn("mx-auto flex max-w-md flex-col items-center gap-4 py-10 text-center", className)}>
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
        <Link href={homeHref} className={buttonClasses("secondary", "lg")}>
          <House aria-hidden className="size-5" />
          {t.home}
        </Link>
      </div>
      <p className="text-caption text-fg-muted">{format(t.support, { bot: publicContacts.telegramBot })}</p>
    </div>
  );
}
