"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export type EditorImage = { id: number; src: string | null; alt: string };

type Result = { ok: boolean; message: string };
export type ImageActions = {
  register: (input: { ownerId: string; storagePath: string }) => Promise<Result>;
  save: (input: { ownerId: string; images: { id: number; alt: string }[] }) => Promise<Result>;
  remove: (input: { ownerId: string; imageId: number }) => Promise<Result>;
};

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Photos: the browser uploads straight to Supabase Storage with the staff member's own
 * session (Storage RLS allows staff only), then a Server Action records the row. Reorder
 * with the arrows, edit alt text, delete with confirmation.
 */
export function ImageManager({ ownerId, initial, bucket, actions }: { ownerId: string; initial: EditorImage[]; bucket: "product-images" | "vehicle-images"; actions: ImageActions }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState(initial);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = images.some((img, i) => img.id !== initial[i]?.id || img.alt !== initial[i]?.alt) || images.length !== initial.length;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const supabase = getSupabaseBrowserClient();
    for (const file of Array.from(files)) {
      if (!TYPES.includes(file.type)) {
        toast.error(`${file.name}: use JPG, PNG, WebP or AVIF.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: max 10 MB.`);
        continue;
      }
      setUploading(file.name);
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${ownerId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
      if (error) {
        toast.error(`${file.name}: ${error.message}`);
        continue;
      }
      const r = await actions.register({ ownerId, storagePath: path });
      if (!r.ok) toast.error(r.message);
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Upload finished");
    router.refresh();
  }

  function move(i: number, d: -1 | 1) {
    setImages((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="photos-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div>
          <h2 id="photos-title" className="font-display text-lg font-bold tracking-wide uppercase">Photos ({images.length})</h2>
          <p className="text-xs text-muted-foreground">The first photo is the main image. JPG, PNG, WebP or AVIF up to 10 MB.</p>
        </div>
        <div className="flex gap-2">
          {dirty ? (
            <Button type="button" size="sm" disabled={pending} onClick={() => startTransition(async () => {
              const r = await actions.save({ ownerId, images: images.map((i) => ({ id: i.id, alt: i.alt })) });
              if (r.ok) toast.success(r.message);
              else toast.error(r.message);
              router.refresh();
            })}>
              <Save aria-hidden /> Save order
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" disabled={Boolean(uploading)} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />} {uploading ? `Uploading ${uploading}…` : "Upload photos"}
          </Button>
          <input ref={fileRef} type="file" accept={TYPES.join(",")} multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
      </div>
      <div
        className="p-5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
      >
        {images.length === 0 ? (
          <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-sm text-muted-foreground hover:border-foreground/30">
            <ImagePlus className="size-6" aria-hidden />
            Drop photos here or click to upload
          </button>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img, i) => (
              <li key={img.id} className={cn("overflow-hidden rounded-md border bg-background", i === 0 && "ring-2 ring-primary")}>
                <div className="relative aspect-[4/3] bg-muted">
                  {img.src ? <Image src={img.src} alt={img.alt} fill sizes="240px" className="object-cover" /> : null}
                  {i === 0 ? <span className="absolute top-2 left-2 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">Main</span> : null}
                </div>
                <div className="grid gap-2 p-2">
                  <label className="sr-only" htmlFor={`alt-${img.id}`}>Alt text for photo {i + 1}</label>
                  <input id={`alt-${img.id}`} value={img.alt} onChange={(e) => setImages((list) => list.map((x) => (x.id === img.id ? { ...x, alt: e.target.value } : x)))} placeholder="Alt text (describe the photo)" className={cn(fieldClass, "h-8 text-xs")} />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-md p-1.5 hover:bg-muted disabled:opacity-30" aria-label="Move earlier"><ArrowUp className="size-4" aria-hidden /></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} className="rounded-md p-1.5 hover:bg-muted disabled:opacity-30" aria-label="Move later"><ArrowDown className="size-4" aria-hidden /></button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm("Delete this photo? This can't be undone.")) return;
                        startTransition(async () => {
                          const r = await actions.remove({ ownerId, imageId: img.id });
                          if (r.ok) {
                            toast.success(r.message);
                            setImages((list) => list.filter((x) => x.id !== img.id));
                          } else toast.error(r.message);
                        });
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label={`Delete photo ${i + 1}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
