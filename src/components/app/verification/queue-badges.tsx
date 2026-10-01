import {
  Building2,
  CalendarX,
  Clock,
  Handshake,
  Hourglass,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { VerificationBadge } from "@/components/domain/badges";
import { Badge, type Tone } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import verification from "@/i18n/messages/verification";
import type { VerificationQueueItem } from "@/lib/data/views";
import type { QueueBucket } from "./queue";

/**
 * Badges of the Verification Center. Every badge pairs an icon with words;
 * colour only repeats them (§20.6). "Could not verify" keeps the neutral
 * question-mark look of the shared `VerificationBadge` — never the check.
 */

export const bucketStyle: Record<QueueBucket, { tone: Tone; icon: LucideIcon }> = {
  problem: { tone: "danger", icon: ShieldAlert },
  expired: { tone: "danger", icon: CalendarX },
  unavailable: { tone: "neutral", icon: ShieldQuestion },
  pending: { tone: "info", icon: Clock },
  expiring: { tone: "warning", icon: Hourglass },
  confirmed: { tone: "success", icon: ShieldCheck },
};

export function BucketBadge({ locale, bucket, title }: { locale: Locale; bucket: QueueBucket; title?: string }) {
  const { tone, icon } = bucketStyle[bucket];
  return (
    <Badge tone={tone} icon={icon} title={title}>
      {verification[locale].bucket[bucket]}
    </Badge>
  );
}

/**
 * One checked fact: "Право собственности: Подтверждено". A result-only item
 * (§19) has no source, so the shared badge gets none and shows the method only.
 */
export function FactBadge({ locale, entry }: { locale: Locale; entry: Pick<VerificationQueueItem, "item" | "detailed"> }) {
  const source = entry.detailed ? entry.item.source : undefined;
  return <VerificationBadge locale={locale} item={{ ...entry.item, source: source ?? "" }} showSource={Boolean(source)} />;
}

const scopeIcon: Record<VerificationQueueItem["scope"], LucideIcon> = {
  own: UserRound,
  agency: Building2,
  partner: Handshake,
};

export function QueueScopeBadge({ locale, scope }: { locale: Locale; scope: VerificationQueueItem["scope"] }) {
  return (
    <Badge tone={scope === "own" ? "brand" : "neutral"} icon={scopeIcon[scope]}>
      {verification[locale].item.scope[scope]}
    </Badge>
  );
}
