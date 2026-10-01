"use client";

import { Building2, Check, FlaskConical, Info, Scale, ShieldQuestionMark } from "lucide-react";
import Link from "next/link";
import type { Dispatch } from "react";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { htmlLang, LOCALE_COOKIE, localeLabels, locales, type Locale } from "@/i18n/config";
import { compareText } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import onboarding from "@/i18n/messages/onboarding";
import { districtName } from "@/lib/domain/geo";
import { districtIds, propertyTypes, type ProfessionalStatus } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { onboardingPath } from "./auth-routes";
import { ChoiceCard, FieldError, FieldHint, TextField, ToggleChip } from "./controls";
import {
  fieldLimits,
  isDemoInviteCode,
  legalStatusOptions,
  type FieldId,
  type OnboardingAction,
  onboardingRoles,
  type OnboardingState,
  type StepErrors,
  workLanguages,
} from "./onboarding-state";
import { PhoneInput } from "./phone-input";

/**
 * Bodies of the wizard steps 1–4 (§21.4 screens 6–9). Each one renders only
 * its fields; the wizard owns the heading, the progress and Back/Next.
 */

/** Element that receives focus when a field blocks the step (first radio for groups). */
export const fieldTargetId: Record<FieldId, string> = {
  role: `onb-role-${onboardingRoles[0]}`,
  legalStatus: `onb-status-${legalStatusOptions[0]}`,
  name: "onb-name",
  phone: "onb-phone",
  telegram: "onb-telegram",
  agencyMode: "onb-agency-create",
  agencyName: "onb-agency-name",
  agencyPhone: "onb-agency-phone",
  inviteCode: "onb-invite",
};

interface StepProps {
  locale: Locale;
  state: OnboardingState;
  errors: StepErrors;
  dispatch: Dispatch<OnboardingAction>;
}

/* ------------------------------------------------------------ 1 language */

/**
 * The language lives in the URL, so choosing one navigates to the same step
 * in the other locale; the wizard state is already in sessionStorage, so the
 * step and the answers survive the switch.
 */
