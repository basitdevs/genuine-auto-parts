import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/account/account-forms";
import { AuthShell } from "@/components/account/auth-shell";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Get a link to reset your account password.",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot password"
      description="Enter the email you signed up with and we'll send you a link to set a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/account/login" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
