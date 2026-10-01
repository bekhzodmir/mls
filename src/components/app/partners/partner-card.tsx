import Link from "next/link";
import { Building2, ChevronRight, Clock, Handshake, Lock, LockOpen, Network } from "lucide-react";
import { ProfessionalStatusBadge } from "@/components/app/team/badges";
import { badgeItem } from "@/components/app/team/verification";
import { displayedProfessionalStatus } from "@/lib/domain/professional-status";
import { VerificationBadge } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import { format, plural } from "@/i18n/define-messages";
import { formatDateTime, formatRelative } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import partners from "@/i18n/messages/partners";
import type { PartnerListItem } from "@/lib/data/views";

/**
 * A partner in the list (screen 57, §5.6): who and from which agency, the
 * professional status as checked (§38.2), checked facts as results only
 * (§19), whether contacts are open (§18.2), cooperation with the viewer,
 * Active MLS listings and the last interaction.
 */
export function PartnerCard({ locale, item, now, href }: { locale: Locale; item: PartnerListItem; now: Date; href: string }) {
  const t = partners[locale].card;
  const d = domain[locale];
  const { agent, organization, cooperation } = item;
  const titleId = `partner-${agent.id}-title`;

  return (
    <article aria-labelledby={titleId} className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Avatar name={agent.name} />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id={titleId} className="text-body font-semibold text-fg">
            <Link href={href} className="underline-offset-4 hover:underline">
              {agent.name}
            </Link>
          </h2>
          <p className="flex items-center gap-1.5 text-caption text-fg-muted">
            <Building2 aria-hidden className="size-3.5 shrink-0" />
            {organization?.name ?? t.noOrganization} · {d.role[agent.role]}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <ProfessionalStatusBadge locale={locale} status={displayedProfessionalStatus(agent)} />
        {item.contactsShared ? (
          <Badge tone="success" icon={LockOpen}>
            {t.contactsShared}
          </Badge>
        ) : (
          <Badge tone="neutral" icon={Lock}>
            {t.contactsHidden}
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-caption font-medium text-fg-muted">{t.facts}</p>
        {agent.verifications.length === 0 ? (
          <p className="text-small text-fg-muted">{t.factsNone}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {agent.verifications.map((fact) => (
              <li key={fact.id}>
                <VerificationBadge locale={locale} item={badgeItem(fact)} showSource={false} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="space-y-1 text-small">
        <li className="flex items-start gap-1.5 text-fg">
          <Handshake aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          {cooperation.total === 0
            ? t.cooperationNone
            : format(t.cooperationStats, {
                total: cooperation.total,
                accepted: cooperation.accepted,
                inProgress: cooperation.inProgress,
                declined: cooperation.declined,
              })}
        </li>
        <li className="flex items-start gap-1.5 text-fg">
          <Network aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          {item.activeMlsListings === 0
            ? t.listingsNone
            : format(plural(locale, item.activeMlsListings, t.listings), { n: item.activeMlsListings })}
        </li>
        <li className="flex items-start gap-1.5 text-fg-muted">
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
          {item.lastInteractionAt ? (
            <time dateTime={item.lastInteractionAt} title={formatDateTime(locale, item.lastInteractionAt)}>
              {format(t.lastInteraction, { relative: formatRelative(locale, item.lastInteractionAt, now) })}
            </time>
          ) : (
            t.lastInteractionNone
          )}
        </li>
      </ul>

      <div className="flex justify-end border-t border-border pt-3">
        <ButtonLink href={href} variant="secondary" aria-label={format(t.openLabel, { name: agent.name })}>
          {t.open}
          <ChevronRight aria-hidden className="size-4" />
        </ButtonLink>
      </div>
    </article>
  );
}
