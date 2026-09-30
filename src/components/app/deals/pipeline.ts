import type { DealView } from "@/lib/data/views";
import { dealStages, type DealStage, type ID, type Money } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * Deal pipeline logic (§11.7, §22.12): the stage filter in the URL, stage
 * grouping in pipeline order and the stepper states. Pure data in, data out.
 */

type SearchParams = Record<string, string | string[] | undefined>;

/** `?stage=` if it names a stage; anything else means "all stages". */
export function parseDealStage(search: SearchParams): DealStage | undefined {
  const raw = Array.isArray(search.stage) ? search.stage[0] : search.stage;
  return raw !== undefined && (dealStages as readonly string[]).includes(raw) ? (raw as DealStage) : undefined;
}

export function dealListHref(locale: string, stage?: DealStage): string {
  return `${appPath(locale, "/deals")}${stage ? `?${new URLSearchParams({ stage })}` : ""}`;
}

export function dealHref(locale: string, id: ID): string {
  return appPath(locale, `/deals/${encodeURIComponent(id)}`);
}

export interface StageGroup {
  stage: DealStage;
  views: DealView[];
}

/** Every stage in pipeline order, empty ones included, deals kept in input order. */
export function groupByStage(views: readonly DealView[]): StageGroup[] {
  return dealStages.map((stage) => ({ stage, views: views.filter((view) => view.deal.stage === stage) }));
}

export function stageIndex(stage: DealStage): number {
  return dealStages.indexOf(stage);
}

export type StepState = "done" | "current" | "upcoming";

export interface Step {
  stage: DealStage;
  state: StepState;
  /** 1-based position for "Этап 3 из 10". */
  position: number;
}

export function stageSteps(current: DealStage): Step[] {
  const at = stageIndex(current);
  return dealStages.map((stage, index) => ({
    stage,
    position: index + 1,
    state: index < at ? "done" : index === at ? "current" : "upcoming",
  }));
}

/**
 * The price a card leads with: the agreed price once recorded, otherwise
 * the listing's asking price — labelled so one is never read as the other.
 */
export function headlinePrice(view: Pick<DealView, "deal" | "listing">): { kind: "agreed" | "asking"; value: Money } {
  return view.deal.agreedPrice
    ? { kind: "agreed", value: view.deal.agreedPrice }
    : { kind: "asking", value: view.listing.listing.price };
}

/** A due date that has passed; no due date is never overdue. */
export function isOverdue(dueAt: string | undefined, now: Date): boolean {
  return dueAt !== undefined && Date.parse(dueAt) < now.getTime();
}
