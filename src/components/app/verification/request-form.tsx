"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck, ClipboardCheck, ClipboardList, Plus, ShieldCheck, type LucideIcon } from "lucide-react";
import { ErrorSummary, FieldError, FieldHint, FieldLabel, inputClasses } from "@/components/app/crm/form-controls";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import verification from "@/i18n/messages/verification";
import { cn } from "@/lib/cn";
import { appHref } from "@/lib/routes";
import { VerdictBadge } from "./access-table";
import {
  blockAccess,
  contractsForListing,
  documentState,
  REQUEST_PURPOSES,
  REQUEST_SUBJECTS,
  requiredDocuments,
  SUBJECT_BLOCK,
  validateRequest,
  type DocumentState,
  type RequestContract,
  type RequestField,
  type RequestListing,
  type RequestPurpose,
  type RequestSubject,
  type RequesterStanding,
} from "./request";

const docStyle: Record<DocumentState, { tone: Tone; icon: LucideIcon }> = {
  ready: { tone: "success", icon: CircleCheck },
  missing: { tone: "danger", icon: CircleAlert },
  manual: { tone: "neutral", icon: ClipboardCheck },
};

/** Errors that describe a chosen contract (a fact, not a typo): shown as soon as it is chosen. */
const CONTRACT_FACTS = new Set(["contract_other_object", "contract_not_active", "consents_missing"]);

/**
 * New realtor request (§35.7 steps 1–4, §38.4): object, subject, purpose and
 * the client contract it is based on; the verdict for the chosen subject and
 * the documents with what Binor already has. Nothing is sent — there are no
 * state integrations in this build — so saving records a demo checklist
 * item in this tab and says so.
 */
