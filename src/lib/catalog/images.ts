import { env } from "@/lib/env";

export type ImageSource = { storage_path: string | null; external_url: string | null; alt: string | null };

export const PRODUCT_BUCKET = "product-images";
export const VEHICLE_BUCKET = "vehicle-images";

/** Public URL for a Supabase Storage object, or the original marketplace URL before download. */
export function imageUrl(image: ImageSource, bucket: string = PRODUCT_BUCKET): string | null {
  if (image.storage_path) {
    return `${env.supabaseUrl}/storage/v1/object/public/${bucket}/${image.storage_path.replace(/^\/+/, "")}`;
  }
  return image.external_url;
}
