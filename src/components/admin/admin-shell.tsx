"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Car,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingBag,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { ADMIN_NAV, canUse } from "@/lib/admin/areas";
import { cn } from "@/lib/utils";
import logoLight from "../../../public/brand/logo-light.png";
import { CommandPalette } from "./command-palette";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ShoppingBag,
  products: Package,
  vehicles: Car,
  leads: Inbox,
  customers: Users,
  imports: Upload,
  content: FileText,
  settings: Settings,
  activity: Activity,
};

export type ShellUser = { email: string | null; name: string | null; role: "staff" | "admin" };

const COLLAPSE_KEY = "gatp-admin-sidebar";
const COLLAPSE_EVENT = "gatp-admin-sidebar-change";

function readCollapse(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapse(callback: () => void) {
  window.addEventListener(COLLAPSE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin frame: collapsible icon-rail sidebar on desktop, slide-in drawer on mobile,
 * top bar with the command palette trigger. Links the user can't use are hidden
 * (cosmetic only; every page and action re-checks the role on the server).
 */
export function AdminShell({ user, signOut, children }: { user: ShellUser; signOut: () => Promise<void>; children: ReactNode }) {
  const pathname = usePathname();
  // Saved collapse preference, hydration-safe: the server snapshot is "expanded".
  const collapsed = useSyncExternalStore(subscribeCollapse, readCollapse, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const nav = ADMIN_NAV.filter((item) => canUse(user.role, item.area));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the mobile drawer on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  function toggleCollapsed() {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
    } catch {
      /* storage unavailable: preference just isn't remembered */
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }

  const sidebar = (mobile: boolean) => (
    <div className="flex h-full flex-col bg-inverse text-inverse-foreground">
      <div className={cn("flex h-16 shrink-0 items-center border-b border-inverse-border", collapsed && !mobile ? "justify-center px-2" : "justify-between px-4")}>
        <Link href="/admin" className="flex items-center gap-2" aria-label="Admin dashboard">
          {collapsed && !mobile ? (
            <span className="flex size-9 items-center justify-center rounded-md bg-primary font-display text-lg font-extrabold">G</span>
          ) : (
            <>
              <Image src={logoLight} alt="" sizes="110px" className="h-auto w-[110px]" priority />
              <span className="rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-bold tracking-widest uppercase">Admin</span>
            </>
          )}
        </Link>
        {mobile ? (
          <button type="button" onClick={() => setMobileOpen(false)} className="rounded-md p-2 hover:bg-inverse-foreground/10" aria-label="Close menu">
            <X className="size-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <nav aria-label="Admin" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <ul className="grid gap-0.5">
          {nav.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed && !mobile ? item.label : undefined}
                  className={cn(
                    "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                    active ? "bg-inverse-foreground/10 text-white" : "text-inverse-muted hover:bg-inverse-foreground/5 hover:text-white",
                    collapsed && !mobile && "justify-center px-0",
                  )}
                >
                  {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" /> : null}
                  <Icon className={cn("size-[18px] shrink-0", active && "text-inverse-accent")} aria-hidden />
                  {collapsed && !mobile ? <span className="sr-only">{item.label}</span> : item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-inverse-border p-2">
        {!mobile ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn("flex h-9 w-full items-center gap-3 rounded-md px-3 text-xs text-inverse-muted hover:bg-inverse-foreground/5 hover:text-white", collapsed && "justify-center px-0")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <ChevronsLeft className="size-4" aria-hidden />}
            {collapsed ? null : "Collapse"}
          </button>
        ) : null}
        <div className={cn("mt-1 flex items-center gap-3 rounded-md px-3 py-2", collapsed && !mobile && "justify-center px-0")}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase" aria-hidden>
            {(user.name ?? user.email ?? "?").charAt(0)}
          </span>
          {collapsed && !mobile ? null : (
            <div className="min-w-0 text-xs leading-tight">
              <p className="truncate font-semibold text-white">{user.name ?? user.email}</p>
              <p className="text-inverse-muted capitalize">{user.role}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 transition-[width] duration-200 lg:block print:hidden", collapsed ? "w-16" : "w-60")}>{sidebar(false)}</aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-72 max-w-[85vw] shadow-2xl motion-safe:animate-[drawer-in_0.25s_ease-out]">{sidebar(true)}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 print:hidden items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="-ml-2 rounded-md p-2 hover:bg-muted lg:hidden" aria-label="Open menu">
            <Menu className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted sm:max-w-md"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Search products, orders, customers…</span>
            <kbd className="ml-auto hidden rounded-sm border bg-background px-1.5 py-0.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <a href="/" target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex">
              <ExternalLink className="size-4" aria-hidden /> View site
            </a>
            <form action={signOut}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </header>
        <main id="admin-main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 print:p-0">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} nav={nav} />
    </div>
  );
}
