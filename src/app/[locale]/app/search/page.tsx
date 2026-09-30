import type { Metadata } from "next";
import { SearchX, TextSearch } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { interpretQuery } from "@/components/app/search/query-filters";
import { SEARCH_QUERY_MAX, SearchForm } from "@/components/app/search/search-form";
import { SearchResultGroups, searchTotal } from "@/components/app/search/search-results";
import { UnderstoodPanel } from "@/components/app/search/understood-panel";
import { listHref } from "@/components/app/today/links";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import search from "@/i18n/messages/search";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { searchAll } from "@/lib/data/repository";

type SearchParams = Awaited<PageProps<"/[locale]/app/search">["searchParams"]>;

function readQuery(params: SearchParams): string {
  const raw = params.q;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().slice(0, SEARCH_QUERY_MAX);
}

/** The query stays out of the title: it may be a client's phone or name (§18.1, least exposure). */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: search[locale].meta.title };
}

function Examples({ locale }: { locale: Locale }) {
  const t = search[locale].examples;
  return (
    <section aria-labelledby="search-examples" className="space-y-2">
      <h2 id="search-examples" className="text-small font-semibold text-fg-muted">
        {t.title}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {t.items.map((example) => (
          <li key={example}>
            <ChipLink href={listHref(locale, "/search", { q: example })}>{example}</ChipLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Global smart search (§9.3, §36.4). The query is read from the URL, run
 * through the repository (access rules applied before results are returned)
 * and, in parallel, through the requirement parser so a phrase such as
 * «Чиланзар 2 комнаты до 70 000» also becomes property-list filters.
 */
export default async function SearchPage({ searchParams }: PageProps<"/[locale]/app/search">) {
  const locale = await getLocale();
  const t = search[locale];
  const q = readQuery(await searchParams);
  const results = q ? await searchAll(q) : undefined;
  const interpretation = interpretQuery(q);
  const total = results ? searchTotal(results) : 0;

  return (
    <div className="space-y-5">
      <PageHeader locale={locale} title={t.title} subtitle={t.subtitle} className="mb-0">
        <SearchForm locale={locale} defaultValue={q} />
      </PageHeader>

      {!q ? (
        <>
          <Examples locale={locale} />
          <EmptyState icon={TextSearch} title={t.empty.start} description={t.empty.startText} />
        </>
      ) : (
        <>
          {interpretation ? <UnderstoodPanel locale={locale} interpretation={interpretation} /> : null}

          <p role="status" className="text-small font-semibold text-fg">
            {format(t.results.summary, { n: total })}
          </p>

          {results && total > 0 ? (
            <SearchResultGroups locale={locale} results={results} at={now()} />
          ) : (
            <>
              {/* With recognized criteria the filters above are the way forward, not a dead end. */}
              <EmptyState
                icon={SearchX}
                title={interpretation ? t.empty.textualTitle : format(t.empty.title, { q })}
                description={interpretation ? t.empty.textualText : t.empty.text}
              />
              <Examples locale={locale} />
            </>
          )}
        </>
      )}
    </div>
  );
}
