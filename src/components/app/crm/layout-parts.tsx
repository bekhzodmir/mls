import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Layout pieces shared by the CRM screens: a titled section with an anchor
 * id, and the sticky action bar of detail screens (§14.3, §22.6).
 */

export function CrmSection({
  id,
  title,
  action,
  description,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-20 space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="text-h2 text-fg">
          {title}
        </h2>
        {action}
      </div>
      {description ? <p className="text-small text-fg-muted">{description}</p> : null}
      {children}
    </section>
  );
}

/**
 * Primary actions of a detail screen. On phones the bar is fixed above the
 * bottom navigation (thumb zone, §20.2), and the shell hides the floating "+"
 * while a `data-sticky-actions` bar is on screen; from `lg` up it sits inline
 * where it is rendered. Pair
 * it with `StickyBarSpacer` at the end of the page so nothing hides behind it.
 */
export function StickyActionBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      data-sticky-actions
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 backdrop-blur lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:backdrop-blur-none"
    >
      <div className="mx-auto flex max-w-3xl items-stretch gap-2 py-2 px-4 lg:max-w-none lg:flex-wrap lg:p-0">
        {children}
      </div>
    </div>
  );
}

export function StickyBarSpacer() {
  return <div aria-hidden className="h-20 lg:hidden" />;
}

/** One action in the sticky bar: icon over a short label on phones, a regular button on desktop. */
export const stickyActionClasses =
  "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-caption font-semibold lg:min-h-11 lg:flex-none lg:flex-row lg:gap-2 lg:px-4 lg:text-small";

/** A horizontally scrolling row of filter chips (`ChipLink`s inside `<li>`s). */
export function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2 pb-1">{children}</ul>
    </nav>
  );
}

/** Count inside a chip, e.g. «Новый 3». */
export function ChipCount({ n }: { n: number }) {
  return <span className="tabular text-caption">{n}</span>;
}
