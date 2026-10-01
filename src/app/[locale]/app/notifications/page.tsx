import type { Metadata } from "next";
import {
  AlarmClock,
  BellRing,
  Briefcase,
  CalendarCheck,
  FileClock,
  Handshake,
  Hourglass,
  MessagesSquare,
  Settings2,
  ShieldAlert,
  Sparkles,
  TimerOff,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { FeedRow, type FeedRowData } from "@/components/app/today/feed-row";
import { entityHref, listHref } from "@/components/app/today/links";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDateTime, formatRelative } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import notifications from "@/i18n/messages/notifications";
import today from "@/i18n/messages/today";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { listNotifications } from "@/lib/data/repository";
import type { AppNotification, NotificationCategory, NotificationKind } from "@/lib/domain/types";

/** §36.5 order: needs action, clients, matches/MLS, deals, system events. */
const categories: readonly NotificationCategory[] = ["action", "clients", "matches", "deals", "system"];

function isCategory(value: unknown): value is NotificationCategory {
  return typeof value === "string" && (categories as readonly string[]).includes(value);
}

const kindIcon: Record<NotificationKind, LucideIcon> = {
  new_match: Sparkles,
  price_drop: TrendingDown,
  cooperation_request: Handshake,
  cooperation_answered: MessagesSquare,
  viewing_confirmed: CalendarCheck,
  deal_stage_changed: Briefcase,
  task_overdue: AlarmClock,
  contract_expiring: FileClock,
  listing_stale: Hourglass,
  sla_breach: TimerOff,
  security: ShieldAlert,
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: notifications[locale].meta.title };
}

function notificationRow(locale: Locale, item: AppNotification, at: Date): FeedRowData {
  const t = notifications[locale];
  return {
    id: item.id,
    href: item.related ? entityHref(locale, item.related) : undefined,
    icon: kindIcon[item.kind],
    emphasis: !item.read,
    title: (
      <>
        {item.read ? null : (
          <>
            <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full bg-primary align-middle" />
            <span className="sr-only">{t.unread}: </span>
          </>
        )}
        {domain[locale].notificationKind[item.kind]}
      </>
    ),
    lines: [
      // Context stays in the language the event was recorded in.
      item.context,
      <>
        <time dateTime={item.at} title={formatDateTime(locale, item.at)}>
          {formatRelative(locale, item.at, at)}
        </time>
        {" · "}
        {item.related ? format(t.open, { entity: today[locale].entity[item.related.kind] }) : t.noLink}
      </>,
    ],
  };
}

function CategorySection({
  locale,
  category,
  items,
  at,
}: {
  locale: Locale;
  category: NotificationCategory;
  items: AppNotification[];
  at: Date;
}) {
  const t = notifications[locale];
  const id = `notifications-${category}`;
  const unread = items.filter((item) => !item.read).length;
  return (
    <section aria-labelledby={id}>
      <Card className="overflow-hidden">
        <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-2">
          <h2 id={id} className="text-h2 text-fg">
            {domain[locale].notificationCategory[category]} <span className="tabular text-fg-muted">{items.length}</span>
          </h2>
          {unread > 0 ? <span className="text-caption text-fg-muted">{format(t.unreadCount, { n: unread })}</span> : null}
        </header>
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className={item.read ? undefined : "bg-primary-soft/25"}>
              <FeedRow row={notificationRow(locale, item, at)} />
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

/** Notification centre (§36.5): grouped by meaning, unread marked by a dot and text, filter in the URL. */
export default async function NotificationsPage({ searchParams }: PageProps<"/[locale]/app/notifications">) {
  const locale = await getLocale();
  const t = notifications[locale];
  const d = domain[locale];
  const { category: rawCategory } = await searchParams;
  const category = isCategory(rawCategory) ? rawCategory : undefined;
  const at = now();

  const all = await listNotifications();
  const unread = all.filter((item) => !item.read).length;
  const visible = category ? all.filter((item) => item.category === category) : all;
  const groups = categories
    .filter((key) => !category || key === category)
    .map((key) => ({ key, items: visible.filter((item) => item.category === key) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        locale={locale}
        title={t.title}
        subtitle={unread > 0 ? format(t.unreadCount, { n: unread }) : t.allRead}
        className="mb-0"
        actions={
          <Link
            href={`${listHref(locale, "/more")}#notification-settings`}
            className="inline-flex h-11 items-center gap-2 rounded-md px-3 text-small font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
          >
            <Settings2 aria-hidden className="size-4" />
            {t.settings}
          </Link>
        }
      />

      <nav aria-label={t.filter.label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          <li>
            <ChipLink href={listHref(locale, "/notifications")} active={!category}>
              {t.filter.all} <span className="tabular">{all.length}</span>
            </ChipLink>
          </li>
          {categories.map((key) => (
            <li key={key}>
              <ChipLink href={listHref(locale, "/notifications", { category: key })} active={category === key}>
                {d.notificationCategory[key]}{" "}
                <span className="tabular">{all.filter((item) => item.category === key).length}</span>
              </ChipLink>
            </li>
          ))}
        </ul>
      </nav>

      {groups.length > 0 ? (
        groups.map((group) => (
          <CategorySection key={group.key} locale={locale} category={group.key} items={group.items} at={at} />
        ))
      ) : category ? (
        <EmptyState
          icon={BellRing}
          title={format(t.empty.categoryTitle, { category: d.notificationCategory[category] })}
          description={t.empty.categoryText}
          action={
            <ChipLink href={listHref(locale, "/notifications")}>{t.empty.reset}</ChipLink>
          }
        />
      ) : (
        <EmptyState icon={BellRing} title={t.empty.title} description={t.empty.text} />
      )}

      {/* Security events are mandatory (§36.5): say so wherever system events are in view. */}
      {!category || category === "system" ? (
        <Notice kind="info" title={t.security.title}>
          {t.security.text}
        </Notice>
      ) : null}
    </div>
  );
}
