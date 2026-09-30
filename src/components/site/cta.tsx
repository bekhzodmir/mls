import { FlaskConical, LayoutDashboard, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import site from "@/i18n/messages/site";
import { appHref } from "@/lib/routes";
import { publicContacts } from "@/lib/site";
import { cn } from "@/lib/cn";

type Size = "md" | "lg";
type Variant = "primary" | "secondary";

/** Screen-reader note appended to links that open a new tab. */
export function NewTabNote({ locale }: { locale: Locale }) {
  return <span className="sr-only"> ({site[locale].cta.newTab})</span>;
}

/** Primary call to action: the Telegram bot is where registration and work happen (§6.1). */
export function TelegramButton({
  locale,
  size = "lg",
  variant = "primary",
  label,
  compact,
  className,
}: {
  locale: Locale;
  size?: Size;
  variant?: Variant;
  label?: string;
  /** Shows just "Telegram" (for tight headers); the full label stays in the accessible name. */
  compact?: boolean;
  className?: string;
}) {
  const t = site[locale].cta;
  const text = label ?? t.telegram;
  return (
    <ButtonAnchor
      href={publicContacts.telegramBotUrl}
      target="_blank"
      rel="noopener noreferrer"
      variant={variant}
      size={size}
      className={className}
    >
      <Send aria-hidden className="size-4.5" />
      {compact ? (
        <>
          <span aria-hidden>{t.telegramShort}</span>
          <span className="sr-only">{text}</span>
        </>
      ) : (
        text
      )}
      <NewTabNote locale={locale} />
    </ButtonAnchor>
  );
}

/** Icon-only Telegram button for the narrow header; the label stays available to screen readers. */
export function TelegramIconButton({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <ButtonAnchor
      href={publicContacts.telegramBotUrl}
      target="_blank"
      rel="noopener noreferrer"
      size="icon"
      className={className}
    >
      <Send aria-hidden className="size-5" />
      <span className="sr-only">{site[locale].cta.telegram}</span>
      <NewTabNote locale={locale} />
    </ButtonAnchor>
  );
}

/**
 * Secondary call to action into the workspace demo. It is always labelled as
 * a demo: the workspace runs on fictional seed data and saves nothing.
 */
export function DemoButton({
  locale,
  size = "lg",
  className,
}: {
  locale: Locale;
  size?: Size;
  className?: string;
}) {
  const t = site[locale].cta;
  return (
    <ButtonLink href={appHref(locale, "today")} variant="secondary" size={size} className={className}>
      <LayoutDashboard aria-hidden className="size-4.5" />
      {t.demo}
      {/* The label already says "demo"; the badge is its visual marker. */}
      <span aria-hidden className="inline-flex">
        <Badge tone="warning" icon={FlaskConical}>
          {t.demoBadge}
        </Badge>
      </span>
    </ButtonLink>
  );
}

/** The one-line demo disclaimer shown next to demo buttons. */
export function DemoNote({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-caption text-fg-subtle", className)}>
      <FlaskConical aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{site[locale].cta.demoNote}</span>
    </p>
  );
}
