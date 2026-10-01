import { Check, CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Form pieces for the sign-in and onboarding screens (§20.7): labelled
 * fields, inline errors with an icon (never colour alone), radio cards and
 * toggle chips. Presentational only; the owning client component keeps the
 * state. Every control has a 44px+ hit area and a visible focus ring.
 */

export { inputClasses } from "@/components/ui/field";

export function FieldLabel({
  htmlFor,
  id,
  children,
  optional,
  tag,
}: {
  htmlFor?: string;
  id?: string;
  children: ReactNode;
  /** "необязательно" — shown muted after the label. */
  optional?: string;
  /** A badge after the label, e.g. "введено вами, не проверено". */
  tag?: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      id={id}
      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-small font-semibold text-fg"
    >
      <span>{children}</span>
      {optional ? <span className="text-caption font-normal text-fg-muted">{optional}</span> : null}
      {tag}
    </label>
  );
}

export function FieldHint({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} className={cn("text-caption text-fg-muted", className)}>
      {children}
    </p>
  );
}

/** Inline error under a field; the icon keeps it readable without colour. */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-caption font-medium text-danger-fg">
      <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Positive confirmation under a field ("Номер распознан: …"). */
export function FieldValid({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-caption font-medium text-success-fg">
      <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Joins the ids of the hint/error elements that describe a control. */
export function describedBy(...ids: (string | false | null | undefined)[]): string | undefined {
  const list = ids.filter(Boolean);
  return list.length > 0 ? list.join(" ") : undefined;
}

/**
 * One option of a radio group drawn as a card. The selected state is shown
 * by a filled circle with a check mark and a border, not by colour alone.
 * The title names the option; the description is attached as a description.
 */
export function ChoiceCard({
  id,
  name,
  checked,
  onSelect,
  title,
  description,
  errorId,
}: {
  id: string;
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** The group's error message, so it is read when an option gets focus. */
  errorId?: string;
}) {
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
        checked ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-muted",
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        aria-labelledby={titleId}
        aria-describedby={describedBy(descriptionId, errorId)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          checked ? "border-primary bg-primary text-primary-fg" : "border-border-strong bg-surface",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0">
        <span id={titleId} className="block text-body font-semibold text-fg">
          {title}
        </span>
        {description ? (
          <span id={descriptionId} className="mt-0.5 block text-small text-fg-muted">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** Checkbox drawn as a chip for multi-select (districts, property types, languages). */
export function ToggleChip({
  checked,
  onChange,
  children,
  lang,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  lang?: string;
}) {
  return (
    <label
      lang={lang}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-small font-medium transition-colors",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
        checked
          ? "border-primary bg-primary-soft text-primary-soft-fg"
          : "border-border bg-surface text-fg hover:bg-surface-muted",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      {checked ? <Check aria-hidden className="size-4 shrink-0" /> : null}
      <span>{children}</span>
    </label>
  );
}

/** Decorative spinner; the accompanying text carries the meaning. */
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cn("size-5 shrink-0 animate-spin motion-reduce:animate-none", className)} />;
}
