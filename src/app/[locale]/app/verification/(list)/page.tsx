import type { Metadata } from "next";
import { CircleHelp, FilePlus2, Search, ShieldCheck } from "lucide-react";
import { ChipCount, ChipRow } from "@/components/app/crm/layout-parts";
import { PageHeader } from "@/components/app/page-header";
import { QueueItemCard } from "@/components/app/verification/queue-item";
import {
  attentionCount,
  countBuckets,
  matchesQueueFilter,
  parseQueueFilter,
  QUEUE_BUCKETS,
  QUEUE_SUBJECTS,
  QUEUE_TARGETS,
  queueHref,
  requestHref,
} from "@/components/app/verification/queue";
import { QueueSummary, StatusLegend } from "@/components/app/verification/status-legend";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import domain from "@/i18n/messages/domain";
import verification from "@/i18n/messages/verification";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { getViewer, listAgents, listVerificationQueue } from "@/lib/data/repository";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: verification[locale].meta.center };
}

/**
 * Verification Center (§16.1, §21.4 #41): every checked fact the viewer may
 * see — the organization's listings, agents and the organization itself,
 * plus partner listings they work on (result only) — problems first, then
 * expired evidence, registry not answering, pending, expiring, confirmed.
 * Filters (`?status=&subject=&target=`) live in the URL; the summary counts
 * the whole queue so the numbers do not change while filtering.
 */
export default async function VerificationPage({ searchParams }: PageProps<"/[locale]/app/verification">) {
  const locale = await getLocale();
  const t = verification[locale];
  const d = domain[locale];
  const filter = parseQueueFilter(await searchParams);
  const at = now();

  const [queue, viewer, agents] = await Promise.all([listVerificationQueue(), getViewer(), listAgents()]);
  const performers = Object.fromEntries(agents.map((agent) => [agent.id, agent.name]));
  const counts = countBuckets(queue);
  const shown = queue.filter((entry) => matchesQueueFilter(entry, filter));
  const filtered = Boolean(filter.status || filter.subject || filter.target);
  const subjects = QUEUE_SUBJECTS.filter(
    (subject) => subject === filter.subject || queue.some((entry) => entry.item.subject === subject),
  );
  const count = (dimension: keyof typeof filter, test: (entry: (typeof queue)[number]) => boolean) =>
    queue.filter((entry) => matchesQueueFilter(entry, filter, dimension) && test(entry)).length;

  return (
    <>
      <PageHeader
        locale={locale}
        title={t.center.title}
        subtitle={format(t.center.subtitle, { total: queue.length, attention: attentionCount(counts) })}
        actions={
          <ButtonLink href={requestHref(locale)}>
            <FilePlus2 aria-hidden className="size-4" />
            {t.center.add}
          </ButtonLink>
        }
      >
        <p className="text-small text-fg-muted">{t.center.intro}</p>
      </PageHeader>

      <div className="mb-4 space-y-4">
        <QueueSummary locale={locale} counts={counts} />

        {counts.expired + counts.expiring > 0 ? (
          <Notice
            kind="warning"
            title={t.center.staleTitle}
            action={
              <div className="flex flex-wrap gap-2">
                {counts.expired > 0 ? (
                  <ButtonLink href={queueHref(locale, { status: "expired" })} variant="secondary">
                    {t.center.staleExpired}
                  </ButtonLink>
                ) : null}
                {counts.expiring > 0 ? (
                  <ButtonLink href={queueHref(locale, { status: "expiring" })} variant="secondary">
                    {t.center.staleExpiring}
                  </ButtonLink>
                ) : null}
              </div>
            }
          >
            {format(t.center.staleText, { expired: counts.expired, expiring: counts.expiring })}
          </Notice>
        ) : null}

        <ChipRow label={t.center.statusFilter}>
          <li>
            <ChipLink href={queueHref(locale, { ...filter, status: undefined })} active={!filter.status}>
              {t.center.all} <ChipCount n={count("status", () => true)} />
            </ChipLink>
          </li>
          {QUEUE_BUCKETS.map((bucket) => (
            <li key={bucket}>
              <ChipLink href={queueHref(locale, { ...filter, status: bucket })} active={filter.status === bucket}>
                {t.bucket[bucket]}{" "}
                <ChipCount n={count("status", (entry) => matchesQueueFilter(entry, { status: bucket }))} />
              </ChipLink>
            </li>
          ))}
        </ChipRow>

        <ChipRow label={t.center.subjectFilter}>
          <li>
            <ChipLink href={queueHref(locale, { ...filter, subject: undefined })} active={!filter.subject}>
              {t.center.all} <ChipCount n={count("subject", () => true)} />
            </ChipLink>
          </li>
          {subjects.map((subject) => (
            <li key={subject}>
              <ChipLink href={queueHref(locale, { ...filter, subject })} active={filter.subject === subject}>
                {d.verificationSubject[subject]}{" "}
                <ChipCount n={count("subject", (entry) => entry.item.subject === subject)} />
              </ChipLink>
            </li>
          ))}
        </ChipRow>

        <ChipRow label={t.center.targetFilter}>
          <li>
            <ChipLink href={queueHref(locale, { ...filter, target: undefined })} active={!filter.target}>
              {t.center.all} <ChipCount n={count("target", () => true)} />
            </ChipLink>
          </li>
          {QUEUE_TARGETS.map((target) => (
            <li key={target}>
              <ChipLink href={queueHref(locale, { ...filter, target })} active={filter.target === target}>
                {t.target[target]} <ChipCount n={count("target", (entry) => entry.target.kind === target)} />
              </ChipLink>
            </li>
          ))}
        </ChipRow>

        <a
          href="#legend"
          className="inline-flex min-h-11 items-center gap-1.5 text-small font-medium text-primary underline-offset-2 hover:underline"
        >
          <CircleHelp aria-hidden className="size-4" />
          {t.center.legendLink}
        </a>
      </div>

      {shown.length > 0 ? (
        <ul aria-label={t.center.listLabel} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shown.map((entry) => (
            <li key={entry.key}>
              <QueueItemCard
                locale={locale}
                entry={entry}
                at={at}
                viewerId={viewer.agent.id}
                performers={performers}
              />
            </li>
          ))}
        </ul>
      ) : queue.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t.empty.title}
          description={t.empty.text}
          action={
            <ButtonLink href={requestHref(locale)}>
              <FilePlus2 aria-hidden className="size-4" />
              {t.center.add}
            </ButtonLink>
          }
        />
      ) : (
        <EmptyState
          icon={Search}
          title={t.empty.filteredTitle}
          description={t.empty.filteredText}
          action={
            filtered ? (
              <ButtonLink href={queueHref(locale)} variant="secondary">
                {t.empty.reset}
              </ButtonLink>
            ) : undefined
          }
        />
      )}

      <div className="mt-8">
        <StatusLegend locale={locale} />
      </div>
    </>
  );
}
