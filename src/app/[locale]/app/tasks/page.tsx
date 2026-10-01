import type { Metadata } from "next";
import { ListPlus, ListTodo } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FeedList } from "@/components/app/today/feed-row";
import { listHref } from "@/components/app/today/links";
import { taskRow } from "@/components/app/today/rows";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import tasks from "@/i18n/messages/tasks";
import { getLocale } from "@/i18n/server";
import { listTasks } from "@/lib/data/repository";
import type { TaskState, TaskView } from "@/lib/data/views";

/** Sections in working order: late first, finished last. Also the `?status=` values. */
const taskStates: readonly TaskState[] = ["overdue", "today", "upcoming", "snoozed", "done"];

function isTaskState(value: unknown): value is TaskState {
  return typeof value === "string" && (taskStates as readonly string[]).includes(value);
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: tasks[locale].meta.title };
}

function TaskSection({ locale, state, items }: { locale: Locale; state: TaskState; items: TaskView[] }) {
  const id = `tasks-${state}`;
  return (
    <section aria-labelledby={id}>
      <Card className="overflow-hidden">
        <h2 id={id} className="px-4 pt-4 pb-2 text-h2 text-fg">
          {tasks[locale].section[state]} <span className="tabular text-fg-muted">{items.length}</span>
        </h2>
        <FeedList rows={items.map((view) => taskRow(locale, view))} />
      </Card>
    </section>
  );
}

/** The viewer's tasks (§14.8, §36.2), grouped overdue → today → upcoming → snoozed → done. */
export default async function TasksPage({ searchParams }: PageProps<"/[locale]/app/tasks">) {
  const locale = await getLocale();
  const t = tasks[locale];
  const { status } = await searchParams;
  const filter = isTaskState(status) ? status : undefined;

  const all = await listTasks();
  const count = (state: TaskState) => all.filter((view) => view.state === state).length;
  const open = all.filter((view) => view.task.status === "open").length;
  const sections = taskStates
    .filter((state) => !filter || state === filter)
    .map((state) => ({ state, items: all.filter((view) => view.state === state) }))
    .filter((section) => section.items.length > 0);

  const newTask = (
    <ButtonLink href={listHref(locale, "/tasks/new")}>
      <ListPlus aria-hidden className="size-4" />
      {t.new}
    </ButtonLink>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        locale={locale}
        title={t.title}
        subtitle={format(t.summary, { open, overdue: count("overdue") })}
        actions={newTask}
        className="mb-0"
      />

      <nav aria-label={t.filter.label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          <li>
            <ChipLink href={listHref(locale, "/tasks")} active={!filter}>
              {t.filter.all} <span className="tabular">{all.length}</span>
            </ChipLink>
          </li>
          {taskStates.map((state) => (
            <li key={state}>
              <ChipLink href={listHref(locale, "/tasks", { status: state })} active={filter === state}>
                {t.section[state]} <span className="tabular">{count(state)}</span>
              </ChipLink>
            </li>
          ))}
        </ul>
      </nav>

      {sections.length > 0 ? (
        sections.map((section) => (
          <TaskSection key={section.state} locale={locale} state={section.state} items={section.items} />
        ))
      ) : filter ? (
        <EmptyState
          icon={ListTodo}
          title={format(t.empty.filteredTitle, { section: t.section[filter] })}
          description={t.empty.filteredText}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ChipLink href={listHref(locale, "/tasks")}>{t.empty.reset}</ChipLink>
              {newTask}
            </div>
          }
        />
      ) : (
        <EmptyState icon={ListTodo} title={t.empty.title} description={t.empty.text} action={newTask} />
      )}
    </div>
  );
}
