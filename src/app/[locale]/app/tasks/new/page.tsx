import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { listHref } from "@/components/app/today/links";
import tasks from "@/i18n/messages/tasks";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { listClients } from "@/lib/data/repository";
import { tashkentDateKey } from "@/lib/domain/working-days";
import { TaskForm } from "./task-form";
import { compareText } from "@/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: tasks[locale].meta.newTitle };
}

/** New task (§14.8): a demo form; `?clientId=` preselects one of the viewer's clients. */
export default async function NewTaskPage({ searchParams }: PageProps<"/[locale]/app/tasks/new">) {
  const locale = await getLocale();
  const { clientId } = await searchParams;
  const clients = (await listClients())
    .map(({ client }) => ({ id: client.id, name: client.name }))
    .sort((a, b) => compareText(locale, a.name, b.name));
  // Only a client the viewer can see may be preselected; anything else is ignored.
  const preselected = clients.find((client) => client.id === clientId)?.id;

  return (
    <div>
      <PageHeader locale={locale} title={tasks[locale].meta.newTitle} backHref={listHref(locale, "/tasks")} />
      <TaskForm locale={locale} clients={clients} today={tashkentDateKey(now())} defaultClientId={preselected} />
    </div>
  );
}
