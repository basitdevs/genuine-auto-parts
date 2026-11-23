import { Suspense } from "react";
import type { Metadata } from "next";
import { FilterTabs } from "@/components/admin/client";
import { ErrorNotice, fmtDate, MigrationNotice, PageHeader, Panel, TableSkeleton } from "@/components/admin/ui";
import { POLICY_META } from "@/config/policies";
import { builtInFaq } from "@/content/faq";
import { requireArea } from "@/lib/admin/access";
import { loadSettingsForAdmin } from "@/lib/settings/admin";
import { BusinessEditor, FaqEditor, HomeEditor, PolicyNumbersEditor, PolicyPagesEditor, ReviewsEditor, ShippingEditor } from "./editors";

export const metadata: Metadata = { title: "Content" };

const TABS = [
  { value: "", label: "Business info" },
  { value: "home", label: "Homepage" },
  { value: "reviews", label: "Reviews" },
  { value: "faq", label: "FAQ" },
  { value: "policies", label: "Policy pages" },
  { value: "rules", label: "Warranty, returns & shipping" },
];

async function ContentView({ searchParams }: { searchParams: PageProps<"/admin/content">["searchParams"] }) {
  const { db } = await requireArea("content", "/admin/content");
  const params = await searchParams;
  const tab = TABS.some((t) => t.value === params.tab) ? String(params.tab) : "";
  const { values, updated, missing, error } = await loadSettingsForAdmin(db);
  const stamp = (k: keyof typeof updated) => (updated[k] ? `Last saved ${fmtDate(updated[k])}` : "Using the built-in default");

  return (
    <>
      {missing ? <div className="mb-4"><MigrationNotice what="editable content" /></div> : null}
      {error ? <div className="mb-4"><ErrorNotice message={error} /></div> : null}
      <FilterTabs param="tab" tabs={TABS} />
      {tab === "" ? (
        <Panel title="Business info" description={stamp("business")}><BusinessEditor initial={values.business} customised={Boolean(updated.business)} /></Panel>
      ) : tab === "home" ? (
        <Panel title="Homepage" description={stamp("home")}><HomeEditor initial={values.home} customised={Boolean(updated.home)} /></Panel>
      ) : tab === "reviews" ? (
        <Panel title="Reviews" description={stamp("reviews")}><ReviewsEditor initial={values.reviews} customised={Boolean(updated.reviews)} /></Panel>
      ) : tab === "faq" ? (
        <Panel title="FAQ" description={stamp("faq")}>
          <FaqEditor
            initial={values.faq}
            customised={Boolean(updated.faq)}
            builtIn={{ groups: builtInFaq({ warrantyDays: values.policies.warrantyDays, returnDays: values.policies.returnDays, handlingTime: values.shipping.handlingTime, city: values.business.city, region: values.business.region }) }}
          />
        </Panel>
      ) : tab === "policies" ? (
        <Panel title="Policy pages" description={stamp("policy_pages")}><PolicyPagesEditor initial={values.policy_pages} customised={Boolean(updated.policy_pages)} builtInTitles={POLICY_META} /></Panel>
      ) : (
        <div className="grid gap-6">
          <Panel title="Warranty & returns" description={stamp("policies")}><PolicyNumbersEditor initial={values.policies} customised={Boolean(updated.policies)} /></Panel>
          <Panel title="Shipping" description={stamp("shipping")}><ShippingEditor initial={values.shipping} customised={Boolean(updated.shipping)} /></Panel>
        </div>
      )}
    </>
  );
}

export default function ContentPage(props: PageProps<"/admin/content">) {
  return (
    <>
      <PageHeader title="Content" description="Edit what customers see. Built-in text is the fallback, and every save updates the live site immediately." />
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <ContentView searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
