import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import logoLight from "../../../../public/brand/logo-light.png";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in" };

const NEXT_PATTERN = /^\/admin(\/[a-z0-9/_\-[\]]*)?$/;

async function LoginFromParams({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" && NEXT_PATTERN.test(params.next) ? params.next : "/admin";
  const notice =
    params.error === "forbidden" || params.error === "not-staff"
      ? "That account doesn't have access to the admin area. Ask an admin to grant it."
      : undefined;
  return <LoginForm next={next} notice={notice} />;
}

export default function LoginPage(props: PageProps<"/admin/login">) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-inverse px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Image src={logoLight} alt="Genuine Auto & Truck Parts" sizes="150px" className="h-auto w-[150px]" priority />
        </div>
        <div className="rounded-lg border-t-4 border-primary bg-card p-6 shadow-2xl sm:p-8">
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-wide uppercase">
            <ShieldCheck className="size-6 text-primary" aria-hidden /> Staff sign in
          </h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Admin dashboard for Genuine Auto staff.</p>
          <Suspense fallback={null}>
            <LoginFromParams searchParams={props.searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
