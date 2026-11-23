"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { processImageBatch, startImageJob } from "./actions";

/** Starts (or re-runs) the "copy marketplace photos into Storage" job and drives it batch by batch. */
export function ImageJobRunner({ label = "Run image job" }: { label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ done: number; failed: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const start = await startImageJob();
    if (!start.ok || !start.data) {
      setRunning(false);
      return void toast.error(start.message);
    }
    toast.message(start.message);
    const { jobId, total } = start.data;
    setState({ done: 0, failed: 0, total });
    let remaining = total;
    while (remaining > 0) {
      const r = await processImageBatch({ jobId });
      if (!r.ok || !r.data) {
        toast.error(r.message);
        break;
      }
      remaining = r.data.remaining;
      setState({ done: r.data.done, failed: r.data.failed, total });
    }
    setRunning(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={running}>
        {running ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />} {running ? "Copying photos…" : label}
      </Button>
      {state && state.total > 0 ? (
        <span className="text-xs text-muted-foreground" aria-live="polite">{state.done + state.failed} / {state.total} · {state.failed} failed</span>
      ) : null}
    </div>
  );
}
