import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Inbox, Phone, Send, UserPlus } from "lucide-react";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { htmlLang, type Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDateTime, formatRelative } from "@/i18n/format";
import leads from "@/i18n/messages/leads";
import type { LeadView } from "@/lib/data/views";
import { formatUzPhone, telHref } from "@/lib/domain/phone";
import { appPath } from "@/lib/routes";
import { LeadSourceBadge, LeadStatusBadge, SlaBadge } from "./badges";
import { DuplicateNotice } from "./duplicate-notice";
import { contactCard, duplicateReasons } from "./duplicates";
import { describeSla } from "./sla";

const CLOSED = new Set(["converted", "lost"]);

export function leadHref(locale: Locale, id: string): string {
  return appPath(locale, `/leads/${encodeURIComponent(id)}`);
}

export function telegramHref(username: string): string {
  return `https://t.me/${encodeURIComponent(username.replace(/^@/, ""))}`;
}

/** "+998 90 174 54 55", "@username" or "no contact" — the way the agent will reach the person. */
export function leadContact(locale: Locale, view: LeadView): string {
  const { lead } = view;
  if (lead.phone) return formatUzPhone(lead.phone);
  if (lead.telegramUsername) return `@${lead.telegramUsername}`;
  return leads[locale].card.noContact;
}

/**
 * Lead Inbox card (§14.1, §22.2): who, from where, when, the SLA state, who
 * is responsible and the next step. The primary action is the one that moves
 * the lead forward: assign an unassigned lead, otherwise reach the person.
 */
export function LeadCard({ locale, view, at }: { locale: Locale; view: LeadView; at: Date }) {
  const t = leads[locale];
  const { lead } = view;
  const name = lead.name ?? t.card.noName;
  const sla = describeSla(locale, lead, view.sla);
  const href = leadHref(locale, lead.id);
  const open = !CLOSED.has(lead.status);
  const titleId = `lead-${lead.id}-title`;

  const duplicate = view.duplicateCandidate
    ? {
        client: contactCard(view.duplicateCandidate),
        reasons: duplicateReasons(
          { name: lead.name, phones: lead.phone ? [lead.phone] : [], telegramUsername: lead.telegramUsername },
          view.duplicateCandidate,
        ),
      }
    : undefined;

  let primary: ReactNode;
  if (open && !view.assignedAgent) {
    primary = (
      <ButtonLink href={`${href}#assign`} className="flex-1 sm:flex-none">
        <UserPlus aria-hidden className="size-4" />
        {t.card.assign}
      </ButtonLink>
    );
  } else if (open && lead.phone) {
    primary = (
      <ButtonAnchor href={telHref(lead.phone)} className="flex-1 sm:flex-none">
        <Phone aria-hidden className="size-4" />
        {t.card.call}
      </ButtonAnchor>
    );
  } else if (open && lead.telegramUsername) {
    primary = (
      <ButtonAnchor
        href={telegramHref(lead.telegramUsername)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 sm:flex-none"
      >
        <Send aria-hidden className="size-4" />
        {t.card.write}
      </ButtonAnchor>
    );
  }

  return (
    <article aria-labelledby={titleId} className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        {lead.name ? (
          <Avatar name={lead.name} />
        ) : (
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted"
          >
            <Inbox className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-body font-semibold text-fg">
            <Link href={href} className="hover:underline">
              {name}
            </Link>
          </h2>
          <p className="text-caption text-fg-muted">
            <span className="tabular">{leadContact(locale, view)}</span>
            {" · "}
            <time dateTime={lead.receivedAt} title={formatDateTime(locale, lead.receivedAt)}>
              {format(t.card.received, { time: formatRelative(locale, lead.receivedAt, at) })}
            </time>
          </p>
        </div>
        <LeadStatusBadge locale={locale} status={lead.status} />
      </div>

      <p lang={htmlLang[lead.language]} className="line-clamp-2 text-small text-fg">
        {lead.message}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <LeadSourceBadge locale={locale} source={lead.source} />
        <SlaBadge display={sla} label={t.sla.label} />
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-small sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="text-fg-muted">{t.card.responsible}:</dt>
          <dd className={view.assignedAgent ? "text-fg" : "font-medium text-warning-fg"}>
            {view.assignedAgent?.name ?? t.card.unassigned}
          </dd>
        </div>
        {lead.status === "lost" && lead.lostReason ? (
          <div className="flex gap-1.5">
            <dt className="text-fg-muted">{t.card.lostReason}:</dt>
            <dd className="text-fg">{lead.lostReason}</dd>
          </div>
        ) : open ? (
          <div className="flex gap-1.5">
            <dt className="text-fg-muted">{t.card.nextAction}:</dt>
            <dd className={lead.nextAction ? "text-fg" : "text-fg-muted"}>{lead.nextAction ?? t.card.noNextAction}</dd>
          </div>
        ) : null}
      </dl>

      {duplicate && open ? <DuplicateNotice locale={locale} hits={[duplicate]} variant="inbox" /> : null}

      <div className="flex flex-wrap gap-2">
        {primary}
        <ButtonLink
          href={href}
          variant="secondary"
          aria-label={format(t.card.openLead, { name })}
          className="flex-1 sm:flex-none"
        >
          {t.card.open}
          <ChevronRight aria-hidden className="size-4" />
        </ButtonLink>
      </div>
    </article>
  );
}
