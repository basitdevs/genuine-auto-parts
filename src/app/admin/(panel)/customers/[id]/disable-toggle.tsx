"use client";

import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import { ConfirmButton, useAction } from "@/components/admin/client";
import { setCustomerDisabled } from "../actions";

export function DisableToggle({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const { run, pending } = useAction(setCustomerDisabled, { onSuccess: () => router.refresh() });
  return disabled ? (
    <ConfirmButton size="sm" variant="outline" pending={pending} title="Re-enable this account?" description="They'll be able to sign in again." confirmLabel="Re-enable" onConfirm={() => run({ id, disabled: false })}>
      <CheckCircle2 aria-hidden /> Re-enable
    </ConfirmButton>
  ) : (
    <ConfirmButton size="sm" variant="outline" destructive pending={pending} title="Disable this account?" description="They're signed out and can't sign in until an admin re-enables the account. Their orders and leads are kept." confirmLabel="Disable account" onConfirm={() => run({ id, disabled: true })}>
      <Ban aria-hidden /> Disable account
    </ConfirmButton>
  );
}
