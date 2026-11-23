import { SiteChrome } from "@/components/layout/site-chrome";

/** Every public page shares the storefront chrome. /admin has its own layout. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <SiteChrome>{children}</SiteChrome>;
}
