"use client";

import {
  ArrowRight,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FlaskConical,
  House,
  Pencil,
  Radar,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode, Ref } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { localeLabels, type Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { compareText, formatList } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import onboarding from "@/i18n/messages/onboarding";
import { districtName } from "@/lib/domain/geo";
import { formatUzPhone, normalizeUzPhone } from "@/lib/domain/phone";
import { appPath } from "@/lib/routes";
import { isAgencyRole, normalizeTelegramUsername, type OnboardingData, type StepId } from "./onboarding-state";
import { UnverifiedTag } from "./onboarding-steps";

/**
 * Step 5 "Готово": what was entered, with every self-declared fact marked
 * "не проверено" and unchecked organization facts shown as "Неизвестно"
 * (§16.4, §38.2, §41 D14); then the first steps from §30 as links into the
 * workspace and the way in.
 */

interface Row {
  label: string;
  value: ReactNode;
}

export function OnboardingSummary({
  locale,
  data,
  headingRef,
  onEdit,
}: {
  locale: Locale;
  data: OnboardingData;
  headingRef: Ref<HTMLHeadingElement>;
  onEdit: (step: StepId) => void;
}) {
  const t = onboarding[locale];
  const d = t.done;
  const labels = domain[locale];

  const missing = <span className="text-fg-muted">{d.notProvided}</span>;
  const unverified = <UnverifiedTag>{d.unverified}</UnverifiedTag>;
  const unknown = (
    <Badge tone="neutral" icon={CircleHelp}>
      {labels.unknown}
    </Badge>
  );
  const withTag = (text: string, tag: ReactNode) => (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <span>{text}</span>
      {tag}
    </span>
  );
  const list = (items: string[]) => (items.length > 0 ? formatList(locale, items) : missing);

  const status = data.legalStatus;
  const statusValue =
    !status || status === "unconfirmed"
      ? labels.professionalStatus.unconfirmed
      : withTag(
          status === "real_estate_agent"
            ? `${labels.professionalStatus.real_estate_agent} (${t.work.agentQualifier})`
            : labels.professionalStatus[status],
          unverified,
        );

  const phone = normalizeUzPhone(data.phone);
  const telegram = normalizeTelegramUsername(data.telegram);
  const agencyPhone = normalizeUzPhone(data.agencyPhone);

  const work: Row[] = [
    { label: d.fields.language, value: localeLabels[locale].long },
    { label: d.fields.role, value: data.role ? labels.role[data.role] : missing },
    { label: d.fields.status, value: statusValue },
  ];

  const profile: Row[] = [
    { label: d.fields.name, value: data.name.trim() || missing },
    // SMS is not connected: the number was never confirmed.
    { label: d.fields.phone, value: phone ? withTag(formatUzPhone(phone), unverified) : missing },
    { label: d.fields.telegram, value: telegram ? withTag(`@${telegram}`, unverified) : missing },
    {
      label: d.fields.districts,
      value: list(
        data.districts
          .map((id) => districtName(id, locale))
          .sort((a, b) => compareText(locale, a, b)),
      ),
    },
    { label: d.fields.specialization, value: list(data.propertyTypes.map((id) => labels.propertyType[id])) },
    { label: d.fields.languages, value: list(data.languages.map((id) => localeLabels[id].long)) },
    {
      label: d.fields.certificate,
      value: data.certificate.trim() ? withTag(data.certificate.trim(), unverified) : missing,
    },
  ];

  const agency: Row[] | null = !isAgencyRole(data.role)
    ? null
    : data.agencyMode === "join"
      ? [{ label: d.fields.agency, value: d.joinedDemo }]
      : [
          { label: d.fields.agency, value: data.agencyName.trim() || missing },
          { label: d.fields.agencyPhone, value: agencyPhone ? formatUzPhone(agencyPhone) : missing },
          { label: d.fields.branch, value: data.agencyBranch.trim() || missing },
          // Never inferred from the name: unchecked registry and insurance are unknown.
          { label: labels.verificationSubject.org_registry, value: unknown },
          { label: labels.verificationSubject.insurance, value: unknown },
        ];

  const sections: { step: "work" | "profile" | "agency"; rows: Row[] }[] = [
    { step: "work", rows: work },
    { step: "profile", rows: profile },
    ...(agency ? [{ step: "agency" as const, rows: agency }] : []),
  ];

  const firstSteps: { key: keyof typeof d.firstSteps; href: string; icon: LucideIcon }[] = [
    { key: "client", href: appPath(locale, "/clients/new"), icon: UserPlus },
    { key: "requirement", href: appPath(locale, "/requirements/new"), icon: ClipboardList },
    { key: "property", href: appPath(locale, "/properties/new"), icon: House },
    { key: "radar", href: appPath(locale, "/radar/import"), icon: Radar },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 ref={headingRef} tabIndex={-1} className="text-h1 text-fg focus:outline-none">
          {d.title}
        </h1>
        <p className="text-small text-fg-muted">{d.text}</p>
      </header>

      <div className="space-y-4">
        {sections.map(({ step, rows }) => (
          <SummarySection
            key={step}
            id={`onb-summary-${step}`}
            title={d.sections[step]}
            rows={rows}
            edit={d.edit}
            editLabel={format(d.editLabel, { section: d.sections[step] })}
            onEdit={() => onEdit(step)}
          />
        ))}
      </div>

      <section aria-labelledby="onb-first-steps" className="space-y-3">
        <div className="space-y-1">
          <h2 id="onb-first-steps" className="text-h2 text-fg">
            {d.firstStepsTitle}
          </h2>
          <p className="text-small text-fg-muted">{d.firstStepsText}</p>
        </div>
        <ol className="space-y-2">
          {firstSteps.map(({ key, href, icon: Icon }, index) => (
            <li key={key}>
              <Link
                href={href}
                className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-card transition-colors hover:border-border-strong hover:bg-surface-muted/40"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-fg">
                    <span className="tabular text-fg-muted">{index + 1}. </span>
                    {d.firstSteps[key].title}
                  </span>
                  <span className="block text-small text-fg-muted">{d.firstSteps[key].text}</span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-muted" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="space-y-2">
        <ButtonLink href={appPath(locale, "")} size="lg" className="w-full">
          {d.goToWorkspace}
          <ArrowRight aria-hidden className="size-4.5" />
        </ButtonLink>
        <p className="flex items-start gap-1.5 text-caption text-fg-muted">
          <FlaskConical aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>{d.workspaceNote}</span>
        </p>
      </div>
    </div>
  );
}

function SummarySection({
  id,
  title,
  rows,
  edit,
  editLabel,
  onEdit,
}: {
  id: string;
  title: string;
  rows: Row[];
  edit: string;
  editLabel: string;
  onEdit: () => void;
}) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-body font-semibold text-fg">
          {title}
        </h2>
        <Button variant="ghost" onClick={onEdit} aria-label={editLabel} className="-mr-3">
          <Pencil aria-hidden className="size-4" />
          {edit}
        </Button>
      </div>
      <dl className="mt-1 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
            <dt className="text-small text-fg-muted">{row.label}</dt>
            <dd className="min-w-0 text-right text-small font-medium break-words text-fg">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
