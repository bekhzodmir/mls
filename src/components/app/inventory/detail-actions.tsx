"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CheckCheck, Ellipsis, Phone, Send, X } from "lucide-react";
import { Button, ButtonAnchor, buttonClasses } from "@/components/ui/button";
import type properties from "@/i18n/messages/properties";
import { cn } from "@/lib/cn";

type Labels = (typeof properties)["ru"]["detail"]["actions"];

export interface DetailActionsProps {
  labels: Labels;
  /** Who "Позвонить" reaches; omitted when the viewer has nobody to call (§22.6). */
  call?: { kind: "owner" | "agent"; href: string };
  /** Clients whose active requests this listing fits (reverse matching). */
  clients: { id: string; name: string }[];
  /** Masked partner listing: the client receives no address or owner data. */
  masked: boolean;
  /** Secondary actions for the "Ещё" menu, already localized. */
  more: { href: string; label: string }[];
}

type Panel = "send" | "more" | null;

/**
 * Primary property actions (§14.3, §22.6): a sticky bar in the thumb zone on
 * phones — above the bottom navigation; the shell hides the "+" meanwhile —
 * and a plain row on desktop. "Отправить клиенту" is a demo: it says so and
 * records nothing.
 */
export function DetailActions({ labels, call, clients, masked, more }: DetailActionsProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [clientId, setClientId] = useState<string>("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const openedRef = useRef(false);
  const baseId = useId();
  const panelId = `${baseId}-panel`;

  useEffect(() => {
    if (!panel) {
      // Return focus to the button that opened the panel (not on first render).
      if (openedRef.current) triggerRef.current?.focus();
      openedRef.current = false;
      return;
    }
    openedRef.current = true;
    triggerRef.current = panel === "send" ? sendRef.current : moreRef.current;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const toggle = (next: Exclude<Panel, null>) => setPanel((current) => (current === next ? null : next));
  const sentName = clients.find((client) => client.id === sentTo)?.name;

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
            <p className="text-body font-semibold text-fg">{panel === "send" ? labels.sendTitle : labels.more}</p>
            <Button variant="ghost" size="icon" onClick={() => setPanel(null)} aria-label={labels.close}>
              <X aria-hidden className="size-5" />
            </Button>
          </div>

          {panel === "more" ? (
            <ul className="-mx-2">
              {more.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center rounded-md px-2 text-small font-medium text-fg hover:bg-surface-muted"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : sentTo ? (
            <div role="status" className="space-y-3">
              <p className="flex items-start gap-2 text-small text-fg">
                <CheckCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                <span>
                  <span className="font-semibold">{sentName}</span> — {labels.sent}
                </span>
              </p>
              <Button variant="secondary" onClick={() => setSentTo(null)}>
                {labels.sendTitle}
              </Button>
            </div>
          ) : clients.length === 0 ? (
            <p className="text-small text-fg-muted">{labels.sendNone}</p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (clientId) setSentTo(clientId);
              }}
            >
              <fieldset className="space-y-1">
                <legend className="mb-1 text-caption text-fg-muted">{labels.sendHint}</legend>
                {clients.map((client) => (
                  <label
                    key={client.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-small text-fg hover:bg-surface-muted"
                  >
                    <input
                      type="radio"
                      name="client"
                      value={client.id}
                      checked={clientId === client.id}
                      onChange={() => setClientId(client.id)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    {client.name}
                  </label>
                ))}
              </fieldset>
              {masked ? <p className="text-caption text-fg-muted">{labels.sendMasked}</p> : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={!clientId} aria-describedby={clientId ? undefined : `${baseId}-choose`}>
                  <Send aria-hidden className="size-4" />
                  {labels.sendConfirm}
                </Button>
                <Button variant="ghost" onClick={() => setPanel(null)}>
                  {labels.cancel}
                </Button>
              </div>
              {!clientId ? (
                <p id={`${baseId}-choose`} className="text-caption text-fg-muted">
                  {labels.sendChoose}
                </p>
              ) : null}
            </form>
          )}
        </div>
      ) : null}

      <div className="mx-auto flex max-w-3xl gap-2 lg:mx-0">
        {call ? (
          <ButtonAnchor
            href={call.href}
            variant="primary"
            aria-label={call.kind === "owner" ? labels.callOwner : labels.callAgent}
            className="min-w-0 flex-1 lg:flex-none"
          >
            <Phone aria-hidden className="size-4 shrink-0" />
            <span className="truncate lg:hidden">{labels.call}</span>
            <span className="hidden lg:inline">{call.kind === "owner" ? labels.callOwner : labels.callAgent}</span>
          </ButtonAnchor>
        ) : null}
        <Button
          ref={sendRef}
          variant={call ? "secondary" : "primary"}
          className="min-w-0 flex-1 lg:flex-none"
          aria-label={labels.send}
          aria-expanded={panel === "send"}
          aria-controls={panel === "send" ? panelId : undefined}
          onClick={() => toggle("send")}
        >
          <Send aria-hidden className="size-4 shrink-0" />
          <span className="truncate lg:hidden">{labels.sendShort}</span>
          <span className="hidden lg:inline">{labels.send}</span>
        </Button>
        <button
          ref={moreRef}
          type="button"
          className={cn(buttonClasses("secondary", "md"), "shrink-0 px-3")}
          aria-expanded={panel === "more"}
          aria-controls={panel === "more" ? panelId : undefined}
          onClick={() => toggle("more")}
        >
          <Ellipsis aria-hidden className="size-4" />
          <span className="sr-only lg:not-sr-only">{labels.more}</span>
        </button>
      </div>
    </div>
  );
}
