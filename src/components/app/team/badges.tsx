import {
  BadgeCheck,
  CircleCheck,
  CircleDot,
  CirclePause,
  Clock,
  History,
  Plane,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDateTime } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import team from "@/i18n/messages/team";
import type { ProfessionalStatus } from "@/lib/domain/types";
import type { AvailabilityState } from "./team-model";

/**
 * Team badges: every state pairs an icon with text, so it never relies on
 * colour alone (§20.6). Presentational, server or client.
 */

const availabilityStyle: Record<AvailabilityState["kind"], { tone: Tone; icon: LucideIcon }> = {
  available: { tone: "success", icon: CircleCheck },
  busy: { tone: "warning", icon: Clock },
  away: { tone: "neutral", icon: Plane },
  // The return date has passed but the status was not updated: stale, not "available".
  away_ended: { tone: "warning", icon: History },
};

export function availabilityText(locale: Locale, state: AvailabilityState): string {
  const t = team[locale].availability;
  switch (state.kind) {
    case "available":
      return t.available;
    case "busy":
      return t.busy;
    case "away":
      return state.until ? format(t.awayUntil, { date: formatDateTime(locale, state.until) }) : t.awayOpen;
    case "away_ended":
      return format(t.awayEnded, { date: formatDateTime(locale, state.until) });
  }
}

export function AvailabilityBadge({ locale, state }: { locale: Locale; state: AvailabilityState }) {
  const { tone, icon } = availabilityStyle[state.kind];
  return (
    <Badge tone={tone} icon={icon} title={team[locale].availability.label}>
      {availabilityText(locale, state)}
    </Badge>
  );
}

/** The legal status is its own fact (§38.2): a certified realtor ≠ a real-estate agent. */
const statusStyle: Record<ProfessionalStatus, { tone: Tone; icon: LucideIcon }> = {
  certified_realtor: { tone: "success", icon: BadgeCheck },
  real_estate_agent: { tone: "info", icon: BadgeCheck },
  unconfirmed: { tone: "warning", icon: UserRoundX },
};

/** Pass the result of `displayedProfessionalStatus`: "certified" only with a confirmed certificate check. */
export function ProfessionalStatusBadge({ locale, status }: { locale: Locale; status: ProfessionalStatus }) {
  const { tone, icon } = statusStyle[status];
  return (
    <Badge tone={tone} icon={icon}>
      {domain[locale].professionalStatus[status]}
    </Badge>
  );
}

export function RuleStateBadge({ locale, active }: { locale: Locale; active: boolean }) {
  const t = team[locale].routing;
  return active ? (
    <Badge tone="success" icon={CircleDot}>
      {t.active}
    </Badge>
  ) : (
    <Badge tone="neutral" icon={CirclePause}>
      {t.inactive}
    </Badge>
  );
}
