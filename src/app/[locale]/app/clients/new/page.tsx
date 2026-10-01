import type { Metadata } from "next";
import { MessageSquareQuote } from "lucide-react";
import { contactCard } from "@/components/app/crm/duplicates";
import { firstParam } from "@/components/app/crm/filters";
import { NewClientForm, type NewClientInitial } from "@/components/app/crm/new-client-form";
import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import clients from "@/i18n/messages/clients";
import leads from "@/i18n/messages/leads";
import { getLocale } from "@/i18n/server";
import { getLead, listClients } from "@/lib/data/repository";
import { formatUzPhone } from "@/lib/domain/phone";
import { appHref, appPath } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: clients[locale].meta.newTitle };
}

/**
 * New client (§21.4 #19, §35.3 step 6). `?leadId=` prefills the form from
 * the lead; the lead is not deleted and stays in the inbox history.
 * `?phone=` (e.g. from a call) fills the number when the lead has none, and
 * without a lead also sets the source to "phone".
 */
export default async function NewClientPage({ searchParams }: PageProps<"/[locale]/app/clients/new">) {
  const locale = await getLocale();
  const t = clients[locale].form;
  const params = await searchParams;
  const leadId = firstParam(params.leadId);
  const phoneParam = firstParam(params.phone)?.slice(0, 32);
  const [leadView, all] = await Promise.all([leadId ? getLead(leadId) : undefined, listClients()]);
  const lead = leadView?.lead;

  const initial: NewClientInitial = {};
  if (lead) {
    initial.leadId = lead.id;
    initial.source = lead.source;
    initial.language = lead.language;
    if (lead.name) initial.name = lead.name;
    if (lead.phone) initial.phone = formatUzPhone(lead.phone);
    if (lead.telegramUsername) initial.telegram = lead.telegramUsername;
  }
  if (!initial.phone && phoneParam) {
    initial.phone = formatUzPhone(phoneParam);
    if (!lead) initial.source = "phone";
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        locale={locale}
        backHref={lead ? appPath(locale, `/leads/${encodeURIComponent(lead.id)}`) : appHref(locale, "clients")}
        title={t.title}
        subtitle={t.subtitle}
      />

      {lead ? (
        <Notice
          kind="info"
          title={format(t.fromLead, { name: lead.name ?? leads[locale].card.noName })}
          className="mb-5"
        >
          <p>{t.fromLeadText}</p>
          <blockquote className="mt-2 flex gap-2 italic">
            <MessageSquareQuote aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span lang={lead.language === "uz" ? "uz-Latn" : "ru"}>{lead.message}</span>
          </blockquote>
        </Notice>
      ) : leadId ? (
        <Notice kind="warning" className="mb-5">
          {t.leadNotFound}
        </Notice>
      ) : null}

      <NewClientForm locale={locale} clients={all.map((item) => contactCard(item.client))} initial={initial} />
    </div>
  );
}
