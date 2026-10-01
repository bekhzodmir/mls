import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-neutral-bg text-neutral-fg border-neutral-border",
  brand: "bg-primary-soft text-primary-soft-fg border-transparent",
  success: "bg-success-bg text-success-fg border-success-border",
  warning: "bg-warning-bg text-warning-fg border-warning-border",
  danger: "bg-danger-bg text-danger-fg border-danger-border",
  info: "bg-info-bg text-info-fg border-info-border",
};

/**
 * Status pill. Pass an `icon` for any semantic tone so meaning never relies on
 * colour alone (§20.6, WCAG 1.4.1).
 *
 * Short labels stay on one line and truncate. Pass `wrap` for long labels whose
 * end carries the meaning ("Сертификат: Не удалось проверить"): they wrap on a
 * narrow screen instead of cutting off the status.
 */
export function Badge({
  tone = "neutral",
  icon: Icon,
  children,
  className,
  title,
  wrap = false,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  title?: string;
  wrap?: boolean;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full gap-1 rounded-sm border px-2 py-0.5 text-caption font-medium",
        wrap ? "items-start" : "items-center whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {Icon ? (
        <Icon aria-hidden className={cn("size-3.5 shrink-0", wrap && "mt-px")} strokeWidth={2.25} />
      ) : null}
      <span className={wrap ? "min-w-0 break-words" : "truncate"}>{children}</span>
    </span>
  );
}
