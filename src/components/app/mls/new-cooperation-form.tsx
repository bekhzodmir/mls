"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { CheckCheck, Eye, EyeOff, Send } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { now } from "@/lib/clock";
import { latestVersion, proposeTerms, type CooperationError } from "@/lib/domain/commission";
import type { CommissionTerms, ConfidenceBand, CooperationRequest, CooperationStatus, ID } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { DemoNote } from "../radar/card-actions";
import type { CooperationMessages, CriteriaRow, TermsLabels } from "./cooperation-labels";
import { draftFromTerms, draftReady, draftRequest, responseDeadline, type TermsDraft } from "./cooperation-model";
import { RequirementCriteria } from "./requirement-criteria";
import { TermsEditor, type TermsEditorLabels } from "./terms-editor";
import { TermsSummary } from "./terms-summary";

export interface RequirementOption {
  id: ID;
  label: string;
  /** What the partner will receive: criteria only. */
  criteria: CriteriaRow[];
  /** How the listing fits this request, from reverse matching; undefined = no match. */
  fit?: { band: ConfidenceBand; bandLabel: string; summary: string };
}

export interface DeadlineOption {
  hours: number;
  label: string;
  /** "Ответ до 1 окт., 11:00", formatted on the server. */
  until: string;
}

type Role = "buyer" | "referral";

const bandTone: Record<ConfidenceBand, Tone> = {
  excellent: "success",
  good: "brand",
  possible: "neutral",
  hidden: "neutral",
};

/**
 * New cooperation request (§7.4, §15.3, §35.6 steps 1–5): the initiator picks
 * their role and the buyer request, sets the terms — visible to the partner
 * before any client data (§7.4) — and a response deadline, and sees exactly
 * what the partner will and will not receive (§16.3). Sending is a demo: the
 * request is built with `proposeTerms` locally and is not transmitted.
 */
