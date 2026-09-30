import { House, SearchX } from "lucide-react";
import { DemoButton } from "@/components/site/cta";
import { Container, Glow } from "@/components/site/primitives";
import { sitePath } from "@/components/site/site-config";
import { SiteChrome } from "@/components/site/site-chrome";
import { ButtonLink } from "@/components/ui/button";
import site from "@/i18n/messages/site";
import { getLocale } from "@/i18n/server";
import { publicContacts } from "@/lib/site";

/**
 * Localized 404 for anything under /{locale} that does not exist. It renders
 * inside the root layout but outside the `(site)` group, so it brings the
 * site chrome itself. `not-found` cannot export metadata, so the title is
 * rendered directly (React hoists it into <head>); Next adds `noindex`.
 */
export default async function NotFound() {
  const locale = await getLocale();
  const t = site[locale].notFound;

  return (
    <SiteChrome locale={locale}>
      <title>{`${t.title} · ${publicContacts.brand}`}</title>
      <section aria-labelledby="not-found-title" className="relative isolate overflow-hidden">
        <Glow />
        <Container className="flex flex-col items-center py-20 text-center sm:py-28">
          <span
            aria-hidden
            className="flex size-16 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg"
          >
            <SearchX className="size-8" />
          </span>
          <p className="mt-6 text-small font-semibold text-primary-soft-fg">{t.code}</p>
          <h1 id="not-found-title" className="mt-2 text-display text-balance text-fg">
            {t.title}
          </h1>
          <p className="mt-4 max-w-md text-body text-pretty text-fg-muted">{t.text}</p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href={sitePath(locale, "home")} size="lg">
              <House aria-hidden className="size-4.5" />
              {t.home}
            </ButtonLink>
            <DemoButton locale={locale} />
          </div>
          <p className="mt-4 max-w-md text-caption text-fg-subtle">{t.demoHint}</p>
        </Container>
      </section>
    </SiteChrome>
  );
}
