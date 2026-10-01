"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  Building,
  CircleCheck,
  Ellipsis,
  KeyRound,
  ListPlus,
  MessagesSquare,
  Phone,
  ShieldCheck,
  ShieldOff,
  UserCog,
  X,
  type LucideIcon,
} from "lucide-react";
import { FieldError, FieldLabel, inputClasses } from "@/components/app/crm/form-controls";
import { stickyActionClasses } from "@/components/app/crm/layout-parts";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDate } from "@/i18n/format";
import owners from "@/i18n/messages/owners";
import { cn } from "@/lib/cn";
import { telHref } from "@/lib/domain/phone";

const primaryAction = "bg-primary text-primary-fg hover:bg-primary-hover";
const secondaryAction = "border border-border bg-surface text-fg hover:bg-surface-muted";
const itemClasses =
  "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-small font-medium text-fg hover:bg-surface-muted";

type Panel = "task" | "more" | null;

/**
 * Sticky owner actions (§14.3 pattern, §22.6): Позвонить — only when the
 * contact is visible, disabled with the reason when the contact consent was
 * revoked —, Задача and Ещё. On phones the bar sits in the thumb zone above
 * the bottom navigation (the shell hides "+" while a `data-sticky-actions`
 * bar is on screen); from `lg` up it is a plain row. The task and the
 * reassign / revoke actions are demo-only: they say nothing is stored.
 */
