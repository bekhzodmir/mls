import { ShieldQuestion } from "lucide-react";
import { VerificationBadge } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDate } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import team from "@/i18n/messages/team";
import type { VerificationResult } from "@/lib/data/views";
import type { VerificationSubject } from "@/lib/domain/types";
import { badgeItem } from "./verification";

/**
 * One checked fact per row (§16.4, §38.2): the badge names the subject and
 * outcome; method and dates are spelled out next to it. The source appears
 * only when `showSource` (one's own profile); a fact that was never provided
 * is shown as "no data", not skipped and not implied.
 */
export function FactRow({
  locale,
  subject,
  fact,
  showSource,
}: {
  locale: Locale;
  subject: VerificationSubject;
  fact: VerificationResult | undefined;
  showSource: boolean;
}) {
  const t = team[locale].member;
  const d = domain[locale];
  if (!fact) {
    return (
      <li className="space-y-1 px-4 py-3">
        <Badge icon={ShieldQuestion}>{format(t.missing, { subject: d.verificationSubject[subject] })}</Badge>
        <p className="text-caption text-fg-muted">{t.missingHint}</p>
      </li>
    );
  }
  const source = showSource ? fact.source : undefined;
  return (
    <li className="space-y-1 px-4 py-3">
      <VerificationBadge locale={locale} item={badgeItem(fact)} showSource={source !== undefined} />
      <div className="space-y-0.5 text-caption text-fg-muted">
        <p>{format(t.method, { method: d.verificationMethod[fact.method] })}</p>
        {source ? <p>{format(t.source, { source })}</p> : null}
        <p>{fact.checkedAt ? format(t.checkedAt, { date: formatDate(locale, fact.checkedAt) }) : t.notChecked}</p>
        {fact.expiresAt ? <p>{format(t.expiresAt, { date: formatDate(locale, fact.expiresAt) })}</p> : null}
      </div>
    </li>
  );
}
