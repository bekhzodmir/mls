import {
  AlarmClock,
  BadgeCheck,
  CircleSlash,
  FileX,
  HandCoins,
  History,
  Hourglass,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import offers from "@/i18n/messages/offers";
import { formatMoney } from "@/lib/domain/money";
import type { DealType, Money, OfferStatus, OfferVersion } from "@/lib/domain/types";
import type { PriceGap } from "./offer-list";

/**
 * Offer badges and short texts shared by the list, the detail page and its
 * negotiation island: status, whose turn it is, the response deadline and
 * the gap to the asking price. Icon plus words every time (§20.6); no
 * hooks, so they render in server and client components.
 */

const statusStyle: Record<OfferStatus, { tone: Tone; icon: LucideIcon }> = {
  open: { tone: "info", icon: HandCoins },
  countered: { tone: "info", icon: History },
  accepted: { tone: "success", icon: BadgeCheck },
  declined: { tone: "neutral", icon: FileX },
  expired: { tone: "warning", icon: Timer },
  withdrawn: { tone: "neutral", icon: CircleSlash },
};

export function OfferStatusBadge({ locale, status }: { locale: Locale; status: OfferStatus }) {
  const { tone, icon } = statusStyle[status];
  return (
    <Badge tone={tone} icon={icon}>
      {domain[locale].offerStatus[status]}
    </Badge>
  );
}

/** «Покупатель» / «Арендатор» / «Собственник» for the deal type of the listing. */
export function sideLabel(locale: Locale, dealType: DealType, side: OfferVersion["by"]): string {
  return offers[locale].side[dealType][side];
}

/** Whose answer the latest version waits for; danger with an alarm icon once the deadline passed. */
export function TurnBadge({
  locale,
  dealType,
  side,
  overdue,
}: {
  locale: Locale;
  dealType: DealType;
  side: OfferVersion["by"];
  overdue: boolean;
}) {
  const t = offers[locale].turn;
  return (
    <Badge tone={overdue ? "danger" : "info"} icon={overdue ? AlarmClock : Hourglass}>
      {format(t.awaiting, { side: sideLabel(locale, dealType, side) })}
    </Badge>
  );
}

/** «Ответ до 2 окт., 18:00» / «Срок ответа истёк …» / «Срок ответа не задан». */
export function deadlineText(locale: Locale, version: Pick<OfferVersion, "expiresAt">, overdue: boolean): string {
  const t = offers[locale].turn;
  if (!version.expiresAt) return t.noDeadline;
  return format(overdue ? t.overdue : t.until, { date: formatDateTime(locale, version.expiresAt) });
}

/** The gap to the asking price in money: «Ниже цены объекта на $7 000». */
export function gapText(locale: Locale, gap: PriceGap, asking: Money): string {
  const t = offers[locale].gap;
  switch (gap.kind) {
    case "below":
      return format(t.below, { amount: formatMoney(locale, gap.amount) });
    case "above":
      return format(t.above, { amount: formatMoney(locale, gap.amount) });
    case "equal":
      return t.equal;
    case "other_currency":
      return format(t.otherCurrency, { asking: formatMoney(locale, asking) });
  }
}
