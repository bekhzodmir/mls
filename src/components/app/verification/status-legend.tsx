import { Lock, ShieldQuestion } from "lucide-react";
import { CrmSection } from "@/components/app/crm/layout-parts";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import verification from "@/i18n/messages/verification";
import { BucketBadge, bucketStyle } from "./queue-badges";
import { QUEUE_BUCKETS, type QueueBucket } from "./queue";

/**
 * Status summary at the top of the center (§16.1): counts as text with an
 * icon, not a chart; the six buckets add up to the total.
 */
export function QueueSummary({ locale, counts }: { locale: Locale; counts: Record<QueueBucket, number> }) {
  const t = verification[locale];
  return (
    <ul aria-label={t.center.summaryLabel} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {QUEUE_BUCKETS.map((bucket) => {
        const { icon: Icon } = bucketStyle[bucket];
        return (
          <li key={bucket} className="flex items-center gap-2 rounded-md border border-border bg-surface p-3">
            <Icon aria-hidden className="size-5 shrink-0 text-fg-muted" />
            <p className="min-w-0 text-small leading-tight">
              <span className="tabular block text-h2 text-fg">{counts[bucket]}</span>
              <span className="text-fg-muted">{t.bucket[bucket]}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * What each status means (§16.4, §35.7 step 4, §38.2). The central rule is
 * spelled out: a registry that did not answer is "Не удалось проверить",
 * never "Подтверждено".
 */
export function StatusLegend({ locale, id = "legend" }: { locale: Locale; id?: string }) {
  const t = verification[locale].legend;
  return (
    <CrmSection id={id} title={t.title} description={t.rule}>
      <Card className="p-4">
        <dl className="space-y-3">
          {QUEUE_BUCKETS.map((bucket) => (
            <div key={bucket} className="space-y-1">
              <dt>
                <BucketBadge locale={locale} bucket={bucket} />
              </dt>
              <dd className="text-small text-fg">{t.statuses[bucket]}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Notice kind="info" title={t.unavailableTitle}>
        <p className="flex items-start gap-1.5">
          <ShieldQuestion aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{t.unavailableRule}</span>
        </p>
      </Notice>
      <p className="text-small text-fg-muted">{t.methods}</p>
      <p className="flex items-start gap-1.5 text-small text-fg-muted">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{t.resultOnly}</span>
      </p>
    </CrmSection>
  );
}
