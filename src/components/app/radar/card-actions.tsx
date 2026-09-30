"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, EyeOff, FlaskConical, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TelegramListingStatus } from "@/lib/domain/types";
import type { RadarMessages } from "./labels";

type Labels = Pick<
  RadarMessages["actions"],
  "save" | "saved" | "hide" | "hidden" | "unhide" | "reportShort" | "reported" | "undo" | "demo"
>;

/**
 * Save / hide / report-stale on a Radar card (§13.6). Demo only: the state
 * lives in this card, says so, and is gone on reload — nothing pretends a
 * server call happened.
 */
export function CardActions({
  initialStatus,
  labels,
  describedBy,
}: {
  initialStatus: TelegramListingStatus;
  labels: Labels;
  /** Id of the card title, so each button is announced with its post. */
  describedBy: string;
}) {
  const [status, setStatus] = useState<TelegramListingStatus>(initialStatus);
  const changed = status !== initialStatus;
  const reset = initialStatus === "hidden" || initialStatus === "reported_stale" ? "new" : initialStatus;

  if (status === "hidden" || status === "reported_stale") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" className="inline-flex items-center gap-1.5 text-small font-medium text-fg-muted">
            {status === "hidden" ? (
              <EyeOff aria-hidden className="size-4" />
            ) : (
              <TriangleAlert aria-hidden className="size-4" />
            )}
            {status === "hidden" ? labels.hidden : labels.reported}
          </span>
          <Button variant="ghost" onClick={() => setStatus(reset)} aria-describedby={describedBy}>
            <RotateCcw aria-hidden className="size-4" />
            {status === "hidden" ? labels.unhide : labels.undo}
          </Button>
        </div>
        {changed ? <DemoNote text={labels.demo} /> : null}
      </div>
    );
  }

  const saved = status === "saved";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={saved ? "soft" : "secondary"}
          aria-pressed={saved}
          aria-describedby={describedBy}
          onClick={() => setStatus(saved ? "new" : "saved")}
        >
          {saved ? <BookmarkCheck aria-hidden className="size-4" /> : <Bookmark aria-hidden className="size-4" />}
          {saved ? labels.saved : labels.save}
        </Button>
        <Button variant="ghost" aria-describedby={describedBy} onClick={() => setStatus("hidden")}>
          <EyeOff aria-hidden className="size-4" />
          {labels.hide}
        </Button>
        <Button variant="ghost" aria-describedby={describedBy} onClick={() => setStatus("reported_stale")}>
          <TriangleAlert aria-hidden className="size-4" />
          {labels.reportShort}
        </Button>
      </div>
      {changed ? <DemoNote text={labels.demo} /> : null}
    </div>
  );
}

export function DemoNote({ text }: { text: string }) {
  return (
    <p role="status" className="flex items-start gap-1.5 text-caption text-fg-muted">
      <FlaskConical aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {text}
    </p>
  );
}
