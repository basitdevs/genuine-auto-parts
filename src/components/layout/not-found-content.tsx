import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Branded 404 body, shared by the global not-found and /not-found-page. */
export function NotFoundContent() {
  return (
    <div className="bg-inverse texture-tread text-inverse-foreground">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <p className="font-display text-8xl font-extrabold text-inverse-accent">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-wide uppercase">We couldn&apos;t find that part</h1>
        <p className="mt-3 text-inverse-muted">It may have sold, or the link is out of date. Try searching by part number or vehicle.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button asChild size="lg">
            <Link href="/parts">
              <Search aria-hidden /> Search parts
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline-inverse">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
