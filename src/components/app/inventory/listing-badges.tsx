import {
  Archive,
  BadgeCheck,
  Building2,
  CalendarX,
  CircleCheckBig,
  CircleSlash,
  Clock,
  Eye,
  FilePen,
  FileSignature,
  Handshake,
  HandCoins,
  ImageIcon,
  Lock,
  Network,
  PauseCircle,
  Scale,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  TrendingDown,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Chip } from "@/components/ui/misc";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import properties from "@/i18n/messages/properties";
import type { ListingAccess } from "@/lib/data/views";
import { formatMoney } from "@/lib/domain/money";
import type { ListingStatus, VerificationItem } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { attributeChips, type PhysicalFacts, type PriceChange, verificationSummary } from "./labels";

/**
 * Listing-level badges for property cards and the profile. Every badge pairs
 * an icon with text; colour only repeats what the words say (§20.6).
 */

const statusStyle: Record<ListingStatus, { tone: Tone; icon: LucideIcon }> = {
  draft: { tone: "neutral", icon: FilePen },
  contract_signed: { tone: "info", icon: FileSignature },
  verification_pending: { tone: "info", icon: Clock },
  verified: { tone: "success", icon: BadgeCheck },
  active_mls: { tone: "success", icon: Network },
  offer: { tone: "brand", icon: HandCoins },
  under_contract: { tone: "brand", icon: Handshake },
  closed: { tone: "neutral", icon: CircleCheckBig },
  archived: { tone: "neutral", icon: Archive },
  expired: { tone: "danger", icon: CalendarX },
  withdrawn: { tone: "neutral", icon: CircleSlash },
  suspended: { tone: "warning", icon: PauseCircle },
  verification_failed: { tone: "danger", icon: ShieldX },
  disputed: { tone: "danger", icon: Scale },
};

/** Business status of the offer — shown apart from freshness and source (§36.4). */
export function ListingStatusBadge({ locale, status }: { locale: Locale; status: ListingStatus }) {
  const { tone, icon } = statusStyle[status];
  return (
    <Badge tone={tone} icon={icon}>
      {domain[locale].listingStatus[status]}
    </Badge>
  );
}

export function PriceChangeBadge({ locale, change }: { locale: Locale; change: PriceChange }) {
  const t = properties[locale].list.card;
  const down = change.direction === "down";
  return (
    <Badge
      tone={down ? "success" : "neutral"}
      icon={down ? TrendingDown : TrendingUp}
      title={format(t.priceWas, { amount: formatMoney(locale, change.previous) })}
    >
      {down ? t.priceDropped : t.priceRaised}
    </Badge>
  );
}

const accessIcon: Record<ListingAccess, LucideIcon> = {
  owner: UserRound,
  agency: Building2,
  partner_shared: Eye,
  partner_masked: Lock,
};

/** How much of the listing the viewer may see (§16.3, §18.2). */
export function AccessBadge({ locale, access }: { locale: Locale; access: ListingAccess }) {
  return (
    <Badge tone={access === "owner" ? "brand" : "neutral"} icon={accessIcon[access]}>
      {properties[locale].list.access[access]}
    </Badge>
  );
}

/**
 * Compact verification summary for cards: counts of confirmed facts out of
 * all checks, plus any problem by name. It never reads as a blanket
 * "verified" (§16.4, §38.2); the profile lists each fact separately.
 */
export function VerificationSummaryBadges({ locale, items }: { locale: Locale; items: readonly VerificationItem[] }) {
  const t = properties[locale].list.verification;
  const d = domain[locale];
  const summary = verificationSummary(items);
  if (summary.total === 0) {
    return (
      <Badge tone="neutral" icon={ShieldQuestion}>
        {t.none}
      </Badge>
    );
  }
  const facts = items.map((item) => `${d.verificationSubject[item.subject]}: ${d.verificationStatus[item.status]}`).join("; ");
  return (
    <>
      {summary.problems.length > 0 ? (
        <Badge tone="danger" icon={ShieldAlert}>
          {format(t.problem, { subject: summary.problems.map((subject) => d.verificationSubject[subject]).join(", ") })}
        </Badge>
      ) : null}
      <Badge tone={summary.confirmed > 0 ? "success" : "neutral"} icon={ShieldCheck} title={facts}>
        {format(t.confirmed, { n: summary.confirmed, total: summary.total })}
      </Badge>
      {summary.pending > 0 ? (
        <Badge tone="info" icon={Clock}>
          {format(t.pending, { n: summary.pending })}
        </Badge>
      ) : null}
      {summary.unavailable > 0 ? (
        <Badge tone="neutral" icon={ShieldQuestion}>
          {format(t.unavailable, { n: summary.unavailable })}
        </Badge>
      ) : null}
    </>
  );
}

/** Rooms / area / floor; a missing relevant value reads as Unknown, not as blank. */
export function AttributeChips({ locale, facts, className }: { locale: Locale; facts: PhysicalFacts; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {attributeChips(locale, facts).map((chip) => (
        <li key={chip.key}>
          <Chip className={chip.unknown ? "italic" : undefined}>{chip.text}</Chip>
        </li>
      ))}
    </ul>
  );
}

/**
 * Neutral stand-in for photos: no external images are loaded in the demo.
 * The count still tells the agent whether the listing has media at all.
 */
export function PhotoPlaceholder({
  locale,
  count,
  className,
}: {
  locale: Locale;
  count: number;
  className?: string;
}) {
  const t = properties[locale].list.card;
  const label = count > 0 ? format(t.photos, { n: count }) : t.noPhotos;
  return (
    <div
      role="img"
      aria-label={`${t.photoPlaceholder}: ${label}`}
      className={cn(
        "flex items-end justify-between rounded-md bg-gradient-to-br from-surface-muted to-surface-sunken p-2 text-fg-muted",
        className,
      )}
    >
      <ImageIcon aria-hidden className="size-6 opacity-50" />
      <span className="inline-flex items-center gap-1 rounded-sm bg-surface/90 px-1.5 py-0.5 text-caption font-medium text-fg">
        <ImageIcon aria-hidden className="size-3.5" />
        {label}
      </span>
    </div>
  );
}

/** «Найдено 12 объектов» / «12 ta ob’yekt topildi». */
export function foundText(locale: Locale, n: number): string {
  return format(plural(locale, n, properties[locale].list.found), { n });
}
