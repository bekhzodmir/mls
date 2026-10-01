"use client";

import { ArrowLeft, ArrowRight, FlaskConical } from "lucide-react";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import onboarding from "@/i18n/messages/onboarding";
import {
  applyLoginHandoff,
  firstErrorField,
  initialOnboardingState,
  onboardingReducer,
  type OnboardingState,
  parseOnboardingState,
  serializeOnboardingState,
  type StepId,
  validateStep,
  visibleErrors,
  visibleSteps,
} from "./onboarding-state";
import { AgencyStep, fieldTargetId, LanguageStep, ProfileStep, WorkStep } from "./onboarding-steps";
import { OnboardingSummary } from "./onboarding-summary";
import {
  isStoreWritable,
  loadLoginHandoff,
  LOGIN_HANDOFF_STORAGE_KEY,
  ONBOARDING_STORAGE_KEY,
  readStored,
  removeStored,
  writeStored,
} from "./session-store";
import { StepProgress } from "./step-progress";

/**
 * Onboarding wizard (§21.4 screens 5–9, §5, §20.3, §38.2). A clearly marked
 * demo: answers live in client state and this tab's sessionStorage, so a
 * reload keeps the progress, and nothing is sent to a server.
 */

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function OnboardingWizard({ locale }: { locale: Locale }) {
  // The server and the hydration pass render the first step; sessionStorage
  // exists only in the browser, so the wizard then remounts with what this
  // tab stored. No effect has to copy storage into state.
  const hydrated = useHydrated();
  return <Wizard key={hydrated ? "restored" : "initial"} locale={locale} restore={hydrated} />;
}

function restoreState(locale: Locale): OnboardingState {
  const stored = parseOnboardingState(readStored(ONBOARDING_STORAGE_KEY), locale) ?? initialOnboardingState(locale);
  return applyLoginHandoff(stored, loadLoginHandoff());
}

function Wizard({ locale, restore }: { locale: Locale; restore: boolean }) {
  const t = onboarding[locale];
  const [state, dispatch] = useReducer(onboardingReducer, { locale, restore }, (init) =>
    init.restore ? restoreState(init.locale) : initialOnboardingState(init.locale),
  );
  const [storageWritable] = useState(() => !restore || isStoreWritable());
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!restore) return;
    writeStored(ONBOARDING_STORAGE_KEY, serializeOnboardingState(state));
    // The hand-over is merged into the wizard now; keep only one copy.
    removeStored(LOGIN_HANDOFF_STORAGE_KEY);
  }, [state, restore]);

  const steps = visibleSteps(state.data.role);
  const errors = visibleErrors(state);

  /** Renders the result synchronously so focus lands on what is now on screen. */
  function move(action: Parameters<typeof dispatch>[0], focusField?: keyof typeof fieldTargetId) {
    flushSync(() => dispatch(action));
    if (focusField) document.getElementById(fieldTargetId[focusField])?.focus();
    else headingRef.current?.focus();
  }

  function goNext() {
    // Focus the first field that blocks the step, or the next step's heading.
    move({ type: "next" }, firstErrorField(validateStep(state.step, state.data)));
  }

  const editStep = (step: StepId) => move({ type: "goTo", step });

  const demoLine = (
    <p className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
      <Badge tone="warning" icon={FlaskConical}>
        {t.demo.badge}
      </Badge>
      <span>{t.demo.text}</span>
    </p>
  );

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-caption font-semibold tracking-wide text-primary-soft-fg uppercase">{t.eyebrow}</p>
        <StepProgress locale={locale} steps={steps} current={state.step} />
      </div>
      {demoLine}
      {storageWritable ? null : <Notice kind="warning">{t.demo.storageUnavailable}</Notice>}

      {state.step === "done" ? (
        <OnboardingSummary locale={locale} data={state.data} headingRef={headingRef} onEdit={editStep} />
      ) : (
        <form
          noValidate
          aria-labelledby="onb-step-title"
          onSubmit={(event) => {
            event.preventDefault();
            goNext();
          }}
          className="space-y-6"
        >
          <header className="space-y-1">
            <h1 id="onb-step-title" ref={headingRef} tabIndex={-1} className="text-h1 text-fg focus:outline-none">
              {t[state.step].title}
            </h1>
            <p className="text-small text-fg-muted">{t[state.step].text}</p>
          </header>

          <StepBody locale={locale} state={state} errors={errors} dispatch={dispatch} />

          {/* Sticky in the thumb zone on phones (§20.2); inline on larger screens. */}
          <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-border bg-bg/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            {steps.indexOf(state.step) > 0 ? (
              <Button variant="secondary" size="lg" onClick={() => move({ type: "back" })}>
                <ArrowLeft aria-hidden className="size-4.5" />
                {t.nav.back}
              </Button>
            ) : null}
            <Button type="submit" size="lg" className="flex-1">
              {state.reviewing ? t.nav.toSummary : t.nav.next}
              <ArrowRight aria-hidden className="size-4.5" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function StepBody(props: Parameters<typeof WorkStep>[0]) {
  switch (props.state.step) {
    case "language":
      return <LanguageStep locale={props.locale} />;
    case "work":
      return <WorkStep {...props} />;
    case "profile":
      return <ProfileStep {...props} />;
    case "agency":
      return <AgencyStep {...props} />;
    case "done":
      return null;
  }
}
