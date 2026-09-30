import {
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleCheck,
  CircleCheckBig,
  Hourglass,
  ListTodo,
  TriangleAlert,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import viewings from "@/i18n/messages/viewings";
import type { Viewing, ViewingStatus } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import type { ViewingAttention } from "./agenda";

/**
 * Viewing status, confirmations and attention flags. Each pairs an icon with
 * words, so nothing depends on colour alone (§20.6). No hooks: usable from
 * server and client components alike.
 */

const statusStyle: Record<ViewingStatus, { tone: Tone; icon: LucideIcon }> = {
  scheduled: { tone: "info", icon: CalendarClock },
  confirmed: { tone: "success", icon: CalendarCheck },
  completed: { tone: "neutral", icon: CircleCheckBig },
  cancelled: { tone: "neutral", icon: CalendarX },
  no_show: { tone: "warning", icon: UserX },
};

export function ViewingStatusBadge({ locale, status }: { locale: Locale; status: ViewingStatus }) {
  const { tone, icon } = statusStyle[status];
  return (
    <Badge tone={tone} icon={icon}>
      {domain[locale].viewingStatus[status]}
    </Badge>
  );
}

/** Confirmation labels: the owner's side is "partner" when another agent holds the listing. */
export function confirmationTexts(
  locale: Locale,
  confirmations: Viewing["confirmations"],
  hasPartner: boolean,
): { key: "client" | "other"; done: boolean; text: string }[] {
  const t = viewings[locale].confirm;
  const other = hasPartner
    ? confirmations.ownerOrPartner
      ? t.partnerYes
      : t.partnerNo
    : confirmations.ownerOrPartner
      ? t.ownerYes
      : t.ownerNo;
  return [
    { key: "client", done: confirmations.client, text: confirmations.client ? t.clientYes : t.clientNo },
    { key: "other", done: confirmations.ownerOrPartner, text: other },
  ];
}

/** "Клиент подтвердил" / "Ждём подтверждения собственника" as icon + text rows. */
export function ConfirmationList({
  locale,
  confirmations,
  hasPartner,
  className,
}: {
  locale: Locale;
  confirmations: Viewing["confirmations"];
  hasPartner: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1", className)}>
      {confirmationTexts(locale, confirmations, hasPartner).map((item) => {
        const Icon = item.done ? CircleCheck : Hourglass;
        return (
          <li key={item.key} className="flex items-center gap-1.5 text-caption text-fg-muted">
            <Icon aria-hidden className={cn("size-4 shrink-0", item.done ? "text-success-fg" : "text-warning-fg")} />
            <span className={item.done ? undefined : "font-medium text-fg"}>{item.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function AttentionBadge({ locale, attention }: { locale: Locale; attention: ViewingAttention }) {
  const t = viewings[locale].item;
  return (
    <Badge tone="warning" icon={attention === "next_step_missing" ? ListTodo : TriangleAlert}>
      {attention === "next_step_missing" ? t.needsNextStep : t.needsOutcome}
    </Badge>
  );
}
