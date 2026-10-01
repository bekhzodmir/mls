import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import today from "@/i18n/messages/today";
import type { TodayFeed } from "@/lib/data/views";

/**
 * Today states the demo data never reaches (§22.1): a quiet day shows a
 * positive empty state; a viewer without clients gets the onboarding list.
 */

vi.mock("@/i18n/server", () => ({ getLocale: async () => "ru" }));

function quiet(feed: TodayFeed): TodayFeed {
  return {
    ...feed,
    overdueTasks: [],
    todayTasks: [],
    todayViewings: [],
    slaLeads: [],
    newMatches: [],
    incomingCooperation: [],
    expiringContracts: [],
    staleListings: [],
    priceDrops: [],
    dealsNeedingAttention: [],
    missedCalls: [],
  };
}

async function renderToday(options: { noClients: boolean }): Promise<string> {
  vi.resetModules();
  vi.doMock("@/lib/data/repository", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/data/repository")>();
    return {
      ...actual,
      getTodayFeed: async () => quiet(await actual.getTodayFeed()),
      listClients: async () => (options.noClients ? [] : actual.listClients()),
    };
  });
  const page = (await import("@/app/[locale]/app/(today)/page")).default as () => Promise<ReactElement>;
  return renderToStaticMarkup(await page());
}

afterEach(() => {
  vi.doUnmock("@/lib/data/repository");
});

describe("Today states", () => {
  it("shows a positive empty state when nothing is urgent", async () => {
    const html = await renderToday({ noClients: false });
    expect(html).toContain(today.ru.empty.title);
    expect(html).not.toContain(today.ru.onboarding.title);
    expect(html).not.toContain(today.ru.nextStep.title);
  });

  it("shows the onboarding checklist to a viewer without clients", async () => {
    const html = await renderToday({ noClients: true });
    expect(html).toContain(today.ru.onboarding.title);
    expect(html).not.toContain(today.ru.empty.title);
    // The demo viewer is certified and has listings, requirements and an enabled channel.
    expect(html).toContain(today.ru.onboarding.done);
    expect(html).toContain(`href="/ru/app/clients/new"`);
  });
});
