import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger";
type Size = "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-card",
  secondary: "bg-surface text-fg border border-border hover:bg-surface-muted",
  soft: "bg-primary-soft text-primary-soft-fg hover:brightness-95",
  ghost: "text-fg hover:bg-surface-muted",
  danger: "bg-danger-bg text-danger-fg border border-danger-border hover:brightness-95",
};

// Every size keeps the 44px minimum touch target (§20.2); lg is the preferred 48px.
const sizes: Record<Size, string> = {
  md: "h-11 px-4 gap-2 text-small font-semibold",
  lg: "h-12 px-5 gap-2 text-body font-semibold",
  icon: "size-11 justify-center",
};

/**
 * A display utility of the caller's own ("hidden lg:inline-flex") replaces the
 * default `inline-flex`. Both would otherwise sit on the element and the one
 * later in the generated CSS wins: `hidden` loses to `inline-flex`.
 */
const ownDisplay = /(?:^|\s)(?:hidden|flex|inline-flex|block|inline-block|grid)(?:\s|$)/;

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    !ownDisplay.test(className ?? "") && "inline-flex",
    "shrink-0 items-center justify-center rounded-md transition-colors",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

/** Plain anchor for external targets such as Telegram or tel: links. */
export function ButtonAnchor({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"a"> & { variant?: Variant; size?: Size }) {
  return <a className={buttonClasses(variant, size, className)} {...props} />;
}
