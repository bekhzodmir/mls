"use client";

import { useId, useState } from "react";
import { Brain, Pencil, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDate } from "@/i18n/format";
import clients from "@/i18n/messages/clients";
import type { Client } from "@/lib/domain/types";
import { FieldError, textareaClasses } from "./form-controls";

type MemoryItem = Client["memory"][number];

/**
 * AI Client Memory (§14.5): each remembered preference shows where it came
 * from and when, and the agent can correct or remove it. Edits are demo-only
 * local state and say so.
 */
export function ClientMemory({ locale, items }: { locale: Locale; items: MemoryItem[] }) {
  const t = clients[locale].memory;
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; draft: string; error?: boolean }>();
  const [lastRemoved, setLastRemoved] = useState<MemoryItem>();
  const fieldId = useId();

  const visible = items.filter((item) => !removed.includes(item.id));

  if (visible.length === 0 && !lastRemoved) {
    return (
      <p className="rounded-lg border border-dashed border-border-strong p-4 text-small text-fg-muted">{t.empty}</p>
    );
  }

  return (
    <div className="space-y-3">
      <div aria-live="polite">
        {lastRemoved ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-muted p-3 text-small text-fg">
            <p>{format(t.removed, { text: edits[lastRemoved.id] ?? lastRemoved.text })}</p>
            <Button
              variant="ghost"
              onClick={() => {
                setRemoved((ids) => ids.filter((id) => id !== lastRemoved.id));
                setLastRemoved(undefined);
              }}
            >
              <Undo2 aria-hidden className="size-4" />
              {t.undo}
            </Button>
          </div>
        ) : null}
      </div>
      <ul className="space-y-2">
        {visible.map((item) => {
          const text = edits[item.id] ?? item.text;
          const isEditing = editing?.id === item.id;
          return (
            <li key={item.id} className="rounded-lg border border-border bg-surface p-3 shadow-card">
              {isEditing ? (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const draft = editing.draft.trim();
                    if (!draft) {
                      setEditing({ ...editing, error: true });
                      return;
                    }
                    setEdits((all) => ({ ...all, [item.id]: draft }));
                    setEditing(undefined);
                  }}
                >
                  <label htmlFor={`${fieldId}-${item.id}`} className="sr-only">
                    {t.editLabel}
                  </label>
                  <textarea
                    id={`${fieldId}-${item.id}`}
                    rows={2}
                    value={editing.draft}
                    aria-invalid={editing.error || undefined}
                    onChange={(event) => setEditing({ id: item.id, draft: event.target.value })}
                    className={textareaClasses}
                  />
                  {editing.error ? <FieldError>{t.emptyError}</FieldError> : null}
                  <div className="flex gap-2">
                    <Button type="submit" variant="secondary">
                      {t.save}
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(undefined)}>
                      {t.cancel}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  <Brain aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-small text-fg">{text}</p>
                    <p className="text-caption text-fg-muted">
                      {format(t.source, { source: item.source })} ·{" "}
                      <time dateTime={item.at}>{formatDate(locale, item.at)}</time>
                    </p>
                    {edits[item.id] ? <p className="text-caption font-medium text-warning-fg">{t.edited}</p> : null}
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing({ id: item.id, draft: text })}
                      aria-label={`${t.edit}: ${text}`}
                    >
                      <Pencil aria-hidden className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setRemoved((ids) => [...ids, item.id]);
                        setLastRemoved(item);
                      }}
                      aria-label={`${t.remove}: ${text}`}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
