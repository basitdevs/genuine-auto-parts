import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/account/account-forms";
import { AuthFormSkeleton, AuthShell } from "@/components/account/auth-shell";
import { safeNextPath } from "@/lib/forms/schemas";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Genuine Auto & Truck Parts account.",
  alternates: { canonical: "/account/login" },
  robots: { index: false },
};

const NOTICES: Record<string, string> = {
  "link-expired": "That link has expired. Sign in, or request a new link below.",
  "link-invalid": "That link is invalid or was already used. Try signing in, or request a new link.",
};

async function LoginWithParams({ searchParams }: { searchParams: PageProps<"/account/login">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath.parse(params.next) : "/account";
  const notice = typeof params.error === "string" ? NOTICES[params.error] : undefined;
  return <LoginForm next={next} notice={notice} />;
}

export default function LoginPage(props: PageProps<"/account/login">) {
  return (
    <AuthShell
      title="Sign in"
      description="Welcome back. Sign in to see your orders and saved vehicle."
      footer={
        <>
          New here?{" "}
          <Link href="/account/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginWithParams searchParams={props.searchParams} />
      </Suspense>
    </AuthShell>
  );
}
