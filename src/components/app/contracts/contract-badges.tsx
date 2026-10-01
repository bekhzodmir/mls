import {
  CalendarX,
  CircleCheck,
  FileCheck2,
  FilePen,
  FileSignature,
  FileX,
  Handshake,
  KeyRound,
  Timer,
  TriangleAlert,
  UserSearch,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import contracts from "@/i18n/messages/contracts";
import type { ContractDisplayStatus, ContractIssue } from "@/lib/domain/contracts";
import type { ContractKind } from "@/lib/domain/types";
import { daysText, statusLabel } from "./contract-text";

/**
 * Contract badges: display status (with the days left while expiring),
 * kind and the issue count. Icon plus words every time (§20.6); no hooks,
 * so they render in server and client components.
 */

const statusStyle: Record<ContractDisplayStatus, { tone: Tone; icon: LucideIcon }> = {
  draft: { tone: "neutral", icon: FilePen },
  awaiting_signature: { tone: "info", icon: FileSignature },
  active: { tone: "success", icon: FileCheck2 },
  expiring: { tone: "warning", icon: Timer },
  expired: { tone: "danger", icon: CalendarX },
  terminated: { tone: "neutral", icon: FileX },
};

/** «Действует», «Истекает через 5 дней», «Истёк», «Ждёт подписи»… */
export function ContractStatusBadge({
  locale,
  status,
  daysLeft,
}: {
  locale: Locale;
  status: ContractDisplayStatus;
  daysLeft: number;
}) {
  const { tone, icon } = statusStyle[status];
  const text = status === "expiring" ? (daysText(locale, status, daysLeft) ?? statusLabel(locale, status)) : statusLabel(locale, status);
  return (
    <Badge tone={tone} icon={icon}>
      {text}
    </Badge>
  );
}

const kindIcon: Record<ContractKind, LucideIcon> = {
  owner_service: KeyRound,
  buyer_service: UserSearch,
  cooperation: Handshake,
};

export function ContractKindBadge({ locale, kind }: { locale: Locale; kind: ContractKind }) {
  return (
    <Badge tone="neutral" icon={kindIcon[kind]}>
      {contracts[locale].kind[kind]}
    </Badge>
  );
}

/** Errors make it red, warnings alone amber; none reads «Замечаний нет». */
export function IssueCountBadge({ locale, issues }: { locale: Locale; issues: readonly ContractIssue[] }) {
  const t = contracts[locale].card;
  if (issues.length === 0) {
    return (
      <Badge tone="success" icon={CircleCheck}>
        {t.noIssues}
      </Badge>
    );
  }
  const hasError = issues.some((issue) => issue.severity === "error");
  return (
    <Badge tone={hasError ? "danger" : "warning"} icon={TriangleAlert}>
      {format(plural(locale, issues.length, t.issues), { n: issues.length })}
    </Badge>
  );
}
