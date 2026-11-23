import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/account/account-forms";
import { AuthFormSkeleton, AuthShell } from "@/components/account/auth-shell";
import { Button } from "@/components/ui/button";
import { getCustomer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

/** Reached from the reset email (via /auth/confirm, which signs the user in) or from the account page. */
async function ResetGate() {
  const session = await getCustomer();
  if (!session) {
    return (
      <div className="grid gap-4">
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          This reset link has expired or was already used. Reset links work once, for 1 hour.
        </p>
        <Button asChild size="lg">
          <Link href="/account/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }
  return (
    <>
      <p className="mb-5 text-sm">
        Signed in as <span className="font-semibold">{session.customer.email}</span>
      </p>
      <ResetPasswordForm />
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="New password" description="Choose a new password for your account.">
      <Suspense fallback={<AuthFormSkeleton />}>
        <ResetGate />
      </Suspense>
    </AuthShell>
  );
}
