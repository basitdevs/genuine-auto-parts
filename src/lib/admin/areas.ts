/**
 * Admin areas and who may use them (client-safe: the sidebar and command palette use it to
 * hide links; the server enforces it in requireArea()/authorize() and RLS enforces it again).
 */
export type AdminArea =
  | "dashboard"
  | "orders"
  | "products"
  | "vehicles"
  | "leads"
  | "customers"
  | "imports"
  | "content"
  | "settings"
  | "activity";

type Role = "staff" | "admin";

export const AREA_ROLES: Record<AdminArea, readonly Role[]> = {
  dashboard: ["staff", "admin"],
  orders: ["staff", "admin"],
  products: ["staff", "admin"],
  vehicles: ["staff", "admin"],
  leads: ["staff", "admin"],
  customers: ["staff", "admin"],
  imports: ["admin"],
  content: ["admin"],
  settings: ["admin"],
  activity: ["admin"],
};

export type NavItem = { area: AdminArea; label: string; href: string; icon: string; keywords?: string };

export const ADMIN_NAV: NavItem[] = [
  { area: "dashboard", label: "Dashboard", href: "/admin", icon: "dashboard" },
  { area: "orders", label: "Orders", href: "/admin/orders", icon: "orders", keywords: "requests sales" },
  { area: "products", label: "Products", href: "/admin/products", icon: "products", keywords: "parts inventory catalog" },
  { area: "vehicles", label: "Vehicles", href: "/admin/vehicles", icon: "vehicles", keywords: "donor dismantling cars" },
  { area: "leads", label: "Leads", href: "/admin/leads", icon: "leads", keywords: "requests messages offers sell car returns" },
  { area: "customers", label: "Customers", href: "/admin/customers", icon: "customers", keywords: "users accounts" },
  { area: "imports", label: "Imports & Images", href: "/admin/imports", icon: "imports", keywords: "ebay csv photos" },
  { area: "content", label: "Content", href: "/admin/content", icon: "content", keywords: "business hours faq reviews policies home" },
  { area: "settings", label: "Settings", href: "/admin/settings", icon: "settings", keywords: "staff roles flags notifications" },
  { area: "activity", label: "Activity Log", href: "/admin/activity", icon: "activity", keywords: "audit history" },
];

export const canUse = (role: Role, area: AdminArea) => AREA_ROLES[area].includes(role);
