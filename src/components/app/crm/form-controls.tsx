import { Check, CircleAlert } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/cn";

/**
 * Form building blocks for the CRM forms (§20.7): labelled inputs, segmented
 * radios and toggle chips. Presentational only — the owning client component
 * keeps the state. Every control is at least 44px tall and shows focus.
 */

export const inputClasses = cn(
  "h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-body text-fg shadow-card",
  "placeholder:text-fg-subtle focus-visible:border-primary aria-invalid:border-danger-fg",
);

export const textareaClasses = cn(
  "w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2.5 text-body text-fg shadow-card",
  "placeholder:text-fg-subtle focus-visible:border-primary aria-invalid:border-danger-fg",
);

export function FieldLabel({
  htmlFor,
  children,
  optional,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  optional?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("flex items-baseline gap-2 text-small font-semibold text-fg", className)}>
      {children}
      {optional ? <span className="text-caption font-normal text-fg-muted">{optional}</span> : null}
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

/** Radio group styled as a segmented control; `value === undefined` means "not chosen yet". */
export function SegmentedRadio<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  invalid,
  describedBy,
  legendClassName,
  className,
}: {
  name: string;
  legend: ReactNode;
  options: { value: T; label: ReactNode }[];
  value: T | undefined;
  onChange: (value: T) => void;
  invalid?: boolean;
  describedBy?: string;
  legendClassName?: string;
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0 space-y-2", className)} aria-describedby={describedBy}>
      <legend className={cn("text-small font-semibold text-fg", legendClassName)}>{legend}</legend>
      <div
        className={cn(
          "inline-flex max-w-full flex-wrap gap-1 rounded-md border bg-surface-muted p-1",
          invalid ? "border-danger-fg" : "border-border",
        )}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "relative inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-sm px-4 text-small font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                checked ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {checked ? <Check aria-hidden className="size-4" /> : null}
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Checkbox styled as a chip for multi-select (districts, types, renovation). */
export function ToggleChip({
  checked,
  onChange,
  children,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  /** Secondary text, e.g. the district's name in the other language. */
  hint?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-small font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
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
      {hint ? <span className="text-caption font-normal opacity-75">{hint}</span> : null}
    </label>
  );
}

/** A labelled checkbox row with a 44px hit area. */
export function CheckboxRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-small text-fg">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 shrink-0 accent-primary"
      />
      <span>{children}</span>
    </label>
  );
}

/** Screen reader summary of what is wrong, with links to each field. */
export function ErrorSummary({
  title,
  errors,
  summaryRef,
}: {
  title: string;
  errors: { id: string; text: string }[];
  summaryRef: RefObject<HTMLDivElement | null>;
}) {
  if (errors.length === 0) return null;
  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      role="alert"
      className="rounded-md border border-danger-border bg-danger-bg p-3 text-small text-danger-fg"
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {errors.map((error) => (
          <li key={error.id}>
            <a href={`#${error.id}`} className="underline underline-offset-2">
              {error.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
