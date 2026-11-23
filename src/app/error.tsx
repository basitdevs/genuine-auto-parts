"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RouteError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-wide uppercase">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">We hit a snag loading this page. Please try again.</p>
      <div className="mt-8 flex gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
