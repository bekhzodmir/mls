import type { Metadata } from "next";
import { ArrowLeft, FlaskConical, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { authRobots } from "@/components/auth/metadata";
import { PhoneLogin } from "@/components/auth/phone-login";
import { TelegramLogin } from "@/components/auth/telegram-login";
import { sitePath } from "@/components/site/site-config";
import { ButtonLink } from "@/components/ui/button";
import auth from "@/i18n/messages/auth";
import { getLocale } from "@/i18n/server";
import { appPath } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const meta = auth[locale].meta;
  return { title: { absolute: meta.title }, description: meta.description, robots: authRobots };
}

/**
 * "Вход в Binor" — screens 2 Login, 3 OTP and 4 Telegram authentication of
 * §21.4. Telegram comes first: the bot and Mini App are the canonical entry
 * (§6.1–6.2, §41 D11). The phone + code path is a demo until SMS is connected.
 *
 * Screen 1 (Splash) is intentionally not built for the web: a browser shows
 * this page directly and a splash would only delay it, while inside Telegram
 * the client already shows its own loading screen for the Mini App.
 */
export default async function LoginPage() {
  const locale = await getLocale();
  const t = auth[locale].page;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 text-fg">{t.title}</h1>
        <p className="text-small text-fg-muted">{t.subtitle}</p>
      </header>

      <TelegramLogin locale={locale} />

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-caption font-medium text-fg-muted">{t.or}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <PhoneLogin locale={locale} />

      <nav aria-label={t.moreTitle} className="space-y-3 border-t border-border pt-5">
        <ButtonLink href={appPath(locale, "")} variant="secondary" size="lg" className="w-full">
          <LayoutDashboard aria-hidden className="size-4.5" />
          {t.demo}
        </ButtonLink>
        <p className="flex items-start gap-1.5 text-caption text-fg-muted">
          <FlaskConical aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>{t.demoNote}</span>
        </p>
        <Link
          href={sitePath(locale, "home")}
          className="inline-flex min-h-11 items-center gap-2 rounded-md text-small font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-primary"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t.backToSite}
        </Link>
      </nav>
    </div>
  );
}
