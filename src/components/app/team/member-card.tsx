import Link from "next/link";
import { ChevronRight, Crown, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatList } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import team from "@/i18n/messages/team";
import type { TeamMemberView } from "@/lib/data/views";
import { AvailabilityBadge } from "./badges";
import { CapacityLine, HiddenMetrics, MetricsGrid } from "./metrics";
import { availabilityState, capacityState } from "./team-model";

/**
 * A team member (screen 78): who, availability as routing sees it, and —
 * when the actor may read this member's reports — capacity left today and
 * the workload counts.
 */
export function MemberCard({
  locale,
  member,
  now,
  metricsVisible,
  href,
  headingLevel = 3,
}: {
  locale: Locale;
  member: TeamMemberView;
  now: Date;
  metricsVisible: boolean;
  href: string;
  headingLevel?: 2 | 3;
}) {
  const t = team[locale];
  const d = domain[locale];
  const { agent, availability } = member;
  const titleId = `member-${agent.id}-title`;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const specializations = availability.specializations.map((type) => d.propertyType[type]);

  return (
    <article aria-labelledby={titleId} className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Avatar name={agent.name} />
        <div className="min-w-0 flex-1 space-y-1">
          <Heading id={titleId} className="text-body font-semibold text-fg">
            <Link href={href} className="underline-offset-4 hover:underline">
              {agent.name}
            </Link>
          </Heading>
          <p className="text-caption text-fg-muted">{d.role[agent.role]}</p>
          <div className="flex flex-wrap gap-1.5">
            {member.isViewer ? (
              <Badge tone="brand" icon={UserRound}>
                {t.overview.you}
              </Badge>
            ) : null}
            {member.isLead ? (
              <Badge tone="neutral" icon={Crown}>
                {t.overview.lead}
              </Badge>
            ) : null}
            <AvailabilityBadge locale={locale} state={availabilityState(availability, now)} />
          </div>
        </div>
      </div>

      {specializations.length > 0 ? (
        <p className="text-caption text-fg-muted">
          {t.member.specializations}: {formatList(locale, specializations)}
        </p>
      ) : null}

      {metricsVisible ? (
        <div className="space-y-3">
          <CapacityLine locale={locale} capacity={capacityState(member)} />
          <MetricsGrid locale={locale} metrics={member.metrics} />
        </div>
      ) : (
        <HiddenMetrics locale={locale} />
      )}

      <div className="flex justify-end border-t border-border pt-3">
        <ButtonLink href={href} variant="secondary" aria-label={format(t.overview.openMember, { name: agent.name })}>
          {t.overview.open}
          <ChevronRight aria-hidden className="size-4" />
        </ButtonLink>
      </div>
    </article>
  );
}
