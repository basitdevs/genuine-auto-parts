import { Suspense } from "react";
import type { Metadata } from "next";
import { FilterTabs } from "@/components/admin/client";
import { dateOnly, ErrorNotice, fmtDate, MigrationNotice, PageHeader, Panel, StatusBadge, Table, TableSkeleton, Td, Th } from "@/components/admin/ui";
import { requireArea } from "@/lib/admin/access";
import { loadSettingsForAdmin } from "@/lib/settings/admin";
import { FlagsForm, InviteForm, NotificationsForm, RoleSelect } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { value: "", label: "Staff & roles" },
  { value: "notifications", label: "Notifications" },
  { value: "flags", label: "Feature flags" },
];

async function SettingsView({ searchParams }: { searchParams: PageProps<"/admin/settings">["searchParams"] }) {
  const session = await requireArea("settings", "/admin/settings");
  const params = await searchParams;
  const tab = TABS.some((t) => t.value === params.tab) ? String(params.tab) : "";
  const { db } = session;

  if (tab === "") {
    const { data: staff, error } = await db.from("profiles").select("*").in("role", ["staff", "admin"]).order("role").order("email");
    return (
      <div className="grid gap-6">
        <Panel title="Invite staff" description="They get an email to set a password, then sign in at /admin/login.">
          <InviteForm />
        </Panel>
        <Panel title={`Team (${staff?.length ?? 0})`} description="Admins can do everything. Staff can't open Imports, Content, Settings or the Activity Log." bodyClassName="p-0">
          {error ? <div className="p-5"><ErrorNotice message={error.message} /></div> : (
            <Table minWidth={640}>
              <thead><tr><Th>Name</Th><Th>Email</Th><Th>Since</Th><Th>Role</Th></tr></thead>
              <tbody>
                {(staff ?? []).map((p) => (
                  <tr key={p.id}>
                    <Td className="font-medium">{p.full_name || "—"} {p.id === session.userId ? <StatusBadge tone="neutral">You</StatusBadge> : null}</Td>
                    <Td>{p.email}</Td>
                    <Td className="text-muted-foreground">{dateOnly.format(new Date(p.created_at))}</Td>
                    <Td><RoleSelect id={p.id} role={p.role} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    );
  }

  const { values, updated, missing, error } = await loadSettingsForAdmin(db);
  return (
    <>
      {missing ? <div className="mb-4"><MigrationNotice what="settings" /></div> : null}
      {error ? <div className="mb-4"><ErrorNotice message={error} /></div> : null}
      {tab === "notifications" ? (
        <Panel title="Notification emails" description={updated.notifications ? `Last saved ${fmtDate(updated.notifications)}` : "Not set yet"}>
          <NotificationsForm initial={values.notifications} customised={Boolean(updated.notifications)} />
        </Panel>
      ) : (
        <Panel title="Feature flags" description={updated.flags ? `Last saved ${fmtDate(updated.flags)}` : "Defaults: checkout on, prices shown, no banner"}>
          <FlagsForm initial={values.flags} customised={Boolean(updated.flags)} />
        </Panel>
      )}
    </>
  );
}

export default function SettingsPage(props: PageProps<"/admin/settings">) {
  return (
    <>
      <PageHeader title="Settings" description="Team access, notification emails and site-wide switches." />
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <TabsAndView searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function TabsAndView({ searchParams }: { searchParams: PageProps<"/admin/settings">["searchParams"] }) {
  return (
    <>
      <FilterTabs param="tab" tabs={TABS} />
      <SettingsView searchParams={searchParams} />
    </>
  );
}
