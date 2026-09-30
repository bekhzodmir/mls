import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/**
 * Card section of the Deal Workspace with an anchor id, so unmet
 * prerequisites can link straight to the place where they are fixed.
 * No hooks: shared by server sections and client islands.
 */
export function DealSection({
  id,
  title,
  icon: Icon,
  hint,
  action,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-20", className)}>
      <Card className="space-y-3 p-4">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <h2 id={`${id}-title`} className="flex items-center gap-2 text-h2 text-fg">
              {Icon ? <Icon aria-hidden className="size-5 shrink-0 text-fg-muted" /> : null}
              {title}
            </h2>
            {hint ? <p className="text-caption text-fg-muted">{hint}</p> : null}
          </div>
          {action}
        </header>
        {children}
      </Card>
    </section>
  );
}
