"use client";

import Link from "next/link";
import { memo, useDeferredValue, useId, useState } from "react";
import { Building, CheckCheck, ClipboardPaste, Eraser, Link2, Radar as RadarIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { findDuplicateCandidates } from "@/lib/domain/dedup";
import { analyzeTelegramPost } from "@/lib/domain/post-parser";
import { cn } from "@/lib/cn";
import { DemoNote } from "./card-actions";
import { ConfidenceMeter } from "./confidence-meter";
import { DuplicateList, type DuplicateEntry, type DuplicateListLabels } from "./duplicate-list";
import type { CopilotPoolEntry, RadarMessages } from "./labels";
import { ParsedFieldList, type ParsedFieldListLabels } from "./parsed-field-list";
import {
  confidenceLevel,
  draftDedupRecord,
  looksLikeLink,
  parseQuality,
  parseTelegramLink,
  relevantFields,
  sameTelegramUrl,
} from "./parse-view";

/** Duplicate candidates shown at most; the strongest come first. */
const MAX_DUPLICATES = 5;

export interface KnownPost {
  url: string;
  id: string;
  source: string;
  detailHref: string;
  convertHref: string;
}

type Decision = "create" | "link" | "leave";

/**
 * Telegram Listing Copilot (§35.5): paste a post or a t.me link, see the
 * draft the parser makes — every field with confidence and evidence, Unknown
 * highlighted, never a guessed currency, floor or area — and duplicate
 * candidates with reasons; then choose to create a draft, link to an
 * existing record, or leave the post unprocessed. Parsing runs in the
 * browser; the decision is demo state and says so.
 */
export function Copilot({
  locale,
  t,
  fieldLabels,
  duplicateLabels,
  pool,
  knownPosts,
}: {
  locale: Locale;
  t: RadarMessages;
  fieldLabels: ParsedFieldListLabels;
  duplicateLabels: DuplicateListLabels;
  pool: CopilotPoolEntry[];
  knownPosts: KnownPost[];
}) {
  const c = t.copilot;
  const baseId = useId();
  const [text, setText] = useState("");
  const [decision, setDecision] = useState<Decision>("create");
  const [target, setTarget] = useState("");
  const [result, setResult] = useState("");
  const deferred = useDeferredValue(text);

  function change(next: string) {
    setText(next);
    setResult("");
  }

  const inputId = `${baseId}-text`;
  const hintId = `${baseId}-hint`;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <label htmlFor={inputId} className="text-small font-semibold text-fg">
          {c.input}
        </label>
        <textarea
          id={inputId}
          value={text}
          onChange={(event) => change(event.target.value)}
          rows={7}
          placeholder={c.placeholder}
          aria-describedby={hintId}
          className="w-full rounded-md border border-border bg-surface p-3 text-body text-fg placeholder:text-fg-subtle focus-visible:border-primary"
        />
        <p id={hintId} className="text-caption text-fg-muted">
          {c.privacy}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => change(c.sampleText)}>
            <ClipboardPaste aria-hidden className="size-4" />
            {c.sample}
          </Button>
          {text ? (
            <Button variant="ghost" onClick={() => change("")}>
              <Eraser aria-hidden className="size-4" />
              {c.clear}
            </Button>
          ) : null}
        </div>
      </section>

      <CopilotResult
        text={deferred}
        locale={locale}
        t={t}
        fieldLabels={fieldLabels}
        duplicateLabels={duplicateLabels}
        pool={pool}
        knownPosts={knownPosts}
        decision={decision}
        onDecision={setDecision}
        target={target}
        onTarget={setTarget}
        result={result}
        onResult={setResult}
      />
    </div>
  );
}

/**
 * Everything derived from the pasted text. Memoized so that, with the
 * deferred value above, typing stays responsive: parsing and duplicate
 * search re-run only when the deferred text (or a decision) changes.
 */
