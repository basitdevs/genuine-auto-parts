import Image from "next/image";
import Link from "next/link";
import { business } from "@/content/business";
import { cn } from "@/lib/utils";
import logoDark from "../../../public/brand/logo.png";
import logoLight from "../../../public/brand/logo-light.png";

type LogoProps = {
  /** "light" = white wordmark for black surfaces. */
  tone?: "dark" | "light";
  className?: string;
  /** Above-the-fold usage: load eagerly with high fetch priority. */
  eager?: boolean;
};

export function Logo({ tone = "dark", className, eager = false }: LogoProps) {
  return (
    <Link href="/" aria-label={`${business.name} home`} className={cn("inline-flex shrink-0 items-center", className)}>
      <Image
        src={tone === "light" ? logoLight : logoDark}
        alt={business.name}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        sizes="160px"
        className="h-auto w-full"
      />
    </Link>
  );
}
