import { Check, CircleAlert } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/cn";

/**
 * Small form building blocks shared by the viewing and deal forms (§20.7):
 * labelled inputs, inline errors, radio rows and an error summary. Purely
 * presentational — the owning client component keeps the state. Every
 * control is at least 44px tall and shows a visible focus ring.
 */

export { inputClasses, textareaClasses } from "@/components/ui/field";

export function Label({
  htmlFor,
  children,
  note,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  /** "обязательно" / "необязательно" next to the label. */
  note?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("flex flex-wrap items-baseline gap-x-2 text-small font-semibold text-fg", className)}>
      {children}
      {note ? <span className="text-caption font-normal text-fg-muted">{note}</span> : null}
    </label>
  );
}

export function Hint({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} className={cn("text-caption text-fg-muted", className)}>
      {children}
    </p>
  );
}

/** Inline error under a field; the icon keeps it readable without colour. */
export function InlineError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-caption font-medium text-danger-fg">
      <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Radio options as full-width rows with a 44px hit area and a check mark on the chosen one. */
export function RadioRows<T extends string>({
  name,
  legend,
  note,
  options,
  value,
  onChange,
  invalid,
  describedBy,
  className,
}: {
  name: string;
  legend: ReactNode;
  note?: string;
  options: { value: T; label: ReactNode }[];
  value: T | undefined;
  onChange: (value: T) => void;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0 space-y-1.5", className)} aria-describedby={describedBy}>
      <legend className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-small font-semibold text-fg">
        {legend}
        {note ? <span className="text-caption font-normal text-fg-muted">{note}</span> : null}
      </legend>
      <div className={cn("space-y-1 rounded-md border p-1", invalid ? "border-danger-fg" : "border-border")}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 text-small transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                checked ? "bg-primary-soft font-semibold text-primary-soft-fg" : "text-fg hover:bg-surface-muted",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="size-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="min-w-0 flex-1">{option.label}</span>
              {checked ? <Check aria-hidden className="size-4 shrink-0" /> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A labelled checkbox row with a 44px hit area. */
export function CheckRow({
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
        className="size-5 shrink-0 accent-[var(--primary)]"
      />
      <span>{children}</span>
    </label>
  );
}

/** Summary of what is wrong, linking to each field; focused on a failed submit. */
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
