import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import {
  callFilterKeys,
  groupCallsByDay,
  parseCallFilter,
  toRepositoryFilter,
  type CallFilterKey,
} from "@/components/app/calls/call-list";
import { CallDays, CallFilters, CallsEmpty, callCountText } from "@/components/app/calls/call-list-view";
import calls from "@/i18n/messages/calls";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { listCalls, listOwners } from "@/lib/data/repository";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: calls[locale].meta.list };
}

/**
 * Call log (§14.7, §21.4 screen 58, §8.3 flow 1): the viewer's calls grouped
 * by Tashkent day, newest first, with today's missed calls on top. Each card
 * says who it was (or that the number is unknown), suggests records with the
 * same number without linking them, and shows recording consent, the AI
 * summary state and the next action. Filter: `?filter=missed|unknown|inbound|outbound`.
 */
export default async function CallsPage({ searchParams }: PageProps<"/[locale]/app/calls">) {
  const locale = await getLocale();
  const t = calls[locale].list;
  const active = parseCallFilter(await searchParams);
  const at = now();

  const [owners, all, ...filtered] = await Promise.all([
    listOwners(),
    listCalls(),
    ...callFilterKeys.map((key) => listCalls(toRepositoryFilter(key))),
  ]);
  // A call outlives access: an owner's number stays masked once their contact is restricted (§34.2).
  const hiddenOwnerIds = new Set(owners.filter((item) => !item.contactVisible).map((item) => item.owner.id));
  const byKey = Object.fromEntries(callFilterKeys.map((key, index) => [key, filtered[index]])) as Record<
    CallFilterKey,
    typeof all
  >;
  const shown = active ? byKey[active] : all;
  const days = groupCallsByDay(shown, at);
  const counts = {
    all: all.length,
    ...(Object.fromEntries(callFilterKeys.map((key) => [key, byKey[key].length])) as Record<CallFilterKey, number>),
  };

  return (
    <div className="space-y-4">
      <PageHeader locale={locale} title={t.title} subtitle={t.subtitle} className="mb-0" />

      <CallFilters locale={locale} active={active} counts={counts} />

      <p role="status" className="pt-1 text-body font-semibold text-fg">
        {callCountText(locale, shown.length)}
      </p>

      {days.length === 0 ? (
        <CallsEmpty locale={locale} filtered={Boolean(active)} />
      ) : (
        <CallDays locale={locale} days={days} now={at} hiddenOwnerIds={hiddenOwnerIds} />
      )}

      <p className="flex items-start gap-1.5 pt-2 text-caption text-fg-muted">
        <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
        <span>{t.permission}</span>
      </p>
    </div>
  );
}
