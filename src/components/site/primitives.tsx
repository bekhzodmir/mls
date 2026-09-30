import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Layout building blocks for the public site. Pages stay calm and readable:
 * one content width, generous vertical rhythm, violet only as an accent
 * (§20.5) — a soft glow behind page intros rather than full-bleed gradients.
 */

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

/** Underlined inline link that keeps AA contrast in both themes. */
export const textLinkClass =
  "font-medium text-primary-soft-fg underline decoration-primary/40 underline-offset-4 hover:decoration-primary";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-small font-semibold text-primary-soft-fg", className)}>{children}</p>;
}

/** Decorative violet glow for intros; sits behind content inside an `isolate` parent. */
export function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10",
        "bg-[radial-gradient(56rem_28rem_at_90%_-10%,var(--primary-soft),transparent_70%)]",
        className,
      )}
    />
  );
}

/**
 * Top block of an inner page: the page's only `<h1>`, a lead paragraph and
 * optional actions.
 */
export function PageIntro({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      <Glow />
      <Container className="py-12 sm:py-16 lg:py-20">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-3 max-w-3xl text-display text-balance text-fg lg:text-[2.75rem]">{title}</h1>
        {lead ? <p className="mt-4 max-w-2xl text-body text-pretty text-fg-muted sm:text-lg">{lead}</p> : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </Container>
    </section>
  );
}

/**
 * A page section with an `<h2>` that also labels the landmark. `muted` gives
 * alternating bands so long pages stay scannable.
 */
export function Section({
  id,
  eyebrow,
  title,
  lead,
  muted,
  children,
  className,
}: {
  id: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  muted?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-20 py-14 sm:py-20", muted && "border-y border-border bg-surface-muted/60", className)}
    >
      <Container>
        <div className="max-w-2xl">
          {eyebrow ? <Eyebrow className="mb-2">{eyebrow}</Eyebrow> : null}
          <h2 id={headingId} className="text-h1 text-balance text-fg sm:text-[2rem]">
            {title}
          </h2>
          {lead ? <p className="mt-3 text-body text-pretty text-fg-muted">{lead}</p> : null}
        </div>
        {children ? <div className="mt-8 sm:mt-10">{children}</div> : null}
      </Container>
    </section>
  );
}

/** Closing call to action: a soft violet panel with a heading and buttons. */
export function CtaBand({
  id,
  title,
  text,
  children,
}: {
  id: string;
  title: ReactNode;
  text?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="py-14 sm:py-20">
      <Container>
        <div className="rounded-xl border border-border bg-primary-soft px-5 py-10 text-center sm:px-10 sm:py-14">
          <h2 id={id} className="text-h1 text-balance text-primary-soft-fg">
            {title}
          </h2>
          {text ? <p className="mx-auto mt-3 max-w-xl text-body text-pretty text-fg-muted">{text}</p> : null}
          <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {children}
          </div>
        </div>
      </Container>
    </section>
  );
}

/** Round icon tile used on feature cards. */
export function IconTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}
