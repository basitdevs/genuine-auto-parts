import type { Metadata } from "next";
import { NotFoundContent } from "@/components/layout/not-found-content";

/**
 * Static 404 page that Proxy rewrites unknown /parts/* and /vehicles/* URLs to,
 * with a real 404 status (see src/proxy.ts).
 */
export const metadata: Metadata = { title: "Not found", robots: { index: false, follow: true } };

export default function NotFoundPage() {
  return <NotFoundContent />;
}