export function LanguageStep({ locale }: { locale: Locale }) {
  const t = onboarding[locale].language;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {locales.map((target) => {
        const active = target === locale;
        return (
          <li key={target}>
            <Link
              href={onboardingPath(target)}
              hrefLang={target}
              aria-current={active ? "true" : undefined}
              onClick={() => {
                document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=31536000; samesite=lax`;
              }}
              className={cn(
                "flex min-h-14 items-center justify-between gap-3 rounded-md border p-4 transition-colors",
                active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-muted",
              )}
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    active ? "border-primary bg-primary text-primary-fg" : "border-border-strong bg-surface",
                  )}
                >
                  {active ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span lang={htmlLang[target]} className="text-body font-semibold text-fg">
                  {localeLabels[target].long}
                </span>
              </span>
              {active ? (
                <Badge tone="brand" icon={Check}>
                  {t.current}
                </Badge>
              ) : (
                <span aria-hidden className="text-caption font-semibold text-fg-muted">
                  {localeLabels[target].short}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------- 2 work */

export function WorkStep({ locale, state, errors, dispatch }: StepProps) {
  const t = onboarding[locale].work;
  const labels = domain[locale];
  const statusLabel = (status: ProfessionalStatus) =>
    status === "unconfirmed"
      ? t.unsure
      : status === "real_estate_agent"
        ? `${labels.professionalStatus.real_estate_agent} (${t.agentQualifier})`
        : labels.professionalStatus[status];

  return (
    <div className="space-y-7">
      <fieldset className="space-y-3">
        <legend className="mb-3 text-body font-semibold text-fg">{t.roleLegend}</legend>
        <div className="grid gap-2">
          {onboardingRoles.map((role) => (
            <ChoiceCard
              key={role}
              id={`onb-role-${role}`}
              name="onb-role"
              checked={state.data.role === role}
              onSelect={() => dispatch({ type: "role", role })}
              title={labels.role[role]}
              description={t.roleText[role]}
              errorId={errors.role ? "onb-role-error" : undefined}
            />
          ))}
        </div>
        {errors.role ? <FieldError id="onb-role-error">{t.roleRequired}</FieldError> : null}
      </fieldset>

      <fieldset className="space-y-3" aria-describedby="onb-status-note">
        <legend className="mb-1 text-body font-semibold text-fg">{t.statusLegend}</legend>
        <p id="onb-status-note" className="flex items-start gap-2 text-small text-fg-muted">
          <Scale aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{t.statusNote}</span>
        </p>
        <div className="grid gap-2">
          {legalStatusOptions.map((status) => (
            <ChoiceCard
              key={status}
              id={`onb-status-${status}`}
              name="onb-status"
              checked={state.data.legalStatus === status}
              onSelect={() => dispatch({ type: "legalStatus", status })}
              title={statusLabel(status)}
              description={t.statusText[status]}
              errorId={errors.legalStatus ? "onb-status-error" : undefined}
            />
          ))}
        </div>
        {errors.legalStatus ? <FieldError id="onb-status-error">{t.statusRequired}</FieldError> : null}
      </fieldset>
    </div>
  );
}

/* ------------------------------------------------------------- 3 profile */

/** Self-declared, unchecked value marker (§16.4, §38.2). */
export function UnverifiedTag({ children }: { children: string }) {
  return (
    <Badge tone="warning" icon={ShieldQuestionMark}>
      {children}
    </Badge>
  );
}

export function ProfileStep({ locale, state, errors, dispatch }: StepProps) {
  const t = onboarding[locale];
  const p = t.profile;
  const labels = domain[locale];
  const { data } = state;
  const text = (field: keyof typeof fieldLimits) => (value: string) => dispatch({ type: "text", field, value });
  const districtsSorted = [...districtIds].sort((a, b) =>
    compareText(locale, districtName(a, locale), districtName(b, locale)),
  );

  return (
    <div className="space-y-6">
      <TextField
        id={fieldTargetId.name}
        label={p.name}
        value={data.name}
        onChange={text("name")}
        error={errors.name ? p.nameRequired : undefined}
        autoComplete="name"
        aria-required
        maxLength={fieldLimits.name}
      />

      <PhoneInput
        id={fieldTargetId.phone}
        locale={locale}
        label={p.phone}
        value={data.phone}
        onChange={text("phone")}
        submitted={state.attempted.includes("profile")}
        note={state.phoneFromLogin ? p.phoneFromLogin : undefined}
        maxLength={fieldLimits.phone}
      />

      <TextField
        id={fieldTargetId.telegram}
        label={p.telegram}
        optional={t.optional}
        value={data.telegram}
        onChange={text("telegram")}
        placeholder={p.telegramPlaceholder}
        hint={p.telegramHint}
        error={errors.telegram ? p.telegramInvalid : undefined}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={fieldLimits.telegram}
      />

      <fieldset className="space-y-2" aria-describedby="onb-districts-hint">
        <legend className="flex items-baseline gap-2 text-small font-semibold text-fg">
          {p.districts}
          <span className="text-caption font-normal text-fg-muted">{t.optional}</span>
        </legend>
        <FieldHint id="onb-districts-hint">{p.districtsHint}</FieldHint>
        <div className="flex flex-wrap gap-2">
          {districtsSorted.map((id) => (
            <ToggleChip
              key={id}
              checked={data.districts.includes(id)}
              onChange={() => dispatch({ type: "toggleDistrict", id })}
            >
              {districtName(id, locale)}
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2" aria-describedby="onb-types-hint">
        <legend className="flex items-baseline gap-2 text-small font-semibold text-fg">
          {p.specialization}
          <span className="text-caption font-normal text-fg-muted">{t.optional}</span>
        </legend>
        <FieldHint id="onb-types-hint">{p.specializationHint}</FieldHint>
        <div className="flex flex-wrap gap-2">
          {propertyTypes.map((id) => (
            <ToggleChip
              key={id}
              checked={data.propertyTypes.includes(id)}
              onChange={() => dispatch({ type: "togglePropertyType", id })}
            >
              {labels.propertyType[id]}
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="flex items-baseline gap-2 text-small font-semibold text-fg">
          {p.languages}
          <span className="text-caption font-normal text-fg-muted">{t.optional}</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {workLanguages.map((id) => (
            <ToggleChip
              key={id}
              lang={htmlLang[id]}
              checked={data.languages.includes(id)}
              onChange={() => dispatch({ type: "toggleLanguage", id })}
            >
              {localeLabels[id].long}
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <TextField
        id="onb-certificate"
        label={p.certificate}
        optional={t.optional}
        tag={<UnverifiedTag>{p.certificateTag}</UnverifiedTag>}
        value={data.certificate}
        onChange={text("certificate")}
        hint={p.certificateHint}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={fieldLimits.certificate}
      />
    </div>
  );
}

/* -------------------------------------------------------------- 4 agency */

export function AgencyStep({ locale, state, errors, dispatch }: StepProps) {
  const t = onboarding[locale];
  const a = t.agency;
  const { data } = state;
  const text = (field: keyof typeof fieldLimits) => (value: string) => dispatch({ type: "text", field, value });
  const inviteFound = data.agencyMode === "join" && isDemoInviteCode(data.inviteCode);

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-3 text-body font-semibold text-fg">{a.modeLegend}</legend>
        <div className="grid gap-2">
          <ChoiceCard
            id="onb-agency-create"
            name="onb-agency-mode"
            checked={data.agencyMode === "create"}
            onSelect={() => dispatch({ type: "agencyMode", mode: "create" })}
            title={a.create}
            description={a.createText}
            errorId={errors.agencyMode ? "onb-agency-mode-error" : undefined}
          />
          <ChoiceCard
            id="onb-agency-join"
            name="onb-agency-mode"
            checked={data.agencyMode === "join"}
            onSelect={() => dispatch({ type: "agencyMode", mode: "join" })}
            title={a.join}
            description={a.joinText}
            errorId={errors.agencyMode ? "onb-agency-mode-error" : undefined}
          />
        </div>
        {errors.agencyMode ? <FieldError id="onb-agency-mode-error">{a.modeRequired}</FieldError> : null}
      </fieldset>

      {data.agencyMode === "create" ? (
        <div className="space-y-5">
          <TextField
            id={fieldTargetId.agencyName}
            label={a.name}
            value={data.agencyName}
            onChange={text("agencyName")}
            error={errors.agencyName ? a.nameRequired : undefined}
            autoComplete="organization"
            aria-required
            maxLength={fieldLimits.agencyName}
          />
          <PhoneInput
            id={fieldTargetId.agencyPhone}
            locale={locale}
            label={a.phone}
            value={data.agencyPhone}
            onChange={text("agencyPhone")}
            submitted={state.attempted.includes("agency")}
            required={false}
            optionalLabel={t.optional}
            maxLength={fieldLimits.agencyPhone}
          />
          <TextField
            id="onb-agency-branch"
            label={a.branch}
            optional={t.optional}
            value={data.agencyBranch}
            onChange={text("agencyBranch")}
            placeholder={a.branchPlaceholder}
            autoComplete="off"
            maxLength={fieldLimits.agencyBranch}
          />
          <Notice kind="info">
            <p>{a.registryNote}</p>
          </Notice>
        </div>
      ) : null}

      {data.agencyMode === "join" ? (
        <div className="space-y-4">
          <TextField
            id={fieldTargetId.inviteCode}
            label={a.invite}
            value={data.inviteCode}
            onChange={text("inviteCode")}
            hint={a.inviteHint}
            error={
              errors.inviteCode === "required"
                ? a.inviteRequired
                : errors.inviteCode === "tooShort"
                  ? a.inviteShort
                  : undefined
            }
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-required
            maxLength={fieldLimits.inviteCode}
          />
          <div aria-live="polite">
            {inviteFound ? (
              <div className="flex items-start gap-3 rounded-md border border-border bg-surface-muted p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg">
                  <Building2 aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-caption font-semibold text-fg-muted">{a.inviteFound}</p>
                  <p className="flex flex-wrap items-center gap-2 text-body font-semibold text-fg">
                    {a.demoAgency}
                    <Badge tone="warning" icon={FlaskConical}>
                      {t.demo.badge}
                    </Badge>
                  </p>
                  <p className="flex items-start gap-1.5 text-small text-fg-muted">
                    <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    <span>{a.demoAgencyNote}</span>
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