const CopilotResult = memo(function CopilotResult({
  text,
  locale,
  t,
  fieldLabels,
  duplicateLabels,
  pool,
  knownPosts,
  decision,
  onDecision,
  target,
  onTarget,
  result,
  onResult,
}: {
  text: string;
  locale: Locale;
  t: RadarMessages;
  fieldLabels: ParsedFieldListLabels;
  duplicateLabels: DuplicateListLabels;
  pool: CopilotPoolEntry[];
  knownPosts: KnownPost[];
  decision: Decision;
  onDecision: (decision: Decision) => void;
  target: string;
  onTarget: (id: string) => void;
  result: string;
  onResult: (message: string) => void;
}) {
  const c = t.copilot;
  const baseId = useId();
  const trimmed = text.trim();
  const isLink = looksLikeLink(trimmed);
  const link = isLink ? parseTelegramLink(trimmed) : undefined;
  const known = link ? knownPosts.find((post) => sameTelegramUrl(post.url, link.url)) : undefined;
  const analysis = trimmed && !isLink ? analyzeTelegramPost(trimmed) : undefined;

  const byId = new Map(pool.map((item) => [item.record.id, item.entry]));
  const duplicates: DuplicateEntry[] = analysis
    ? findDuplicateCandidates(
        draftDedupRecord(analysis.parsed, trimmed),
        pool.map((item) => item.record),
      )
        .slice(0, MAX_DUPLICATES)
        .flatMap((candidate) => {
          const entry = byId.get(candidate.id);
          return entry
            ? [
                {
                  ...entry,
                  signals: candidate.signals,
                  conflicts: candidate.conflicts,
                  recommendation: candidate.recommendation,
                },
              ]
            : [];
        })
    : [];

  const quality = analysis ? parseQuality(analysis.parsed) : undefined;
  const unknownCount = analysis
    ? relevantFields(analysis.parsed).filter((key) => {
        const level = confidenceLevel(analysis.parsed[key]);
        return level === "none" || level === "low";
      }).length
    : 0;

  function apply() {
    if (!analysis) return;
    if (decision === "create") onResult(c.created);
    else if (decision === "leave") onResult(c.left);
    else {
      const chosen = duplicates.find((entry) => entry.id === target);
      if (chosen) onResult(format(c.linked, { target: chosen.title }));
    }
  }

  const setDecision = (next: Decision) => {
    onDecision(next);
    onResult("");
  };
  const setTarget = onTarget;

  return (
    <div className="space-y-6">
      {!trimmed ? (
        <p className="rounded-md border border-dashed border-border-strong p-4 text-small text-fg-muted">{c.empty}</p>
      ) : isLink ? (
        known ? (
          <Notice
            kind="info"
            title={c.linkKnownTitle}
            action={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={known.detailHref}
                  className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-small font-semibold text-fg hover:bg-surface-muted"
                >
                  <RadarIcon aria-hidden className="size-4" />
                  {c.linkOpen}
                </Link>
                <Link
                  href={known.convertHref}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-small font-semibold text-primary-fg hover:bg-primary-hover"
                >
                  <Building aria-hidden className="size-4" />
                  {c.linkConvert}
                </Link>
              </div>
            }
          >
            {format(c.linkKnownText, { source: known.source })}
          </Notice>
        ) : (
          <Notice kind="warning" title={c.linkUnknownTitle}>
            {c.linkUnknownText}
          </Notice>
        )
      ) : analysis && quality ? (
        <>
          <section aria-labelledby={`${baseId}-draft`} className="space-y-3">
            <h2 id={`${baseId}-draft`} className="text-h2 text-fg">
              {c.draft}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span role="status" className="text-small text-fg">
                {t.confidence.label}: {format(t.confidence.recognized, { n: quality.recognized, total: quality.total })}
              </span>
              <ConfidenceMeter value={quality.score} level={quality.level} labels={fieldLabels.confidence} />
            </div>
            {analysis.warnings.length > 0 ? (
              <Notice kind="warning" title={t.warning.title}>
                <ul className="list-disc space-y-1 pl-4">
                  {analysis.warnings.map((warning) => (
                    <li key={warning}>{t.warning[warning]}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}
            {unknownCount > 0 ? (
              <p className="text-small font-medium text-warning-fg">
                {format(plural(locale, unknownCount, c.unknownFields), { n: unknownCount })}
              </p>
            ) : null}
            <div className="rounded-lg border border-border bg-surface px-4">
              <ParsedFieldList locale={locale} parsed={analysis.parsed} labels={fieldLabels} highlightUnknown />
            </div>
            <p className="text-caption text-fg-muted">
              {t.detail.parserVersion}: <code>{analysis.parserVersion}</code>
            </p>
          </section>

          <section aria-labelledby={`${baseId}-dup`} className="space-y-3">
            <h2 id={`${baseId}-dup`} className="text-h2 text-fg">
              {c.duplicates}
            </h2>
            <p className="text-caption text-fg-muted">{c.duplicatesHint}</p>
            {duplicates.length === 0 ? (
              <p className="rounded-md border border-dashed border-border-strong p-4 text-small text-fg-muted">
                {t.duplicates.none}
              </p>
            ) : (
              <DuplicateList locale={locale} entries={duplicates} labels={duplicateLabels} />
            )}
          </section>

          <section aria-labelledby={`${baseId}-decision`} className="space-y-3">
            <h2 id={`${baseId}-decision`} className="text-h2 text-fg">
              {c.decision}
            </h2>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                apply();
              }}
            >
              <fieldset className="space-y-2">
                <legend className="sr-only">{c.decision}</legend>
                <DecisionOption
                  name={`${baseId}-decision-choice`}
                  value="create"
                  checked={decision === "create"}
                  onChange={() => setDecision("create")}
                  icon={Sparkles}
                  title={c.create}
                  hint={c.createHint}
                />
                <DecisionOption
                  name={`${baseId}-decision-choice`}
                  value="link"
                  checked={decision === "link"}
                  onChange={() => setDecision("link")}
                  icon={Link2}
                  title={c.linkExisting}
                  hint={c.linkExistingHint}
                />
                {decision === "link" ? (
                  duplicates.length === 0 ? (
                    <p className="pl-9 text-small text-fg-muted">{c.linkNone}</p>
                  ) : (
                    <div className="space-y-1 pl-9">
                      <label htmlFor={`${baseId}-target`} className="text-caption font-medium text-fg-muted">
                        {c.linkChoose}
                      </label>
                      <select
                        id={`${baseId}-target`}
                        value={target}
                        onChange={(event) => setTarget(event.target.value)}
                        className="h-11 w-full rounded-md border border-border bg-surface px-3 text-small text-fg"
                      >
                        <option value="">—</option>
                        {duplicates.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.title}
                            {entry.subtitle ? ` — ${entry.subtitle}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                ) : null}
                <DecisionOption
                  name={`${baseId}-decision-choice`}
                  value="leave"
                  checked={decision === "leave"}
                  onChange={() => setDecision("leave")}
                  icon={CheckCheck}
                  title={c.leave}
                  hint={c.leaveHint}
                />
              </fieldset>
              <Button type="submit" size="lg" disabled={decision === "link" && !target}>
                {c.apply}
              </Button>
            </form>
            {result ? (
              <div className="space-y-1 rounded-md border border-border bg-surface-muted p-3">
                <p role="status" className="flex items-start gap-2 text-small text-fg">
                  <CheckCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                  {result}
                </p>
                <DemoNote text={t.actions.demo} />
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
});

function DecisionOption({
  name,
  value,
  checked,
  onChange,
  icon: Icon,
  title,
  hint,
}: {
  name: string;
  value: Decision;
  checked: boolean;
  onChange: () => void;
  icon: typeof Sparkles;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3",
        checked ? "border-primary bg-primary-soft/40" : "border-border bg-surface hover:bg-surface-muted",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
      />
      <span className="space-y-0.5">
        <span className="flex items-center gap-2 text-small font-semibold text-fg">
          <Icon aria-hidden className="size-4 text-fg-muted" />
          {title}
        </span>
        <span className="block text-caption text-fg-muted">{hint}</span>
      </span>
    </label>
  );
}
