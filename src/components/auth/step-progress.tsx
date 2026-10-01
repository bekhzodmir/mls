import { Check } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import onboarding from "@/i18n/messages/onboarding";
import { cn } from "@/lib/cn";
import type { StepId } from "./onboarding-state";

/**
 * "Шаг 2 из 5" plus one segment per step. The current step carries
 * `aria-current="step"`; each segment names its step and whether it is done,
 * current or ahead for screen readers. Passed steps also show a check mark,
 * so the state does not rely on colour.
 */
export function StepProgress({ locale, steps, current }: { locale: Locale; steps: readonly StepId[]; current: StepId }) {
  const t = onboarding[locale];
  const index = steps.indexOf(current);

  return (
    <div className="space-y-2">
      <p className="text-small font-semibold text-fg">
        {format(t.progress.stepOf, { current: index + 1, total: steps.length })}
        <span className="font-normal text-fg-muted"> · {t.steps[current]}</span>
      </p>
      <ol aria-label={t.progress.label} className="flex gap-1.5">
        {steps.map((step, position) => {
          const state = position < index ? "done" : position === index ? "current" : "upcoming";
          return (
            <li key={step} aria-current={state === "current" ? "step" : undefined} className="min-w-0 flex-1">
              <span
                aria-hidden
                className={cn("block h-1.5 rounded-full", state === "upcoming" ? "bg-surface-sunken" : "bg-primary")}
              />
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 hidden items-center gap-1 truncate text-caption sm:flex",
                  state === "current" ? "font-semibold text-fg" : "text-fg-muted",
                )}
              >
                {state === "done" ? <Check className="size-3.5 shrink-0" /> : null}
                <span className="truncate">{t.steps[step]}</span>
              </span>
              <span className="sr-only">
                {t.steps[step]} — {t.progress[state]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