export function RequestForm({
  locale,
  standing,
  listings,
  contracts,
  initial,
}: {
  locale: Locale;
  standing: RequesterStanding;
  listings: RequestListing[];
  contracts: RequestContract[];
  initial: { listingId?: string; subject?: RequestSubject };
}) {
  const t = verification[locale].request;
  const id = useId();
  const ids: Record<RequestField, string> = {
    listingId: `${id}-listing`,
    subject: `${id}-subject`,
    purpose: `${id}-purpose`,
    contractId: `${id}-contract`,
  };
  const summaryRef = useRef<HTMLDivElement>(null);

  const defaultContract = (listingId: string | undefined) => {
    const listing = listings.find((item) => item.id === listingId);
    return contracts.find((contract) => listing && contract.number === listing.contractNumber)?.id ?? "";
  };

  const [listingId, setListingId] = useState(initial.listingId ?? "");
  const [subject, setSubject] = useState<RequestSubject | "">(initial.subject ?? "");
  const [purpose, setPurpose] = useState<RequestPurpose | "">("");
  const [contractId, setContractId] = useState(() => defaultContract(initial.listingId));
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);

  const listing = listings.find((item) => item.id === listingId);
  const options = contractsForListing(contracts, listing);
  const contract = contracts.find((item) => item.id === contractId);
  const block = subject ? SUBJECT_BLOCK[subject] : undefined;
  const verdict = block ? blockAccess(standing, block) : undefined;

  const problems = validateRequest(
    {
      listingId: listingId || undefined,
      subject: subject || undefined,
      purpose: purpose || undefined,
      contractId: contractId || undefined,
    },
    standing,
    listings,
    contracts,
  );
  const errors = problems.map((problem) => ({ id: ids[problem.field], text: t.errors[problem.error] }));
  const errorFor = (field: RequestField) => {
    const problem = problems.find((item) => item.field === field);
    if (!problem) return undefined;
    if (submitted || (field === "contractId" && CONTRACT_FACTS.has(problem.error))) return t.errors[problem.error];
    return undefined;
  };
  const describedBy = (field: RequestField, hint?: boolean) =>
    [hint ? `${ids[field]}-hint` : "", errorFor(field) ? `${ids[field]}-error` : ""].filter(Boolean).join(" ") ||
    undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (problems.length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSaved(true);
  }

  if (saved && subject && purpose && listing && contract) {
    return (
      <div role="status" className="space-y-4">
        <Notice kind="info" title={t.saved.title}>
          <div className="space-y-2">
            <Badge tone="neutral" icon={ClipboardList}>
              {t.subjects[subject]}: {t.saved.status}
            </Badge>
            <p>
              {format(t.saved.summary, {
                object: listing.label,
                purpose: t.purposes[purpose],
                contract: contract.number,
              })}
            </p>
            <p>{t.saved.text}</p>
          </div>
        </Notice>
        <div className="flex flex-wrap gap-2">
          <Link href={appHref(locale, "verification")} className={buttonClasses("primary")}>
            <ShieldCheck aria-hidden className="size-4" />
            {t.saved.back}
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setSaved(false);
              setSubmitted(false);
              setSubject("");
              setPurpose("");
            }}
          >
            <Plus aria-hidden className="size-4" />
            {t.saved.another}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {submitted ? (
        <ErrorSummary title={format(t.errorSummary, { n: errors.length })} errors={errors} summaryRef={summaryRef} />
      ) : null}

      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.listingId}>{t.object}</FieldLabel>
        <select
          id={ids.listingId}
          value={listingId}
          aria-invalid={errorFor("listingId") ? true : undefined}
          aria-describedby={describedBy("listingId", true)}
          onChange={(event) => {
            setListingId(event.target.value);
            setContractId(defaultContract(event.target.value));
          }}
          className={inputClasses}
        >
          <option value="">{t.objectPlaceholder}</option>
          {listings.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <FieldHint id={`${ids.listingId}-hint`}>{listings.length > 0 ? t.objectHint : t.noObjects}</FieldHint>
        {errorFor("listingId") ? <FieldError id={`${ids.listingId}-error`}>{errorFor("listingId")}</FieldError> : null}
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.subject}>{t.subject}</FieldLabel>
        <select
          id={ids.subject}
          value={subject}
          aria-invalid={errorFor("subject") ? true : undefined}
          aria-describedby={describedBy("subject", Boolean(verdict))}
          onChange={(event) => setSubject(event.target.value as RequestSubject | "")}
          className={inputClasses}
        >
          <option value="">{t.subjectPlaceholder}</option>
          {REQUEST_SUBJECTS.map((code) => {
            const access = blockAccess(standing, SUBJECT_BLOCK[code]).access;
            return (
              <option key={code} value={code}>
                {access === "allowed" ? t.subjects[code] : `${t.subjects[code]} — ${t.access[access]}`}
              </option>
            );
          })}
        </select>
        {block && verdict ? (
          <div id={`${ids.subject}-hint`} className="space-y-1 rounded-md bg-surface-muted p-3 text-small">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-fg-muted">{t.verdictTitle}:</span>
              <VerdictBadge locale={locale} verdict={verdict} />
            </p>
            <p className="font-medium text-fg">{t.blocks[block].name}</p>
            {verdict.reason ? <p className="text-caption text-fg-muted">{t.reasons[verdict.reason]}</p> : null}
            <p className="text-caption text-fg-muted">{t.blocks[block].limitation}</p>
          </div>
        ) : null}
        {errorFor("subject") ? <FieldError id={`${ids.subject}-error`}>{errorFor("subject")}</FieldError> : null}
      </div>

      <fieldset id={ids.purpose} tabIndex={-1} className="space-y-2" aria-describedby={describedBy("purpose")}>
        <legend className="text-small font-semibold text-fg">{t.purpose}</legend>
        <div className="space-y-2">
          {REQUEST_PURPOSES.map((code) => (
            <label
              key={code}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-small has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                purpose === code ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface text-fg",
              )}
            >
              <input
                type="radio"
                name={`${id}-purpose`}
                value={code}
                checked={purpose === code}
                onChange={() => setPurpose(code)}
                className="size-4 shrink-0 accent-primary"
              />
              {t.purposes[code]}
            </label>
          ))}
        </div>
        {errorFor("purpose") ? <FieldError id={`${ids.purpose}-error`}>{errorFor("purpose")}</FieldError> : null}
      </fieldset>

      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.contractId}>{t.contract}</FieldLabel>
        <select
          id={ids.contractId}
          value={contractId}
          aria-invalid={errorFor("contractId") ? true : undefined}
          aria-describedby={describedBy("contractId", true)}
          onChange={(event) => setContractId(event.target.value)}
          className={inputClasses}
        >
          <option value="">{t.contractPlaceholder}</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {format(t.contractOption, {
                number: item.number,
                kind: t.contractKind[item.kind],
                customer: item.customerName,
                status: t.contractStatus[item.status],
              })}
            </option>
          ))}
        </select>
        <FieldHint id={`${ids.contractId}-hint`}>{options.length > 0 ? t.contractHint : t.contractNone}</FieldHint>
        {errorFor("contractId") ? (
          <FieldError id={`${ids.contractId}-error`}>{errorFor("contractId")}</FieldError>
        ) : null}
      </div>

      {block ? (
        <section aria-labelledby={`${id}-documents`} className="space-y-2">
          <h2 id={`${id}-documents`} className="text-small font-semibold text-fg">
            {t.documentsTitle}
          </h2>
          <ul className="space-y-2">
            {requiredDocuments(block).map((document) => {
              const state = documentState(document, {
                contract: contract && (!contract.listingId || contract.listingId === listingId) ? contract : undefined,
                cadastralKnown: listing?.cadastralKnown,
              });
              const { tone, icon } = docStyle[state];
              return (
                <li
                  key={document}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-small"
                >
                  <span className="text-fg">{t.documents[document]}</span>
                  <Badge tone={tone} icon={icon}>
                    {t.docState[state]}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Button type="submit" size="lg" className="w-full sm:w-auto">
        <ClipboardList aria-hidden className="size-5" />
        {t.submit}
      </Button>
    </form>
  );
}
