"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNav } from "@/config/site";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return <NavList className={className} pathname={pathname} />;
}

/** Also used as the static Suspense fallback (no active state). */
export function NavList({ className, pathname }: { className?: string; pathname?: string }) {
  return (
    <ul className={cn("flex items-center", className)}>
      {mainNav.map((item) => {
        const active = pathname ? isActive(pathname, item.href) : false;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-11 items-center px-3 text-[13px] font-semibold tracking-wider uppercase transition-colors",
                "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300",
                "hover:text-inverse-foreground hover:after:scale-x-100",
                active ? "text-inverse-foreground after:scale-x-100" : "text-inverse-muted",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
