import Link from "next/link";
import { AtSign, MapPin, Phone, Send } from "lucide-react";
import { LocaleSwitch } from "@/components/locale-switch";
import { BinorMark } from "@/components/ui/brand-mark";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import site from "@/i18n/messages/site";
import { publicContacts } from "@/lib/site";
import { NewTabNote } from "./cta";
import { Container } from "./primitives";
import { sitePages, sitePath } from "./site-config";
import { navLabels } from "./site-header";

const footerLink =
  "inline-flex min-h-11 items-center gap-2 rounded-sm text-small text-fg-muted hover:text-fg hover:underline underline-offset-4";

/** Contacts, navigation and language, plus the professional-audience small print. */
export function SiteFooter({ locale }: { locale: Locale }) {
  const t = site[locale];
  const labels = navLabels(locale);

  return (
    <footer className="border-t border-border bg-surface">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_1fr]">
        <div className="space-y-3">
          <Link href={sitePath(locale, "home")} aria-label={t.header.home} className="inline-flex h-11 items-center">
            <BinorMark />
          </Link>
          <p className="max-w-sm text-small text-fg-muted">{t.footer.smallPrint}</p>
        </div>

        <nav aria-labelledby="footer-pages">
          <h2 id="footer-pages" className="text-small font-semibold text-fg">
            {t.footer.pagesTitle}
          </h2>
          <ul className="mt-2">
            {sitePages.map((page) => (
              <li key={page}>
                <Link href={sitePath(locale, page)} className={footerLink}>
                  {labels[page]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="footer-contacts">
          <h2 id="footer-contacts" className="text-small font-semibold text-fg">
            {t.footer.contactsTitle}
          </h2>
          <ul className="mt-2">
            <li>
              <a href={publicContacts.telegramBotUrl} target="_blank" rel="noopener noreferrer" className={footerLink}>
                <Send aria-hidden className="size-4 shrink-0" />
                <span>
                  @{publicContacts.telegramBot}
                  <span className="block text-caption text-fg-subtle">{t.footer.bot}</span>
                </span>
                <NewTabNote locale={locale} />
              </a>
            </li>
            <li>
              <a href={`tel:${publicContacts.phoneE164}`} className={footerLink}>
                <Phone aria-hidden className="size-4 shrink-0" />
                <span>
                  <span className="tabular whitespace-nowrap">{publicContacts.phoneDisplay}</span>
                  <span className="block text-caption text-fg-subtle">
                    {format(t.footer.phone, publicContacts.supportHours)}
                  </span>
                </span>
              </a>
            </li>
            <li>
              <a href={publicContacts.instagramUrl} target="_blank" rel="noopener noreferrer" className={footerLink}>
                <AtSign aria-hidden className="size-4 shrink-0" />
                <span>
                  @{publicContacts.instagram}
                  <span className="block text-caption text-fg-subtle">{t.footer.instagram}</span>
                </span>
                <NewTabNote locale={locale} />
              </a>
            </li>
            <li className="flex min-h-11 items-center gap-2 text-small text-fg-muted">
              <MapPin aria-hidden className="size-4 shrink-0" />
              {t.footer.region}
            </li>
          </ul>
        </section>

        <section aria-labelledby="footer-language">
          <h2 id="footer-language" className="text-small font-semibold text-fg">
            {t.footer.languageTitle}
          </h2>
          <LocaleSwitch locale={locale} label={t.footer.languageLabel} className="mt-3 w-fit" />
        </section>
      </Container>

      <div className="border-t border-border">
        <Container className="flex flex-col gap-1 py-5 text-caption text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>{t.footer.copyright}</p>
          <p>{t.tagline}</p>
        </Container>
      </div>
    </footer>
  );
}
