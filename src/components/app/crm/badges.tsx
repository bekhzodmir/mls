import {
  AlarmClock,
  BadgeCheck,
  Briefcase,
  CalendarCheck,
  Camera,
  CheckCheck,
  CircleHelp,
  CircleSlash,
  CircleX,
  Clock,
  Globe,
  Handshake,
  Hourglass,
  Megaphone,
  MessageCircle,
  Network,
  PenLine,
  Phone,
  PhoneCall,
  SearchCheck,
  Send,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Store,
  Timer,
  UserCheck,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import clients from "@/i18n/messages/clients";
import domain from "@/i18n/messages/domain";
import { formatDate } from "@/i18n/format";
import type { ClientStatus, Consent, LeadSource, LeadStatus } from "@/lib/domain/types";
import type { SlaDisplay, SlaKind } from "./sla";

/**
 * CRM status pills. Every badge pairs an icon with text, so a state never
 * relies on colour alone (§20.6).
 */

type Style = { tone: Tone; icon: LucideIcon };

const leadStatusStyle: Record<LeadStatus, Style> = {
  new: { tone: "info", icon: Sparkles },
  assigned: { tone: "neutral", icon: UserCheck },
  contacted: { tone: "brand", icon: PhoneCall },
  qualified: { tone: "success", icon: BadgeCheck },
  converted: { tone: "success", icon: UserRoundCheck },
  lost: { tone: "neutral", icon: CircleX },
};

export function LeadStatusBadge({ locale, status }: { locale: Locale; status: LeadStatus }) {
  const { tone, icon } = leadStatusStyle[status];
  return (
    <Badge tone={tone} icon={icon}>
      {domain[locale].leadStatus[status]}
    </Badge>
  );
}

const clientStatusStyle: Record<ClientStatus, Style> = {
  new: { tone: "info", icon: Sparkles },
  contacted: { tone: "neutral", icon: PhoneCall },
  selection: { tone: "brand", icon: SearchCheck },
  viewing: { tone: "brand", icon: CalendarCheck },
  negotiation: { tone: "info", icon: Handshake },
  deal: { tone: "success", icon: Briefcase },
  deferred: { tone: "warning", icon: Hourglass },
  lost: { tone: "neutral", icon: CircleX },
};

export function ClientStatusBadge({ locale, status }: { locale: Locale; status: ClientStatus }) {
  const { tone, icon } = clientStatusStyle[status];
  return (
    <Badge tone={tone} icon={icon}>
      {domain[locale].clientStatus[status]}
    </Badge>
  );
}

export const leadSourceIcon: Record<LeadSource, LucideIcon> = {
  phone: Phone,
  telegram: Send,
  whatsapp: MessageCircle,
  instagram: Camera,
  website: Globe,
  referral: Users,
  advertising: Megaphone,
  portal: Store,
  mls: Network,
  manual: PenLine,
  unknown: CircleHelp,
};

/** Unknown is a legitimate source value (§35.3) and is shown as such, not hidden. */
export function LeadSourceBadge({ locale, source }: { locale: Locale; source: LeadSource }) {
  return (
    <Badge tone="neutral" icon={leadSourceIcon[source]}>
      {domain[locale].leadSource[source]}
    </Badge>
  );
}

const slaIcon: Record<SlaKind, LucideIcon> = {
  breached: AlarmClock,
  due_soon: Timer,
  on_track: Clock,
  responded: CheckCheck,
  responded_late: Clock,
  closed: CircleSlash,
};

export function SlaBadge({ display, label }: { display: SlaDisplay; label?: string }) {
  return (
    <Badge tone={display.tone} icon={slaIcon[display.kind]} title={label}>
      {display.text}
    </Badge>
  );
}

/** "Действует" or "Отозвано 10 сент." — a revoked consent forbids the action, it is not deleted. */
export function ConsentStateBadge({ locale, consent }: { locale: Locale; consent: Consent }) {
  const t = clients[locale].consents;
  return consent.revokedAt ? (
    <Badge tone="danger" icon={ShieldOff}>
      {format(t.revoked, { date: formatDate(locale, consent.revokedAt) })}
    </Badge>
  ) : (
    <Badge tone="success" icon={ShieldCheck}>
      {t.active}
    </Badge>
  );
}
