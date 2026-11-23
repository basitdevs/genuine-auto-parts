export type NavItem = { label: string; href: string };

export const mainNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Parts", href: "/parts" },
  { label: "Vehicles", href: "/vehicles" },
  { label: "About", href: "/about" },
  { label: "Sell Your Car", href: "/sell-your-car" },
  { label: "Returns", href: "/returns" },
  { label: "Contact", href: "/contact" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Shop",
    items: [
      { label: "All parts", href: "/parts" },
      { label: "Newest arrivals", href: "/parts?sort=newest" },
      { label: "Currently dismantling", href: "/vehicles" },
      { label: "Request a part", href: "/contact?topic=part-request" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About us", href: "/about" },
      { label: "Sell your car", href: "/sell-your-car" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Policies",
    items: [
      { label: "Shipping & delivery", href: "/policies/shipping" },
      { label: "Returns & refunds", href: "/policies/returns" },
      { label: "Warranty", href: "/policies/warranty" },
      { label: "Privacy policy", href: "/policies/privacy" },
      { label: "Terms of service", href: "/policies/terms" },
    ],
  },
];

/** Cookie that stores the shopper's last selected vehicle ("My Garage"). */
export const GARAGE_COOKIE = "gatp_garage";
