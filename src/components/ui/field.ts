import { cn } from "@/lib/cn";

/*
 * Shared text-field styles for <input>, <select> and <textarea> (§20.7).
 * 44px tall, visible focus, a red border when `aria-invalid` is set. The
 * text is 16px on purpose: iOS (and the Telegram Mini App on iPhone) zooms
 * the page into any field whose font is smaller.
 */

export const inputClasses = cn(
  "h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-body text-fg shadow-card",
  "placeholder:text-fg-subtle focus-visible:border-primary aria-invalid:border-danger-fg",
);

export const textareaClasses = cn(
  "w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2.5 text-body text-fg shadow-card",
  "placeholder:text-fg-subtle focus-visible:border-primary aria-invalid:border-danger-fg",
);