export function OwnerActions({
  locale,
  ownerName,
  phone,
  callBlockedHintId,
  links,
  today,
}: {
  locale: Locale;
  ownerName: string;
  /** Present only when the viewer may see the contact (§34.2). */
  phone?: string;
  /** Set when the contact consent is revoked: the id of the text that explains it. */
  callBlockedHintId?: string;
  links: { calls: string; request?: string; property: string; newOwner: string };
  /** Tashkent date "YYYY-MM-DD", the earliest due date. */
  today: string;
}) {
  const t = owners[locale].actions;
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<string>();
  const [text, setText] = useState("");
  const [due, setDue] = useState(today);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<{ text: string; due: string }>();
  const panelRef = useRef<HTMLDivElement>(null);
  const taskRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const openedFrom = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!panel) {
      // Return focus to the button that opened the panel (not on first render).
      openedFrom.current?.focus();
      openedFrom.current = null;
      return;
    }
    openedFrom.current = panel === "task" ? taskRef.current : moreRef.current;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const toggle = (next: Exclude<Panel, null>) => {
    setNotice(undefined);
    setPanel((current) => (current === next ? null : next));
  };

  const textError = tried && !text.trim() ? t.taskError : undefined;

  function saveTask(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (!text.trim()) return;
    setSaved({ text: text.trim(), due });
  }

  const menuLinks: { href: string; label: string; icon: LucideIcon }[] = [
    { href: links.calls, label: t.menu.calls, icon: MessagesSquare },
    ...(links.request ? [{ href: links.request, label: t.menu.request, icon: ShieldCheck }] : []),
    { href: links.property, label: t.menu.property, icon: Building },
    { href: links.newOwner, label: t.menu.newOwner, icon: KeyRound },
  ];

  return (
    <div
      role="group"
      aria-label={`${t.label}: ${ownerName}`}
      data-sticky-actions
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 backdrop-blur lg:relative lg:inset-auto lg:z-auto lg:border-0 lg:bg-transparent lg:backdrop-blur-none"
    >
      {panel ? (
        <div
          id={panelId}
          ref={panelRef}
          tabIndex={-1}
          className="absolute inset-x-2 bottom-full mb-2 max-h-[60dvh] overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-float outline-none lg:inset-x-auto lg:top-full lg:bottom-auto lg:left-0 lg:mt-2 lg:mb-0 lg:w-96"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-body font-semibold text-fg">{panel === "task" ? t.taskTitle : t.more}</p>
            <Button variant="ghost" size="icon" onClick={() => setPanel(null)} aria-label={t.close}>
              <X aria-hidden className="size-5" />
            </Button>
          </div>

          {panel === "task" ? (
            saved ? (
              <div role="status" className="space-y-3 text-small text-fg">
                <p className="flex items-start gap-2">
                  <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                  <span>{format(t.taskSaved, { text: saved.text })}</span>
                </p>
                <p className="text-fg-muted">
                  {format(t.taskDueSaved, { date: formatDate(locale, `${saved.due}T07:00:00.000Z`) })}
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSaved(undefined);
                    setText("");
                    setTried(false);
                  }}
                >
                  {t.taskAnother}
                </Button>
              </div>
            ) : (
              <form onSubmit={saveTask} noValidate className="space-y-3">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`${baseId}-text`}>{t.taskText}</FieldLabel>
                  <input
                    id={`${baseId}-text`}
                    value={text}
                    placeholder={t.taskPlaceholder}
                    aria-invalid={textError ? true : undefined}
                    aria-describedby={textError ? `${baseId}-text-error` : undefined}
                    onChange={(event) => setText(event.target.value)}
                    className={inputClasses}
                  />
                  {textError ? <FieldError id={`${baseId}-text-error`}>{textError}</FieldError> : null}
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor={`${baseId}-due`}>{t.taskDue}</FieldLabel>
                  <input
                    id={`${baseId}-due`}
                    type="date"
                    min={today}
                    value={due}
                    onChange={(event) => setDue(event.target.value || today)}
                    className={inputClasses}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">
                    <ListPlus aria-hidden className="size-4" />
                    {t.taskSave}
                  </Button>
                  <Button variant="ghost" onClick={() => setPanel(null)}>
                    {t.taskCancel}
                  </Button>
                </div>
              </form>
            )
          ) : notice ? (
            <div role="status" className="space-y-2 text-small text-fg">
              <p>{notice}</p>
              <button type="button" className={itemClasses} onClick={() => setNotice(undefined)}>
                <X aria-hidden className="size-4" />
                {t.close}
              </button>
            </div>
          ) : (
            <ul className="-mx-2 space-y-0.5">
              {menuLinks.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className={itemClasses}>
                    <Icon aria-hidden className="size-4 text-primary" />
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <button type="button" className={itemClasses} onClick={() => setNotice(t.menu.reassignDemo)}>
                  <UserCog aria-hidden className="size-4 text-fg-muted" />
                  {t.menu.reassign}
                </button>
              </li>
              <li>
                <button type="button" className={itemClasses} onClick={() => setNotice(t.menu.revokeDemo)}>
                  <ShieldOff aria-hidden className="size-4 text-fg-muted" />
                  {t.menu.revoke}
                </button>
              </li>
            </ul>
          )}
        </div>
      ) : null}

      <div className="mx-auto flex max-w-3xl items-stretch gap-2 px-4 py-2 lg:max-w-none lg:flex-wrap lg:p-0">
        {phone && !callBlockedHintId ? (
          <a href={telHref(phone)} className={cn(stickyActionClasses, primaryAction)}>
            <Phone aria-hidden className="size-5 lg:size-4" />
            {t.call}
          </a>
        ) : phone ? (
          <button
            type="button"
            disabled
            aria-describedby={callBlockedHintId}
            title={t.callBlocked}
            className={cn(stickyActionClasses, primaryAction, "opacity-50")}
          >
            <Phone aria-hidden className="size-5 lg:size-4" />
            {t.call}
          </button>
        ) : null}
        <button
          ref={taskRef}
          type="button"
          aria-expanded={panel === "task"}
          aria-controls={panel === "task" ? panelId : undefined}
          onClick={() => toggle("task")}
          className={cn(stickyActionClasses, phone ? secondaryAction : primaryAction)}
        >
          <ListPlus aria-hidden className="size-5 lg:size-4" />
          {t.task}
        </button>
        <button
          ref={moreRef}
          type="button"
          aria-expanded={panel === "more"}
          aria-controls={panel === "more" ? panelId : undefined}
          onClick={() => toggle("more")}
          className={cn(stickyActionClasses, secondaryAction)}
        >
          <Ellipsis aria-hidden className="size-5 lg:size-4" />
          {t.more}
        </button>
      </div>
    </div>
  );
}
