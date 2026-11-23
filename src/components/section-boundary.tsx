"use client";

import { catchError, type ErrorInfo } from "next/error";
import { RotateCcw } from "lucide-react";

function SectionError({ label }: { label: string }, { retry }: ErrorInfo) {
  return (
    <div role="alert" className="mx-auto my-10 flex max-w-7xl flex-col items-center gap-3 px-4 text-center sm:px-6">
      <p className="font-display text-lg font-bold tracking-wide uppercase">{label} couldn&apos;t load</p>
      <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted"
      >
        <RotateCcw className="size-4" aria-hidden /> Try again
      </button>
    </div>
  );
}

/** Keeps one failing data section from taking down the whole page. */
export const SectionBoundary = catchError(SectionError);
