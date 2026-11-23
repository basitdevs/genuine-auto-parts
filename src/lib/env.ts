/**
 * Public env access. Values are inlined at build time by Next.js, so they must be
 * referenced as literal `process.env.NEXT_PUBLIC_*` expressions.
 */
export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

/** False until .env.local is filled in. Lists then render their empty state instead of failing the build. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseKey);
