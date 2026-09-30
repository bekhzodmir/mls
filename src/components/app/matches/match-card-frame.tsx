"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Bookmark, BookmarkCheck, ExternalLink, Handshake, Send, ThumbsDown, Undo2 } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { format } from "@/i18n/define-messages";
import type matchesScreen from "@/i18n/messages/matches-screen";
import type { MatchRejectionReason } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

type Labels = (typeof matchesScreen)["ru"]["actions"];

const rejectionReasons: readonly MatchRejectionReason[] = ["price", "location", "condition", "stale", "other"];

export interface MatchCardFrameProps {
  labels: Labels;
  reasonLabels: Record<MatchRejectionReason, string>;
  openHref: string;
  openLabel: string;
  /** Partner listing: contact goes through a cooperation request (§15.3). */
  cooperationHref?: string;
  /** Stale, expired or set aside by recorded status: never styled as active (§36.3). */
  muted: boolean;
  /** Recorded as rejected / duplicate already: no second rejection. */
  setAside: boolean;
  labelledBy: string;
  children: ReactNode;
}

/**
 * Interactive shell of a Match Card. The content is rendered on the server
 * and passed in as children; this component only keeps the demo reactions
 * (save, send, reject with a reason) in local state. Each reaction says it
 * was not saved — nothing pretends a server call happened.
 */
export function MatchCardFrame({
  labels,
  reasonLabels,
  openHref,
  openLabel,
  cooperationHref,
  muted,
  setAside,
  labelledBy,
  children,
}: MatchCardFrameProps) {
  const [saved, setSaved] = useState(false);
  const [sent, setSent] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<MatchRejectionReason | "">("");
  const [rejected, setRejected] = useState<MatchRejectionReason | null>(null);
  const id = useId();
  const touched = saved || sent || rejected !== null;
  const reasonsRef = useRef<HTMLFieldSetElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);
  const wasRejecting = useRef(false);

  // Move focus into the reason picker when it opens, and back to "Отклонить" when it is cancelled.
  useEffect(() => {
    if (rejecting) reasonsRef.current?.querySelector("input")?.focus();
    else if (wasRejecting.current && !rejected) rejectRef.current?.focus();
    wasRejecting.current = rejecting;
  }, [rejecting, rejected]);

  return (
    <article
      aria-labelledby={labelledBy}
      className={cn(
        "space-y-3 rounded-lg border p-4 shadow-card",
        muted || rejected ? "border-dashed border-border-strong bg-surface-muted/60" : "border-border bg-surface",
      )}
    >
      <div className={cn(rejected && "opacity-70")}>{children}</div>

      {rejected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-3 py-2">
          <p className="flex items-center gap-2 text-small font-medium text-fg">
            <ThumbsDown aria-hidden className="size-4 shrink-0 text-fg-muted" />
            {format(labels.rejected, { reason: reasonLabels[rejected] })}
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              setRejected(null);
              setReason("");
            }}
          >
            <Undo2 aria-hidden className="size-4" />
            {labels.undo}
          </Button>
        </div>
      ) : rejecting ? (
        <form
          className="space-y-3 rounded-md border border-border bg-surface p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!reason) return;
            setRejected(reason);
            setRejecting(false);
          }}
        >
          <fieldset ref={reasonsRef} className="space-y-1" aria-describedby={`${id}-reject-hint`}>
            <legend className="mb-1 text-small font-semibold text-fg">{labels.rejectTitle}</legend>
            <div className="flex flex-wrap gap-2">
              {rejectionReasons.map((item) => (
                <label
                  key={item}
                  className={cn(
                    "inline-flex h-11 cursor-pointer items-center rounded-full border px-4 text-small font-medium",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                    reason === item ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg hover:bg-surface-muted",
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-reason`}
                    value={item}
                    checked={reason === item}
                    onChange={() => setReason(item)}
                    className="sr-only"
                  />
                  {reasonLabels[item]}
                </label>
              ))}
            </div>
          </fieldset>
          <p id={`${id}-reject-hint`} className="text-caption text-fg-muted">
            {labels.rejectHint}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" disabled={!reason}>
              {labels.rejectConfirm}
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              {labels.cancel}
            </Button>
          </div>
          {!reason ? <p className="text-caption text-fg-muted">{labels.chooseReason}</p> : null}
        </form>
      ) : null}

      <div role="group" aria-label={labels.label} className="flex flex-wrap gap-2">
        <Link href={openHref} className={buttonClasses("secondary", "md")}>
          <ExternalLink aria-hidden className="size-4" />
          {openLabel}
        </Link>
        {!setAside && !rejected ? (
          <>
            <Button variant={sent ? "soft" : "primary"} aria-pressed={sent} onClick={() => setSent((value) => !value)}>
              <Send aria-hidden className="size-4" />
              {sent ? labels.sent : labels.send}
            </Button>
            <Button variant={saved ? "soft" : "secondary"} aria-pressed={saved} onClick={() => setSaved((value) => !value)}>
              {saved ? <BookmarkCheck aria-hidden className="size-4" /> : <Bookmark aria-hidden className="size-4" />}
              {saved ? labels.saved : labels.save}
            </Button>
            {!rejecting ? (
              <Button ref={rejectRef} variant="ghost" onClick={() => setRejecting(true)}>
                <ThumbsDown aria-hidden className="size-4" />
                {labels.reject}
              </Button>
            ) : null}
          </>
        ) : null}
        {cooperationHref && !rejected ? (
          <Link href={cooperationHref} className={buttonClasses("soft", "md")}>
            <Handshake aria-hidden className="size-4" />
            {labels.cooperation}
          </Link>
        ) : null}
      </div>

      <p role="status" className="text-caption text-fg-muted">
        {touched ? labels.demo : ""}
      </p>
    </article>
  );
}
