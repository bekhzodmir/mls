import {
  Building2,
  CalendarX,
  CircleSlash,
  FilePen,
  FileSignature,
  Hourglass,
  Lock,
  PenLine,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import owners from "@/i18n/messages/owners";
import type { ContractView, RecordScope, RightHolderView } from "@/lib/data/views";
import type { ContractStatus } from "@/lib/domain/types";

/** Owner-screen badges: an icon and words every time, colour only repeats them (§20.6). */

export function RightHolderBadge({ locale }: { locale: Locale }) {
  return (
    <Badge tone="info" icon={Users}>
      {owners[locale].badge.rightHolder}
    </Badge>
  );
}

export function OwnerScopeBadge({ locale, scope }: { locale: Locale; scope: RecordScope }) {
  return (
    <Badge tone={scope === "own" ? "brand" : "neutral"} icon={scope === "own" ? UserRound : Building2}>
      {owners[locale].badge[scope]}
    </Badge>
  );
}

export function RestrictedBadge({ locale }: { locale: Locale }) {
  return <Badge icon={Lock}>{owners[locale].badge.restricted}</Badge>;
}

const contractStyle: Record<ContractStatus, { tone: Tone; icon: LucideIcon }> = {
  draft: { tone: "neutral", icon: FilePen },
  awaiting_signature: { tone: "info", icon: PenLine },
  active: { tone: "success", icon: FileSignature },
  expired: { tone: "danger", icon: CalendarX },
  terminated: { tone: "neutral", icon: CircleSlash },
};

/** Stored status, with "expiring" derived from the end date (never stored, §17.5). */
export function ContractStatusBadge({ locale, view }: { locale: Locale; view: Pick<ContractView, "contract" | "expiring"> }) {
  const t = owners[locale].contracts;
  if (view.expiring) {
    return (
      <Badge tone="warning" icon={Hourglass}>
        {t.expiring}
      </Badge>
    );
  }
  const { tone, icon } = contractStyle[view.contract.status];
  return (
    <Badge tone={tone} icon={icon}>
      {t.status[view.contract.status]}
    </Badge>
  );
}

/** A right holder's consent on one contract (art. 37): each holder separately. */
export function HolderConsentBadge({ locale, status }: { locale: Locale; status: RightHolderView["status"] }) {
  const t = owners[locale].consents;
  return status === "confirmed" ? (
    <Badge tone="success" icon={ShieldCheck}>
      {t.holderConfirmed}
    </Badge>
  ) : (
    <Badge tone="danger" icon={ShieldAlert}>
      {t.holderMissing}
    </Badge>
  );
}
