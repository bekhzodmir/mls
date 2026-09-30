"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ExternalLink, GitMerge, Link2, ShieldOff, UserPlus, Undo2, Users } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import domain from "@/i18n/messages/domain";
import leads from "@/i18n/messages/leads";
import { formatDate, formatList } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { appPath } from "@/lib/routes";
import type { DuplicateHit, DuplicateReason } from "./duplicates";

export type DuplicateDecision = "link" | "merge" | "separate";

function reasonList(locale: Locale, reasons: DuplicateReason[]): string {
  const t = leads[locale].duplicate.reasons;
  return formatList(locale, reasons.map((reason) => t[reason]));
}

/**
 * «Похоже, этот человек уже есть в CRM» (§14.1, §35.3 step 3) with the
 * agent's choice: Open, Link, Merge or Create separately. The choice is
 * demo-only local state and says so; nothing is merged automatically.
 *
 * - `inbox`: a lead already exists — Open / Merge / Create anyway.
 * - `form`: before saving a new record — Open / Link / Merge / Create
 *   separately; the parent reads the decision through `onDecide`.
 */
export function DuplicateNotice({
  locale,
  hits,
  variant,
  decision,
  onDecide,
}: {
  locale: Locale;
  hits: DuplicateHit[];
  variant: "inbox" | "form";
  decision?: DuplicateDecision;
  onDecide?: (decision: DuplicateDecision | undefined) => void;
}) {
  const t = leads[locale].duplicate;
  const [local, setLocal] = useState<DuplicateDecision>();
  const current = decision ?? local;
  const titleId = useId();
  const [best, ...others] = hits;
  if (!best) return null;
  const clientHref = (id: string) => appPath(locale, `/clients/${encodeURIComponent(id)}`);

  const decide = (next: DuplicateDecision | undefined) => {
    setLocal(next);
    onDecide?.(next);
  };

  const options: { key: DuplicateDecision; label: string; icon: typeof Link2 }[] =
    variant === "form"
      ? [
          { key: "link", label: t.link, icon: Link2 },
          { key: "merge", label: t.merge, icon: GitMerge },
          { key: "separate", label: t.createSeparately, icon: UserPlus },
        ]
      : [
          { key: "merge", label: t.merge, icon: GitMerge },
          { key: "separate", label: t.createAnyway, icon: UserPlus },
        ];

  const result =
    current === "link"
      ? format(t.linked, { name: best.client.name })
      : current === "merge"
        ? format(t.merged, { name: best.client.name })
        : current === "separate"
          ? t.separate
          : undefined;

  return (
    <section
      aria-labelledby={titleId}
      className="space-y-2 rounded-md border border-warning-border bg-warning-bg p-3 text-small text-warning-fg"
    >
      <p id={titleId} className="flex items-center gap-2 font-semibold">
        <Users aria-hidden className="size-4 shrink-0" />
        {t.title}
      </p>
      <p>
        <Link href={clientHref(best.client.id)} className="font-semibold underline underline-offset-2">
          {best.client.name}
        </Link>{" "}
        — {reasonList(locale, best.reasons)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="neutral">{format(t.status, { status: domain[locale].clientStatus[best.client.status] })}</Badge>
        {best.client.contactRevokedAt ? (
          <Badge tone="danger" icon={ShieldOff}>
            {t.revokedBadge}
          </Badge>
        ) : null}
      </div>
      {best.client.contactRevokedAt ? (
        <p>{format(t.revokedConsent, { date: formatDate(locale, best.client.contactRevokedAt) })}</p>
      ) : null}
      {others.length > 0 ? (
        <ul className="space-y-1">
          {others.map((hit) => (
            <li key={hit.client.id}>
              <Link href={clientHref(hit.client.id)} className="underline underline-offset-2">
                {hit.client.name}
              </Link>{" "}
              — {reasonList(locale, hit.reasons)}
            </li>
          ))}
        </ul>
      ) : null}

      {result ? (
        <div role="status" className="space-y-2 rounded-sm bg-surface/70 p-2 text-fg">
          <p>{result}</p>
          <Button variant="ghost" onClick={() => decide(undefined)} className="-ml-2">
            <Undo2 aria-hidden className="size-4" />
            {t.undo}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-caption opacity-90">{t.hint}</p>
          <div role="group" aria-label={t.decisionLabel} className="flex flex-wrap gap-2">
            <Link href={clientHref(best.client.id)} className={buttonClasses("secondary", "md")}>
              <ExternalLink aria-hidden className="size-4" />
              {t.open}
            </Link>
            {options.map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                variant="secondary"
                onClick={() => decide(key)}
                className={cn(key === "separate" && "text-fg-muted")}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