export function NewCooperationForm({
  locale,
  viewerId,
  listingId,
  toAgentId,
  initialTerms,
  requirements,
  initialRequirementId,
  deadlines,
  labels,
  links,
}: {
  locale: Locale;
  viewerId: ID;
  listingId: ID;
  toAgentId: ID;
  initialTerms: CommissionTerms;
  requirements: RequirementOption[];
  initialRequirementId: string;
  deadlines: DeadlineOption[];
  labels: {
    c: CooperationMessages;
    editor: TermsEditorLabels;
    terms: TermsLabels;
    status: Record<CooperationStatus, string>;
    mustHave: string;
  };
  links: { list: string; mls: string };
}) {
  const t = labels.c.new;
  const baseId = useId();
  const formId = `${baseId}-form`;
  const [requirementId, setRequirementId] = useState(initialRequirementId);
  const [role, setRole] = useState<Role>("buyer");
  const [draft, setDraft] = useState<TermsDraft>(() => draftFromTerms(initialTerms));
  const [hours, setHours] = useState<number>(deadlines[0]?.hours ?? 24);
  const [sent, setSent] = useState<CooperationRequest | null>(null);
  const [error, setError] = useState<CooperationError | null>(null);

  const requirement = requirements.find((option) => option.id === requirementId);
  const deadline = deadlines.find((option) => option.hours === hours);
  const ready = draftReady(draft);

  function send() {
    const at = now();
    const request = draftRequest({
      id: `draft-${listingId}`,
      listingId,
      requirementId: requirement?.id,
      fromAgentId: viewerId,
      toAgentId,
      respondBy: responseDeadline(at, hours),
      createdAt: at.toISOString(),
    });
    const roleLine = format(t.roleLine, { role: role === "buyer" ? t.roleBuyer : t.roleReferral });
    const note = [roleLine, draft.note.trim()].filter(Boolean).join(" ");
    const result = proposeTerms(request, draft.terms, viewerId, at.toISOString(), note);
    if (result.ok) {
      setSent(result.value);
      setError(null);
    } else {
      setError(result.error);
    }
  }

  if (sent) {
    const version = latestVersion(sent);
    return (
      <section aria-labelledby={`${baseId}-sent`} className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <h2 id={`${baseId}-sent`} className="sr-only">
          {t.send}
        </h2>
        <p role="status" className="flex items-start gap-2 text-body text-fg">
          <CheckCheck aria-hidden className="mt-1 size-5 shrink-0 text-success-fg" />
          {format(t.sent, { n: version?.version ?? 1, status: labels.status[sent.status] })}
        </p>
        <DemoNote text={labels.c.actions.demo} />
        {version ? (
          <>
            <TermsSummary locale={locale} terms={version.terms} labels={labels.terms} viewerSide="buyer" />
            {version.note ? (
              <p className="text-small text-fg">
                <span className="text-fg-muted">{labels.c.terms.note}: </span>
                {version.note}
              </p>
            ) : null}
          </>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSent(null)}>
            {t.sentAgain}
          </Button>
          <Link
            href={links.list}
            className="inline-flex h-11 items-center rounded-md px-4 text-small font-semibold text-fg hover:bg-surface-muted"
          >
            {t.toList}
          </Link>
          <Link
            href={links.mls}
            className="inline-flex h-11 items-center rounded-md px-4 text-small font-semibold text-fg hover:bg-surface-muted"
          >
            {t.mlsBack}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      id={formId}
      className="space-y-6 pb-24 lg:pb-0"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) send();
      }}
    >
      <section aria-labelledby={`${baseId}-req`} className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 id={`${baseId}-req`} className="text-h2 text-fg">
          {t.requirement}
        </h2>
        {requirements.length === 0 ? (
          <p className="text-small text-fg-muted">{t.requirementEmpty}</p>
        ) : (
          <div className="space-y-1">
            <select
              id={`${baseId}-requirement`}
              aria-labelledby={`${baseId}-req`}
              value={requirementId}
              onChange={(event) => setRequirementId(event.target.value)}
              className="h-11 w-full rounded-md border border-border bg-surface px-3 text-small text-fg focus-visible:border-primary"
            >
              <option value="">{t.requirementNone}</option>
              {requirements.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {requirement ? (
          requirement.fit ? (
            <div className="space-y-1 rounded-md bg-surface-muted p-3">
              <p className="text-caption font-medium text-fg-muted">{t.fit}</p>
              <Badge tone={bandTone[requirement.fit.band]}>{requirement.fit.bandLabel}</Badge>
              <p className="text-small text-fg">{requirement.fit.summary}</p>
            </div>
          ) : (
            <Notice kind="warning">{t.noFit}</Notice>
          )
        ) : null}
      </section>

      <section aria-labelledby={`${baseId}-role`} className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 id={`${baseId}-role`} className="text-h2 text-fg">
          {t.role}
        </h2>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">{t.role}</legend>
          {(["buyer", "referral"] as const).map((option) => (
            <label
              key={option}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3",
                role === option ? "border-primary bg-primary-soft/40" : "border-border hover:bg-surface-muted",
              )}
            >
              <input
                type="radio"
                name={`${baseId}-role`}
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
                className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
              />
              <span>
                <span className="block text-small font-semibold text-fg">
                  {option === "buyer" ? t.roleBuyer : t.roleReferral}
                </span>
                <span className="block text-caption text-fg-muted">
                  {option === "buyer" ? t.roleBuyerHint : t.roleReferralHint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="text-caption text-fg-muted">{t.roleNote}</p>
      </section>

      <section aria-labelledby={`${baseId}-terms`} className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 id={`${baseId}-terms`} className="text-h2 text-fg">
          {t.terms}
        </h2>
        <p className="text-small text-fg-muted">{t.termsHint}</p>
        <TermsEditor
          locale={locale}
          labels={labels.editor}
          draft={draft}
          onChange={setDraft}
          viewerSide="buyer"
          idPrefix={`${baseId}-terms`}
        />
      </section>

      <section
        aria-labelledby={`${baseId}-deadline`}
        className="space-y-3 rounded-lg border border-border bg-surface p-4"
      >
        <h2 id={`${baseId}-deadline`} className="text-h2 text-fg">
          {t.deadline}
        </h2>
        <fieldset>
          <legend className="sr-only">{t.deadline}</legend>
          <div className="flex flex-wrap gap-2">
            {deadlines.map((option) => (
              <label key={option.hours}>
                <input
                  type="radio"
                  name={`${baseId}-hours`}
                  value={option.hours}
                  checked={hours === option.hours}
                  onChange={() => setHours(option.hours)}
                  className="peer sr-only"
                />
                <span className="inline-flex h-11 cursor-pointer items-center rounded-full border border-border bg-surface px-4 text-small font-medium text-fg transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:bg-surface-muted peer-checked:hover:bg-primary-hover">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {deadline ? <p className="text-small text-fg">{deadline.until}</p> : null}
      </section>

      <section
        aria-labelledby={`${baseId}-preview`}
        className="space-y-3 rounded-lg border border-border bg-surface p-4"
      >
        <h2 id={`${baseId}-preview`} className="text-h2 text-fg">
          {t.preview}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-small font-semibold text-fg">
              <Eye aria-hidden className="size-4 text-success-fg" />
              {t.previewShared}
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-small text-fg">
              <li>{t.sharedItems.you}</li>
              {requirement ? <li>{t.sharedItems.criteria}</li> : null}
              <li>{t.sharedItems.terms}</li>
              <li>{t.sharedItems.deadline}</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-small font-semibold text-fg">
              <EyeOff aria-hidden className="size-4 text-fg-muted" />
              {t.previewHidden}
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-small text-fg">
              <li>{t.hiddenItems.client}</li>
              <li>{t.hiddenItems.notes}</li>
              <li>{t.hiddenItems.documents}</li>
            </ul>
          </div>
        </div>
        {requirement ? (
          <div className="space-y-1">
            <h3 className="text-small font-semibold text-fg">{t.criteriaTitle}</h3>
            <RequirementCriteria rows={requirement.criteria} mustHaveLabel={labels.mustHave} />
          </div>
        ) : null}
      </section>

      {error ? <Notice kind="danger">{labels.c.error[error]}</Notice> : null}

      <div data-sticky-actions className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 py-2 px-4 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <Button type="submit" size="lg" disabled={!ready} className="w-full lg:w-auto">
          <Send aria-hidden className="size-4" />
          {t.send}
        </Button>
      </div>
    </form>
  );
}
