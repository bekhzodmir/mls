import {
  Archive,
  CalendarCheck,
  CircleCheck,
  Coins,
  FileCheck,
  FileCheck2,
  FileSignature,
  FileWarning,
  HandCoins,
  KeyRound,
  MessagesSquare,
  OctagonAlert,
  ShieldCheck,
  Timer,
  UserSearch,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import deals from "@/i18n/messages/deals";
import domain from "@/i18n/messages/domain";
import type { MlsReportState } from "@/lib/domain/lifecycle";
import type { DealStage } from "@/lib/domain/types";

/**
 * Deal badges: stage, missing documents, overdue next step and the MLS
 * reporting window. Icon plus words every time (§20.6); no hooks, so they
 * render in server and client components.
 */

export const stageIcon: Record<DealStage, LucideIcon> = {
  qualification: UserSearch,
  viewing: CalendarCheck,
  offer: HandCoins,
  negotiation: MessagesSquare,
  under_contract: FileSignature,
  verification: ShieldCheck,
  closing: KeyRound,
  act: FileCheck2,
  commission: Coins,
  archived: Archive,
};

export function DealStageBadge({ locale, stage }: { locale: Locale; stage: DealStage }) {
  return (
    <Badge tone={stage === "archived" ? "neutral" : "brand"} icon={stageIcon[stage]}>
      {domain[locale].dealStage[stage]}
    </Badge>
  );
}

export function MissingDocumentsBadge({ locale, count }: { locale: Locale; count: number }) {
  const t = deals[locale].card;
  return count > 0 ? (
    <Badge tone="warning" icon={FileWarning}>
      {format(plural(locale, count, t.missingDocs), { n: count })}
    </Badge>
  ) : (
    <Badge tone="success" icon={FileCheck}>
      {t.docsComplete}
    </Badge>
  );
}

export function OverdueBadge({ locale }: { locale: Locale }) {
  return (
    <Badge tone="danger" icon={OctagonAlert}>
      {deals[locale].card.overdue}
    </Badge>
  );
}

const mlsStyle: Record<"due" | "overdue" | "reported", { tone: Tone; icon: LucideIcon }> = {
  due: { tone: "warning", icon: Timer },
  overdue: { tone: "danger", icon: OctagonAlert },
  reported: { tone: "success", icon: CircleCheck },
};

/** Only states that ask for attention or close the loop get a badge. */
export function MlsReportBadge({ locale, report }: { locale: Locale; report: MlsReportState }) {
  const t = deals[locale].card.mls;
  if (report.state === "not_required" || report.state === "awaiting_act") return null;
  const { tone, icon } = mlsStyle[report.state];
  const text =
    report.state === "reported"
      ? t.reported
      : report.state === "overdue"
        ? t.overdue
        : report.workingDaysLeft > 0
          ? format(t.due, { n: report.workingDaysLeft })
          : t.dueToday;
  return (
    <Badge tone={tone} icon={icon}>
      {text}
    </Badge>
  );
}
