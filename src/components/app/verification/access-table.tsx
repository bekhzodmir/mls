import { CircleCheck, CircleSlash, TriangleAlert, type LucideIcon } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import verification from "@/i18n/messages/verification";
import { cn } from "@/lib/cn";
import { blockAccess, INFO_BLOCKS, type BlockAccess, type BlockVerdict, type RequesterStanding } from "./request";

const accessStyle: Record<BlockAccess, { tone: Tone; icon: LucideIcon }> = {
  allowed: { tone: "success", icon: CircleCheck },
  conditional: { tone: "warning", icon: TriangleAlert },
  not_allowed: { tone: "neutral", icon: CircleSlash },
};

export function VerdictBadge({ locale, verdict }: { locale: Locale; verdict: BlockVerdict }) {
  const { tone, icon } = accessStyle[verdict.access];
  return (
    <Badge tone={tone} icon={icon}>
      {verification[locale].request.access[verdict.access]}
    </Badge>
  );
}

const COLUMNS = ["realtor_organization", "real_estate_agent"] as const satisfies readonly RequesterStanding[];

/**
 * The §38.4 table as cards (a phone has no room for four columns): each
 * information block with its example and limitation, and the verdict for a
 * realtor organization and for a real-estate agent. The viewer's own column
 * is marked, so the difference between the two legal statuses stays visible.
 */
export function AccessTable({ locale, standing }: { locale: Locale; standing: RequesterStanding }) {
  const t = verification[locale].request;
  return (
    <ul aria-label={t.blocksLabel} className="space-y-3">
      {INFO_BLOCKS.map((block) => (
        <li key={block} className="space-y-2 rounded-md border border-border bg-surface p-3">
          <div className="space-y-0.5">
            <p className="text-small font-semibold text-fg">{t.blocks[block].name}</p>
            <p className="text-caption text-fg-muted">{t.blocks[block].example}</p>
          </div>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {COLUMNS.map((column) => {
              const verdict = blockAccess(column, block);
              const yours = column === standing;
              return (
                <div
                  key={column}
                  className={cn(
                    "space-y-1 rounded-sm p-2",
                    yours ? "border border-primary bg-primary-soft/40" : "bg-surface-muted",
                  )}
                >
                  <dt className="text-caption text-fg-muted">
                    {t.columns[column]}
                    {yours ? <span className="font-semibold text-fg"> · {t.yours}</span> : null}
                  </dt>
                  <dd className="space-y-1">
                    <VerdictBadge locale={locale} verdict={verdict} />
                    {verdict.reason ? <p className="text-caption text-fg-muted">{t.reasons[verdict.reason]}</p> : null}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="text-caption text-fg-muted">{t.blocks[block].limitation}</p>
        </li>
      ))}
    </ul>
  );
}
