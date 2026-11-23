import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/account/account-forms";
import { AuthFormSkeleton, AuthShell } from "@/components/account/auth-shell";
import { safeNextPath } from "@/lib/forms/schemas";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a free account to track orders and save your vehicle.",
  alternates: { canonical: "/account/signup" },
};

async function SignupWithParams({ searchParams }: { searchParams: PageProps<"/account/signup">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath.parse(params.next) : "/account";
  return <SignupForm next={next} />;
}

export default function SignupPage(props: PageProps<"/account/signup">) {
  return (
    <AuthShell
      title="Create account"
      description="Free, and takes less than a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/account/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<AuthFormSkeleton fields={3} />}>
        <SignupWithParams searchParams={props.searchParams} />
      </Suspense>
    </AuthShell>
  );
}
