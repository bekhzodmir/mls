"use client";

import { CircleCheck, RefreshCw, Send } from "lucide-react";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import auth from "@/i18n/messages/auth";
import { publicContacts } from "@/lib/site";
import { onboardingPath } from "./auth-routes";
import { Spinner } from "./controls";
import { saveLoginHandoff } from "./session-store";
import {
  interpretTelegramAuthResponse,
  readTelegramInitData,
  signalTelegramReady,
  TELEGRAM_AUTH_ENDPOINT,
  TELEGRAM_WEB_APP_SCRIPT,
  type TelegramAuthOutcome,
} from "./telegram-client";

/**
 * Screen 4 "Telegram authentication" (§6.1–6.2, §39.3).
 *
 * Loads Telegram's Mini App script on this page only. Inside Telegram it
 * POSTs the signed `initData` to `/api/telegram/auth` and shows the honest
 * result: the server verifies the signature, but no session exists yet, so
 * success leads into the demo. Outside Telegram — or when the script cannot
 * load — it points to the bot instead.
 */

type Status =
  | { kind: "detecting" }
  | { kind: "outside" }
  | { kind: "checking" }
  | { kind: "network" }
  | TelegramAuthOutcome;

/** Give up waiting for a blocked or very slow script and show the bot link. */
const DETECT_TIMEOUT_MS = 6_000;

const leaveDetecting = (status: Status): Status => (status.kind === "detecting" ? { kind: "outside" } : status);

export function TelegramLogin({ locale }: { locale: Locale }) {
  const t = auth[locale].telegram;
  const [status, setStatus] = useState<Status>({ kind: "detecting" });
  const initDataRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const verify = useCallback(
    async (initData: string) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setStatus({ kind: "checking" });
      try {
        const response = await fetch(TELEGRAM_AUTH_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData, locale }),
          cache: "no-store",
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        const outcome = interpretTelegramAuthResponse(response.status, body);
        // Only the greeting is handed to onboarding; initData is never stored.
        if (outcome.kind === "success") saveLoginHandoff({ telegram: outcome.user });
        setStatus(outcome);
      } catch {
        if (!controller.signal.aborted) setStatus({ kind: "network" });
      }
    },
    [locale],
  );

  const onScriptReady = useCallback(() => {
    const initData = readTelegramInitData(window);
    if (!initData) {
      setStatus(leaveDetecting);
      return;
    }
    signalTelegramReady(window);
    // `onReady` also fires on re-mount; verify each launch only once.
    if (initDataRef.current === initData) return;
    initDataRef.current = initData;
    void verify(initData);
  }, [verify]);

  useEffect(() => {
    const timer = window.setTimeout(() => setStatus(leaveDetecting), DETECT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => requestRef.current?.abort(), []);

  const retry = () => {
    if (initDataRef.current) void verify(initDataRef.current);
  };

  const announcement =
    status.kind === "checking"
      ? t.checking
      : status.kind === "success"
        ? `${format(t.successTitle, { name: status.user.firstName })} ${t.successText}`
        : "";

  return (
    <section aria-labelledby="telegram-login-title" aria-busy={status.kind === "checking" || undefined}>
      <Script
        src={TELEGRAM_WEB_APP_SCRIPT}
        strategy="afterInteractive"
        onReady={onScriptReady}
        onError={() => setStatus(leaveDetecting)}
      />
      {/* One persistent live region; danger notices announce themselves (role="alert"). */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <TelegramPanel locale={locale} status={status} onRetry={retry} />
    </section>
  );
}

function TelegramPanel({ locale, status, onRetry }: { locale: Locale; status: Status; onRetry: () => void }) {
  const t = auth[locale].telegram;
  const bot = publicContacts.telegramBot;
  const title = (text: string) => (
    <h2 id="telegram-login-title" className="text-h2 text-fg">
      {text}
    </h2>
  );
  const fallback = <p className="text-small text-fg-muted">{t.alternatives}</p>;

  switch (status.kind) {
    case "detecting":
    case "checking":
      return (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-5 shadow-card">
          {title(t.title)}
          <p className="flex items-center gap-2 text-small text-fg-muted">
            <Spinner />
            {status.kind === "checking" ? t.checking : t.detecting}
          </p>
        </div>
      );

    case "outside":
      return (
        <div className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-card">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg">
              <Send aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 space-y-1">
              {title(t.outsideTitle)}
              <p className="text-small text-fg-muted">{format(t.outsideText, { bot })}</p>
            </div>
          </div>
          <ButtonAnchor
            href={publicContacts.telegramBotUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            className="w-full"
          >
            <Send aria-hidden className="size-4.5" />
            {format(t.openBot, { bot })}
            <span className="sr-only"> ({auth[locale].layout.newTab})</span>
          </ButtonAnchor>
        </div>
      );

    case "success":
      return (
        <div className="space-y-4 rounded-lg border border-success-border bg-success-bg p-5 text-success-fg">
          <div className="flex items-start gap-3">
            <CircleCheck aria-hidden className="mt-1 size-6 shrink-0" />
            <div className="min-w-0 space-y-1">
              <h2 id="telegram-login-title" className="text-h2">
                {format(t.successTitle, { name: status.user.firstName })}
              </h2>
              <p className="text-small">{t.successText}</p>
            </div>
          </div>
          <ButtonLink href={onboardingPath(locale)} size="lg" className="w-full">
            {t.continueDemo}
          </ButtonLink>
        </div>
      );

    case "not_configured":
      return (
        <div className="space-y-3">
          {title(t.title)}
          <Notice kind="warning" title={t.notConfiguredTitle}>
            <p>{status.message ?? t.fallbackMessage}</p>
          </Notice>
          {fallback}
        </div>
      );

    case "invalid":
      return (
        <div className="space-y-3">
          {title(t.title)}
          <Notice
            kind="danger"
            title={t.invalidTitle}
            action={
              <ButtonAnchor href={publicContacts.telegramBotUrl} variant="secondary" className="w-full sm:w-auto">
                <Send aria-hidden className="size-4" />
                {t.reopen}
              </ButtonAnchor>
            }
          >
            <p>{status.message ?? t.fallbackMessage}</p>
          </Notice>
          {fallback}
        </div>
      );

    case "rejected":
      return (
        <div className="space-y-3">
          {title(t.title)}
          <Notice kind="danger" title={t.errorTitle}>
            <p>{status.message ?? t.fallbackMessage}</p>
          </Notice>
          {fallback}
        </div>
      );

    case "network":
    case "unavailable":
      return (
        <div className="space-y-3">
          {title(t.title)}
          <Notice
            kind="danger"
            title={status.kind === "network" ? t.networkTitle : t.errorTitle}
            action={
              <Button variant="secondary" onClick={onRetry} className="w-full sm:w-auto">
                <RefreshCw aria-hidden className="size-4" />
                {t.retry}
              </Button>
            }
          >
            <p>{status.kind === "unavailable" ? (status.message ?? t.fallbackMessage) : t.networkText}</p>
          </Notice>
          {fallback}
        </div>
      );
  }
}
