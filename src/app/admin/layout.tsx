import type { Metadata } from "next";
import { Toaster } from "sonner";

/**
 * Admin root: never indexed, never cached by shared caches (Proxy also sends
 * X-Robots-Tag: noindex). The sidebar shell lives in the (panel) group so /admin/login
 * renders without it.
 */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh bg-muted/40 text-foreground">
      {children}
      <Toaster position="top-right" richColors closeButton toastOptions={{ className: "font-sans" }} />
    </div>
  );
}
