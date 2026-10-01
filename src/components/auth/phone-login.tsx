"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import auth from "@/i18n/messages/auth";
import { formatUzPhone } from "@/lib/domain/phone";
import { cn } from "@/lib/cn";
import { onboardingPath } from "./auth-routes";
import { describedBy, FieldError, FieldHint, FieldLabel, inputClasses, Spinner } from "./controls";
import {
  formatCountdown,
  isDemoCodeAccepted,
  OTP_LENGTH,
  otpProblem,
  sanitizeOtp,
  secondsUntilResend,
} from "./otp";
import { PhoneInput } from "./phone-input";
import { phoneInputState } from "./phone-step";
import { saveLoginHandoff } from "./session-store";

/**
 * Screens 2 "Login" and 3 "OTP" (§21.4): phone with +998 normalization, then
 * a six-digit code. SMS is NOT connected in this build — the screen says so,
 * no code is sent or stored and any six digits pass. On success the number is
 * handed to onboarding (tab-scoped storage) so it is not typed twice (§20.4).
 */

type Step = "phone" | "otp" | "accepted";

export function PhoneLogin({ locale }: { locale: Locale }) {
  const t = auth[locale];
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [phoneSubmitted, setPhoneSubmitted] = useState(false);
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeSubmitted, setCodeSubmitted] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(0);
  const [resent, setResent] = useState(false);

  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const focusAfterStep = useRef<"phone" | "code" | null>(null);

  // Move focus to the field of the step that just opened.
  useEffect(() => {
    const target = focusAfterStep.current;
    focusAfterStep.current = null;
    if (target === "code") codeRef.current?.focus();
    if (target === "phone") phoneRef.current?.focus();
  }, [step]);

  const secondsLeft = step === "otp" ? secondsUntilResend(sentAt, now) : 0;
  const ticking = secondsLeft > 0;
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  function startCountdown() {
    const at = Date.now();
    setSentAt(at);
    setNow(at);
  }

  function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhoneSubmitted(true);
    const status = phoneInputState(phone);
    if (status.state !== "valid") {
      phoneRef.current?.focus();
      return;
    }
    setE164(status.e164);
    setCode("");
    setCodeSubmitted(false);
    setResent(false);
    startCountdown();
    focusAfterStep.current = "code";
    setStep("otp");
  }

  function changePhone() {
    focusAfterStep.current = "phone";
    setStep("phone");
  }

  function resend() {
    // Demo: nothing is sent; the timer restarts so the flow feels like the real one.
    startCountdown();
    setResent(true);
    codeRef.current?.focus();
  }

  function pasteCode(event: ClipboardEvent<HTMLInputElement>) {
    // A pasted code replaces what was typed: "Код: 123 456" → "123456".
    const digits = sanitizeOtp(event.clipboardData.getData("text"));
    if (!digits) return;
    event.preventDefault();
    setCode(digits);
  }

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeSubmitted(true);
    if (!e164 || !isDemoCodeAccepted(code)) {
      codeRef.current?.focus();
      return;
    }
    saveLoginHandoff({ phone: e164 });
    setStep("accepted");
    router.push(onboardingPath(locale));
  }

  if (step === "phone") {
    return (
      <section aria-labelledby="phone-login-title" className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-card">
        <h2 id="phone-login-title" className="text-h2 text-fg">
          {t.phone.title}
        </h2>
        <Notice kind="warning" title={t.phone.demoTitle}>
          <p>{t.phone.demoText}</p>
        </Notice>
        <form noValidate onSubmit={submitPhone} className="space-y-4">
          <PhoneInput
            id="login-phone"
            locale={locale}
            label={t.phone.label}
            value={phone}
            onChange={setPhone}
            submitted={phoneSubmitted}
            inputRef={phoneRef}
            maxLength={32}
          />
          <Button type="submit" size="lg" className="w-full">
            {t.phone.getCode}
          </Button>
        </form>
      </section>
    );
  }

  const shownPhone = e164 ? formatUzPhone(e164) : "";
  const problem = codeSubmitted ? otpProblem(code) : null;
  const hintId = "login-otp-hint";
  const errorId = problem ? "login-otp-error" : undefined;

  return (
    <section aria-labelledby="otp-title" className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="space-y-1">
        <h2 id="otp-title" className="text-h2 text-fg">
          {t.otp.title}
        </h2>
        <Button variant="ghost" onClick={changePhone} className="-ml-3" disabled={step === "accepted"}>
          <ArrowLeft aria-hidden className="size-4" />
          {t.otp.changePhone}
        </Button>
      </div>
      <Notice kind="warning" title={t.phone.demoTitle}>
        <p>{format(t.otp.demoText, { phone: shownPhone })}</p>
      </Notice>

      <form noValidate onSubmit={submitCode} className="space-y-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="login-otp">{t.otp.label}</FieldLabel>
          <input
            ref={codeRef}
            id="login-otp"
            name="one-time-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            enterKeyHint="done"
            value={code}
            onChange={(event) => setCode(sanitizeOtp(event.target.value))}
            onPaste={pasteCode}
            readOnly={step === "accepted"}
            aria-required
            aria-invalid={problem ? true : undefined}
            aria-describedby={describedBy(hintId, errorId)}
            placeholder={"•".repeat(OTP_LENGTH)}
            className={cn(inputClasses, "h-14 text-center text-h2 tracking-[0.4em] tabular")}
          />
          <FieldHint id={hintId}>{t.otp.hint}</FieldHint>
          {problem ? (
            <FieldError id={errorId}>
              {problem === "empty" ? t.otp.empty : format(t.otp.incomplete, { count: code.length })}
            </FieldError>
          ) : null}
        </div>

        {step === "accepted" ? (
          <p role="status" className="flex items-center gap-2 text-small font-medium text-fg">
            <Spinner />
            {t.otp.accepted}
          </p>
        ) : (
          <Button type="submit" size="lg" className="w-full">
            {t.otp.submit}
          </Button>
        )}
      </form>

      <div className="space-y-1">
        {secondsLeft > 0 ? (
          <Button variant="ghost" disabled className="w-full tabular">
            {format(t.otp.resendIn, { time: formatCountdown(secondsLeft) })}
          </Button>
        ) : (
          <Button variant="ghost" onClick={resend} disabled={step === "accepted"} className="w-full">
            <RefreshCw aria-hidden className="size-4" />
            {t.otp.resend}
          </Button>
        )}
        <p role="status" className="text-center text-caption text-fg-muted">
          {resent ? t.otp.resent : ""}
        </p>
      </div>
    </section>
  );
}
