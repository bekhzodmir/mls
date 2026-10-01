import type { ReactNode } from "react";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import team from "@/i18n/messages/team";
import type { AccessExplanation } from "./access";
import { accessText } from "./access-text";

/**
 * Permission denied, explained (§19 last paragraph, §23.5, §36.6): the
 * role's level, what is needed, who holds it, who grants or changes it, and
 * the safe step available now — instead of a hidden button or a bare 403.
 */
export function PermissionNote({
  locale,
  explanation,
  need,
  next,
  action,
  className,
}: {
  locale: Locale;
  explanation: AccessExplanation;
  /** Overrides the generic "what is needed" line (e.g. the export permission). */
  need?: string;
  /** The safe next step in words. */
  next?: ReactNode;
  /** A link or button for that step. */
  action?: ReactNode;
  className?: string;
}) {
  const { title, lines } = accessText(locale, explanation, need);
  return (
    <Notice kind="permission" title={title} action={action} className={className}>
      <ul className="space-y-0.5">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {next ? (
        <p className="pt-1">
          <span className="font-semibold">{team[locale].access.next}</span> {next}
        </p>
      ) : null}
    </Notice>
  );
}
