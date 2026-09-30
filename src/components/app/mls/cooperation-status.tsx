import {
  Ban,
  CircleCheck,
  CircleX,
  Eye,
  Hourglass,
  MessagesSquare,
  PenLine,
  Send,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import type { CooperationStatus } from "@/lib/domain/types";

const statusStyle: Record<CooperationStatus, { tone: Tone; icon: LucideIcon }> = {
  draft: { tone: "neutral", icon: PenLine },
  sent: { tone: "info", icon: Send },
  viewed: { tone: "info", icon: Eye },
  negotiation: { tone: "info", icon: MessagesSquare },
  accepted: { tone: "success", icon: CircleCheck },
  declined: { tone: "neutral", icon: CircleX },
  expired: { tone: "neutral", icon: Hourglass },
  cancelled: { tone: "neutral", icon: Ban },
  disputed: { tone: "danger", icon: ShieldAlert },
};

/** Cooperation status as icon + text (§11.5); presentational, server or client. */
export function CooperationStatusBadge({ status, label }: { status: CooperationStatus; label: string }) {
  const { tone, icon } = statusStyle[status];
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}
