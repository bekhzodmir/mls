import {
  BadgeCheck,
  Building2,
  CircleHelp,
  Clock,
  Hourglass,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  TriangleAlert,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import matching from "@/i18n/messages/matching";
import { formatMoney } from "@/lib/domain/money";
import type {
  ConfidenceBand,
  Freshness,
  Money,
  SourceKind,
  VerificationItem,
} from "@/lib/domain/types";
import { cn } from "@/lib/cn";

const freshnessStyle: Record<Freshness["state"], { tone: Tone; icon: LucideIcon }> = {
  fresh: { tone: "success", icon: Sparkles },
  normal: { tone: "neutral", icon: Clock },
  aging: { tone: "warning", icon: Hourglass },
  needs_confirmation: { tone: "warning", icon: TriangleAlert },
  expired: { tone: "danger", icon: TriangleAlert },
};

/** Freshness is shown separately from business status (§36.4) and never as a plain "Active". */
export function FreshnessBadge({ locale, freshness }: { locale: Locale; freshness: Freshness }) {
  const { tone, icon } = freshnessStyle[freshness.state];
  const t = matching[locale];
  const title = format(freshness.basis === "last_confirmed" ? t.ageDays : t.agePublished, {
    n: freshness.ageDays,
  });
  return (
    <Badge tone={tone} icon={icon} title={title}>
      {domain[locale].freshness[freshness.state]}
    </Badge>
  );
}

const verificationStyle: Record<VerificationItem["status"], { tone: Tone; icon: LucideIcon }> = {
  confirmed: { tone: "success", icon: ShieldCheck },
  pending: { tone: "info", icon: Clock },
  // A registry that did not answer is never shown as verified (§16.4).
  unavailable: { tone: "neutral", icon: ShieldQuestion },
  problem: { tone: "danger", icon: ShieldAlert },
};

/**
 * One badge = one checked fact (§38.2): "Право собственности: Подтверждено".
 * The method (owner's words vs official source) is part of the accessible label.
 */
export function VerificationBadge({ locale, item }: { locale: Locale; item: VerificationItem }) {
  const d = domain[locale];
  const { tone, icon } = verificationStyle[item.status];
  return (
    <Badge tone={tone} icon={icon} title={`${d.verificationMethod[item.method]} · ${item.source}`}>
      {d.verificationSubject[item.subject]}: {d.verificationStatus[item.status]}
    </Badge>
  );
}

const sourceStyle: Record<SourceKind, { tone: Tone; icon: LucideIcon }> = {
  verified_binor: { tone: "brand", icon: BadgeCheck },
  realtor_confirmed: { tone: "neutral", icon: UserCheck },
  agency: { tone: "neutral", icon: Building2 },
  telegram: { tone: "info", icon: Send },
  external_unconfirmed: { tone: "warning", icon: CircleHelp },
};

export function SourceBadge({ locale, source }: { locale: Locale; source: SourceKind }) {
  const { tone, icon } = sourceStyle[source];
  return (
    <Badge tone={tone} icon={icon}>
      {domain[locale].source[source]}
    </Badge>
  );
}

const bandTone: Record<ConfidenceBand, Tone> = {
  excellent: "success",
  good: "brand",
  possible: "neutral",
  hidden: "neutral",
};

export function BandBadge({
  locale,
  band,
  score,
}: {
  locale: Locale;
  band: ConfidenceBand;
  score?: number;
}) {
  return (
    <Badge
      tone={bandTone[band]}
      title={score === undefined ? undefined : format(matching[locale].scoreLabel, { score })}
    >
      {domain[locale].band[band]}
    </Badge>
  );
}

/** Tabular money with the correct currency marker for the locale. */
export function MoneyText({
  locale,
  value,
  className,
  compact,
}: {
  locale: Locale;
  value: Money;
  className?: string;
  compact?: boolean;
}) {
  return <span className={cn("tabular", className)}>{formatMoney(locale, value, { compact })}</span>;
}
