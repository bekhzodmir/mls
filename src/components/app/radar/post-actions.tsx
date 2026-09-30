"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Bookmark,
  BookmarkCheck,
  Building,
  CheckCheck,
  Copy,
  Ellipsis,
  ExternalLink,
  EyeOff,
  RotateCcw,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { format } from "@/i18n/define-messages";
import type { TelegramListingStatus } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { DemoNote } from "./card-actions";
import type { RadarMessages } from "./labels";

type Panel = "more" | "link" | "duplicate" | "report" | "subscribe" | "done" | null;

export interface PostActionsProps {
  labels: RadarMessages["actions"];
  initialStatus: TelegramListingStatus;
  convertHref: string;
  original: { href: string; label: string };
  clients: { id: string; name: string }[];
  duplicates: { id: string; title: string }[];
  /** «Продажа, квартира и Чиланзар»; undefined when the post has no usable criteria. */
  subscription?: string;
}

/**
 * Post actions (§13.6, §22.8): convert, save, link to a client, mark a
 * duplicate, hide, report stale and subscribe to similar posts. A sticky bar
 * in the thumb zone on phones, a row on desktop. Everything except "convert"
 * (a real page) is local demo state and says so.
 */
export function PostActions({
  labels,
  initialStatus,
  convertHref,
  original,
  clients,
  duplicates,
  subscription,
}: PostActionsProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [status, setStatus] = useState<TelegramListingStatus>(initialStatus);
  const [done, setDone] = useState<string>("");
  const [choice, setChoice] = useState<string>("");
  const panelRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const panelId = `${baseId}-panel`;

  useEffect(() => {
    if (!panel) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  function open(next: Exclude<Panel, null>) {
    setChoice("");
    setPanel((current) => (current === next ? null : next));
  }

  function finish(message: string) {
    setDone(message);
    setPanel("done");
  }

  const saved = status === "saved";
  const hidden = status === "hidden";

  const title: Record<Exclude<Panel, null>, string> = {
    more: labels.more,
    link: labels.linkTitle,
    duplicate: labels.duplicateTitle,
    report: labels.reportTitle,
    subscribe: labels.subscribeTitle,
    done: labels.more,
  };

  return (
    <div
      role="group"
      aria-label={labels.label}
      data-sticky-actions
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 py-2 px-4 backdrop-blur lg:relative lg:inset-auto lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
    >
      {panel ? (
        <div
          id={panelId}
          ref={panelRef}
          tabIndex={-1}
          className="absolute inset-x-2 bottom-full mb-2 max-h-[60dvh] overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-float outline-none lg:inset-x-auto lg:top-full lg:right-0 lg:bottom-auto lg:mt-2 lg:mb-0 lg:w-96"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-body font-semibold text-fg">{title[panel]}</p>
            <Button variant="ghost" size="icon" onClick={() => setPanel(null)} aria-label={labels.close}>
              <X aria-hidden className="size-5" />
            </Button>
          </div>

          {panel === "more" ? (
            <ul className="-mx-2">
              <MenuItem icon={UserPlus} onClick={() => open("link")}>
                {labels.link}
              </MenuItem>
              <MenuItem icon={Copy} onClick={() => open("duplicate")}>
                {labels.duplicate}
              </MenuItem>
              <MenuItem
                icon={hidden ? RotateCcw : EyeOff}
                onClick={() => {
                  if (hidden) {
                    setStatus("new");
                    setPanel(null);
                  } else {
                    setStatus("hidden");
                    finish(labels.hidden);
                  }
                }}
              >
                {hidden ? labels.unhide : labels.hide}
              </MenuItem>
              <MenuItem icon={TriangleAlert} onClick={() => open("report")}>
                {labels.report}
              </MenuItem>
              <MenuItem icon={Bell} onClick={() => open("subscribe")}>
                {labels.subscribe}
              </MenuItem>
              <li>
                <a
                  href={original.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center gap-3 rounded-md px-2 text-small font-medium text-fg hover:bg-surface-muted"
                >
                  <ExternalLink aria-hidden className="size-4 text-fg-muted" />
                  {original.label}
                </a>
              </li>
            </ul>
          ) : null}

          {panel === "link" ? (
            clients.length === 0 ? (
              <p className="text-small text-fg-muted">{labels.linkNone}</p>
            ) : (
              <ChoiceForm
                legend={labels.linkHint}
                name={`${baseId}-client`}
                options={clients.map((client) => ({ id: client.id, label: client.name }))}
                value={choice}
                onChange={setChoice}
                submit={labels.linkConfirm}
                cancel={labels.cancel}
                onCancel={() => setPanel(null)}
                onSubmit={() => {
                  const name = clients.find((client) => client.id === choice)?.name ?? "";
                  finish(format(labels.linkDone, { name }));
                }}
              />
            )
          ) : null}

          {panel === "duplicate" ? (
            duplicates.length === 0 ? (
              <p className="text-small text-fg-muted">{labels.duplicateNone}</p>
            ) : (
              <ChoiceForm
                legend={labels.duplicateHint}
                name={`${baseId}-duplicate`}
                options={duplicates.map((item) => ({ id: item.id, label: item.title }))}
                value={choice}
                onChange={setChoice}
                submit={labels.duplicateConfirm}
                cancel={labels.cancel}
                onCancel={() => setPanel(null)}
                onSubmit={() => {
                  const name = duplicates.find((item) => item.id === choice)?.title ?? "";
                  finish(format(labels.duplicateDone, { name }));
                }}
              />
            )
          ) : null}

          {panel === "report" ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                setStatus("reported_stale");
                finish(labels.reported);
              }}
            >
              <div className="space-y-1">
                <label htmlFor={`${baseId}-reason`} className="text-caption font-medium text-fg-muted">
                  {labels.reportReason}
                </label>
                <textarea
                  id={`${baseId}-reason`}
                  rows={3}
                  className="w-full rounded-md border border-border bg-surface p-3 text-small text-fg focus-visible:border-primary"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">{labels.reportConfirm}</Button>
                <Button variant="ghost" onClick={() => setPanel(null)}>
                  {labels.cancel}
                </Button>
              </div>
            </form>
          ) : null}

          {panel === "subscribe" ? (
            subscription ? (
              <div className="space-y-3">
                <p className="text-small text-fg">{format(labels.subscribeText, { criteria: subscription })}</p>
                <div className="flex gap-2">
                  <Button onClick={() => finish(labels.subscribeDone)}>
                    <Bell aria-hidden className="size-4" />
                    {labels.subscribeConfirm}
                  </Button>
                  <Button variant="ghost" onClick={() => setPanel(null)}>
                    {labels.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-small text-fg-muted">{labels.subscribeNoCriteria}</p>
            )
          ) : null}

          {panel === "done" ? (
            <div className="space-y-2">
              <p role="status" className="flex items-start gap-2 text-small text-fg">
                <CheckCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                {done}
              </p>
              <DemoNote text={labels.demo} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto flex max-w-3xl gap-2 lg:mx-0">
        <Link
          href={convertHref}
          className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-small font-semibold text-primary-fg shadow-card hover:bg-primary-hover lg:flex-none"
        >
          <Building aria-hidden className="size-4 shrink-0" />
          <span className="truncate lg:hidden">{labels.convertShort}</span>
          <span className="hidden lg:inline">{labels.convert}</span>
        </Link>
        <Button
          variant={saved ? "soft" : "secondary"}
          aria-pressed={saved}
          className="min-w-0 flex-1 lg:flex-none"
          onClick={() => {
            if (saved) {
              setStatus("new");
              setPanel(null);
            } else {
              setStatus("saved");
              finish(labels.saved);
            }
          }}
        >
          {saved ? (
            <BookmarkCheck aria-hidden className="size-4 shrink-0" />
          ) : (
            <Bookmark aria-hidden className="size-4 shrink-0" />
          )}
          <span className="truncate">{saved ? labels.saved : labels.save}</span>
        </Button>
        <Button
          variant="secondary"
          className="shrink-0 px-3"
          aria-expanded={panel === "more"}
          aria-controls={panel ? panelId : undefined}
          onClick={() => open("more")}
        >
          <Ellipsis aria-hidden className="size-4" />
          <span className="sr-only lg:not-sr-only">{labels.more}</span>
        </Button>
        <ButtonAnchor
          href={original.href}
          target="_blank"
          rel="noopener noreferrer"
          variant="ghost"
          className="hidden lg:inline-flex"
        >
          <ExternalLink aria-hidden className="size-4" />
          {original.label}
        </ButtonAnchor>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, onClick, children }: { icon: typeof Bell; onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-small font-medium text-fg hover:bg-surface-muted"
      >
        <Icon aria-hidden className="size-4 text-fg-muted" />
        {children}
      </button>
    </li>
  );
}

function ChoiceForm({
  legend,
  name,
  options,
  value,
  onChange,
  submit,
  cancel,
  onCancel,
  onSubmit,
}: {
  legend: string;
  name: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  submit: string;
  cancel: string;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (value) onSubmit();
      }}
    >
      <fieldset className="space-y-1">
        <legend className="mb-1 text-caption text-fg-muted">{legend}</legend>
        {options.map((option) => (
          <label
            key={option.id}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-small text-fg hover:bg-surface-muted",
              value === option.id && "bg-surface-muted",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              className="size-4 accent-[var(--primary)]"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={!value}>
          {submit}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {cancel}
        </Button>
      </div>
    </form>
  );
}
