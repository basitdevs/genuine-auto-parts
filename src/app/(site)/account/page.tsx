import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CarFront,
  CheckCircle2,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  PackageOpen,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { ProfileForm } from "@/components/account/account-forms";
import { garageLabel, parseGarage } from "@/components/search/garage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GARAGE_COOKIE } from "@/config/site";
import { getBusiness } from "@/lib/settings/server";
import { getCustomer } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";
import { partsHref } from "@/lib/search/params";
import type { OrderStatus } from "@/lib/supabase/database.types";
import { signOutCustomer } from "./actions";

export const metadata: Metadata = { title: "My Account", robots: { index: false } };

const ORDER_STATUS: Record<OrderStatus, { label: string; tone: "default" | "dark" | "outline" }> = {
  new: { label: "Request received", tone: "outline" },
  confirmed: { label: "Confirmed · awaiting payment", tone: "outline" },
  paid: { label: "Paid", tone: "default" },
  shipped: { label: "Shipped", tone: "dark" },
  completed: { label: "Completed", tone: "dark" },
  cancelled: { label: "Cancelled", tone: "outline" },
  refunded: { label: "Refunded", tone: "outline" },
};

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function Card({ title, icon: Icon, children, action }: { title: string; icon: typeof CarFront; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-wide uppercase">
          <Icon className="size-5 text-primary" aria-hidden /> {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/account">["searchParams"] }) {
  const business = await getBusiness();
  const [session, params, cookieStore] = await Promise.all([getCustomer(), searchParams, cookies()]);
  if (!session) redirect("/account/login?next=/account");
  const { customer, db } = session;

  const { data: orders, error: ordersError } = await db
    .from("orders")
    .select("id, order_number, status, total, placed_at, created_at")
    .eq("customer_id", customer.userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (ordersError) console.error(`[account] orders query failed: ${ordersError.message}`);

  const garage = parseGarage(cookieStore.get(GARAGE_COOKIE)?.value ?? "");
  const firstName = customer.name?.split(/\s+/)[0] ?? null;
  const isStaff = customer.role === "staff" || customer.role === "admin";
  const notice =
    params.welcome === "1"
      ? "Your account is ready. Welcome aboard!"
      : params.password === "updated"
        ? "Your password has been updated."
        : null;

  return (
    <>
      <div className="texture-tread bg-inverse text-inverse-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 px-4 py-10 sm:px-6 sm:py-14">
          <div>
            <p className="font-display text-sm font-bold tracking-[0.2em] text-inverse-accent uppercase">My account</p>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight uppercase sm:text-5xl">
              {firstName ? `Hi, ${firstName}` : "Welcome"}
            </h1>
            <p className="mt-2 text-inverse-muted">
              {customer.email}
              {customer.createdAt ? <> · Member since {dateFmt.format(new Date(customer.createdAt))}</> : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isStaff ? (
              <Button asChild variant="outline-inverse">
                <Link href="/admin/leads">
                  <LayoutDashboard aria-hidden /> Staff dashboard
                </Link>
              </Button>
            ) : null}
            <form action={signOutCustomer}>
              <Button type="submit" variant="ghost-inverse">
                <LogOut aria-hidden /> Sign out
              </Button>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {notice ? (
          <p role="status" className="mb-8 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm font-medium text-success">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {notice}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="grid content-start gap-6">
            <Card title="Orders" icon={PackageOpen}>
              {orders && orders.length > 0 ? (
                <ul className="divide-y rounded-lg border">
                  {orders.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div>
                        <p className="font-semibold">Order {o.order_number}</p>
                        <p className="text-muted-foreground">{dateFmt.format(new Date(o.placed_at ?? o.created_at))}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                        <span className="font-semibold tabular-nums">{formatPrice(Number(o.total))}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="font-semibold">No orders yet</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    Add parts to your cart and send your order request. We&apos;ll confirm availability and shipping, then email you a secure payment
                    link.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button asChild>
                      <Link href="/parts">
                        Shop parts <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/cart">
                        <ShoppingCart aria-hidden /> View cart
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Your details" icon={ShieldCheck}>
              <ProfileForm name={customer.name ?? ""} phone={customer.phone ?? ""} email={customer.email} />
            </Card>
          </div>

          <div className="grid content-start gap-6">
            <Card title="My garage" icon={CarFront}>
              {garage && (garage.year || garage.make) ? (
                <>
                  <p className="font-display text-2xl font-bold uppercase">{garageLabel(garage)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Saved on this device from your last vehicle search.</p>
                  <Button asChild className="mt-4 w-full">
                    <Link href={partsHref({}, { year: garage.year ?? null, make: garage.make ?? null, model: garage.model ?? null })}>
                      Shop parts for it <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Search by year, make and model and we&apos;ll remember your vehicle, so every search starts with parts that fit.
                  </p>
                  <Button asChild variant="outline" className="mt-4 w-full">
                    <Link href="/parts">Find parts by vehicle</Link>
                  </Button>
                </>
              )}
            </Card>

            <Card title="Security" icon={KeyRound}>
              <ul className="grid gap-2 text-sm">
                <li>
                  <Link href="/account/reset-password" className="flex items-center justify-between rounded-md border px-4 py-3 font-semibold hover:bg-muted">
                    Change password <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </li>
              </ul>
            </Card>

            <Card title="Need help?" icon={LifeBuoy}>
              <ul className="grid gap-2 text-sm">
                {[
                  { href: "/returns", label: "Start a return", icon: RotateCcw },
                  { href: "/policies/warranty", label: `${business.policies.warrantyDays}-day warranty`, icon: ShieldCheck },
                  { href: "/contact", label: "Contact us", icon: LifeBuoy },
                ].map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link href={href} className="flex items-center gap-2 rounded-md px-2 py-2 font-medium hover:bg-muted">
                      <Icon className="size-4 text-primary" aria-hidden /> {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="bg-inverse">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <Skeleton className="h-4 w-28 bg-inverse-foreground/10" />
          <Skeleton className="mt-3 h-12 w-64 bg-inverse-foreground/10" />
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </>
  );
}

export default function AccountPage(props: PageProps<"/account">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={props.searchParams} />
    </Suspense>
  );
}
