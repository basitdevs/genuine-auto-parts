import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { checkStaff } from "@/lib/auth/staff";
import { signOut } from "../actions";

async function Panel({ children }: { children: React.ReactNode }) {
  const result = await checkStaff();
  if (!result.ok) redirect(result.reason === "signed-out" ? "/admin/login" : "/admin/login?error=forbidden");
  const { email, name, role } = result.session;
  return (
    <AdminShell user={{ email, name, role }} signOut={signOut}>
      {children}
    </AdminShell>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-60 shrink-0 bg-inverse lg:block" />
      <div className="flex-1">
        <div className="h-16 border-b bg-background" />
        <div className="space-y-3 p-6">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}

/** Authenticated admin frame. Each page still runs requireArea() for its own area. */
export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Panel>{children}</Panel>
    </Suspense>
  );
}
