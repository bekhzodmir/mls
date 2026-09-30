"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck, Flag, FlaskConical, ListPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import tasks from "@/i18n/messages/tasks";
import type { Task } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

export interface ClientOption {
  id: string;
  name: string;
}

interface DraftTask {
  id: string;
  title: string;
  dueAt: string;
  priority: Task["priority"];
  clientName?: string;
}

type Field = "title" | "date" | "time";

/** Tashkent has a fixed +05:00 offset (no daylight saving). */
function tashkentIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:00`).toISOString();
}

const inputClass =
  "h-12 w-full rounded-md border bg-surface px-3 text-body text-fg placeholder:text-fg-subtle aria-invalid:border-danger-border";

/**
 * Demo "new task" form (§14.8). Nothing is sent anywhere: a valid task is
 * added to this tab's local state and the screen says so plainly, instead of
 * pretending a save happened (§36.6).
 */
export function TaskForm({
  locale,
  clients,
  today,
  defaultClientId,
}: {
  locale: Locale;
  clients: ClientOption[];
  /** Tashkent calendar date "YYYY-MM-DD" from the app clock, so SSR and hydration agree. */
  today: string;
  defaultClientId?: string;
}) {
  const t = tasks[locale].form;
  const tt = tasks[locale];
  const baseId = useId();
  const ids = {
    title: `${baseId}-title`,
    date: `${baseId}-date`,
    time: `${baseId}-time`,
    client: `${baseId}-client`,
  };
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("18:00");
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [created, setCreated] = useState<DraftTask[]>([]);
  const [lastTitle, setLastTitle] = useState<string>();

  function validate(): Partial<Record<Field, string>> {
    const next: Partial<Record<Field, string>> = {};
    if (title.trim().length < 3) next.title = t.titleError;
    // ISO dates compare correctly as strings.
    if (!date || date < today) next.date = t.dateError;
    if (!time) next.time = t.timeError;
    return next;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    // Focus the first invalid field in visual order.
    const first = found.title ? titleRef : found.date ? dateRef : found.time ? timeRef : undefined;
    if (first) {
      setLastTitle(undefined);
      first.current?.focus();
      return;
    }
    const cleanTitle = title.trim();
    const draft: DraftTask = {
      id: `demo-task-${created.length + 1}`,
      title: cleanTitle,
      dueAt: tashkentIso(date, time),
      priority,
    };
    const client = clients.find((option) => option.id === clientId);
    if (client) draft.clientName = client.name;
    setCreated((list) => [draft, ...list]);
    setLastTitle(cleanTitle);
    setTitle("");
    titleRef.current?.focus();
  }

  const errorCount = Object.keys(errors).length;
  const describedBy = (field: Field, hint?: string) =>
    [hint, errors[field] ? `${ids[field]}-error` : undefined].filter(Boolean).join(" ") || undefined;

  const fieldError = (field: Field) =>
    errors[field] ? (
      <p id={`${ids[field]}-error`} className="flex items-start gap-1.5 text-caption font-medium text-danger-fg">
        <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
        {errors[field]}
      </p>
    ) : null;

  return (
    <div className="space-y-5">
      <Notice kind="warning" title={t.demoTitle}>
        {t.demo}
      </Notice>

      <div role="status" aria-live="polite">
        {lastTitle ? (
          <Notice kind="info" title={format(t.success, { title: lastTitle })} />
        ) : null}
      </div>

      <form noValidate onSubmit={onSubmit} className="space-y-5">
        {errorCount > 0 ? (
          <Notice kind="danger" title={format(t.errorSummary, { n: errorCount })} />
        ) : null}

        <Card className="space-y-5 p-4">
          <div className="space-y-1.5">
            <label htmlFor={ids.title} className="block text-small font-semibold text-fg">
              {t.title}
            </label>
            <input
              ref={titleRef}
              id={ids.title}
              name="title"
              required
              maxLength={200}
              autoComplete="off"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t.titlePlaceholder}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={describedBy("title")}
              className={cn(inputClass, "border-border-strong")}
            />
            {fieldError("title")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={ids.date} className="block text-small font-semibold text-fg">
                {t.date}
              </label>
              <input
                ref={dateRef}
                id={ids.date}
                name="date"
                type="date"
                required
                min={today}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                aria-invalid={errors.date ? true : undefined}
                aria-describedby={describedBy("date")}
                className={cn(inputClass, "border-border-strong")}
              />
              {fieldError("date")}
            </div>
            <div className="space-y-1.5">
              <label htmlFor={ids.time} className="block text-small font-semibold text-fg">
                {t.time}
              </label>
              <input
                ref={timeRef}
                id={ids.time}
                name="time"
                type="time"
                required
                step={300}
                value={time}
                onChange={(event) => setTime(event.target.value)}
                aria-invalid={errors.time ? true : undefined}
                aria-describedby={describedBy("time", `${ids.time}-hint`)}
                className={cn(inputClass, "border-border-strong")}
              />
              <p id={`${ids.time}-hint`} className="text-caption text-fg-muted">
                {t.timeHint}
              </p>
              {fieldError("time")}
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-small font-semibold text-fg">{t.priority}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["normal", "high"] as const).map((value) => (
                <label
                  key={value}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-2 rounded-md border px-3 text-small font-medium has-focus-visible:outline-2 has-focus-visible:outline-ring",
                    priority === value
                      ? "border-primary bg-primary-soft text-primary-soft-fg"
                      : "border-border-strong bg-surface text-fg",
                  )}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={value}
                    checked={priority === value}
                    onChange={() => setPriority(value)}
                    className="size-4 accent-primary"
                  />
                  {value === "high" ? <Flag aria-hidden className="size-4" /> : null}
                  {tt.priority[value]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor={ids.client} className="block text-small font-semibold text-fg">
              {t.client} <span className="font-normal text-fg-muted">· {t.clientHint}</span>
            </label>
            <select
              id={ids.client}
              name="clientId"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className={cn(inputClass, "border-border-strong")}
            >
              <option value="">{t.clientNone}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Sticky above the bottom navigation on phones; the shell hides the "+" meanwhile. */}
        <div data-sticky-actions className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
          <Button type="submit" size="lg" className="w-full lg:w-auto">
            <ListPlus aria-hidden className="size-5" />
            {t.submit}
          </Button>
        </div>
      </form>

      <section aria-labelledby={`${baseId}-session`} className="space-y-2">
        <h2 id={`${baseId}-session`} className="flex items-center gap-2 text-h2 text-fg">
          <FlaskConical aria-hidden className="size-5 text-fg-muted" />
          {t.sessionTitle} <span className="tabular text-fg-muted">{created.length}</span>
        </h2>
        {created.length === 0 ? (
          <p className="text-small text-fg-muted">{t.sessionEmpty}</p>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {created.map((task) => (
                <li key={task.id} className="flex items-start gap-3 px-4 py-3">
                  <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-fg-muted" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-small font-semibold text-fg">{task.title}</p>
                    <p className="text-caption text-fg-muted">
                      {format(tt.due, { date: formatDateTime(locale, task.dueAt) })}
                      {task.clientName ? ` · ${task.clientName}` : null}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="warning" icon={FlaskConical}>
                        {t.notSaved}
                      </Badge>
                      {task.priority === "high" ? (
                        <Badge tone="warning" icon={Flag}>
                          {tt.priority.high}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
