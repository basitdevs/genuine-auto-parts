import { NotFoundContent } from "@/components/layout/not-found-content";
import { SiteChrome } from "@/components/layout/site-chrome";

/** Unmatched URLs render outside the (site) group, so this adds the storefront chrome itself. */
export default function NotFound() {
  return (
    <SiteChrome>
      <NotFoundContent />
    </SiteChrome>
  );
}
