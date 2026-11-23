import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist } from "next/font/google";
import { business } from "@/content/business";
import { env } from "@/lib/env";
import { getBusiness } from "@/lib/settings/server";
import "./globals.css";

const body = Geist({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const display = Barlow_Condensed({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const staticMetadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${business.name} | Genuine Used OEM Auto & Truck Parts`,
    template: `%s | ${business.name}`,
  },
  description:
    "Shop tested, genuine OEM used auto and truck parts from a Phoenix, AZ dismantler. Search by year, make, model, part number or VIN. Nationwide shipping.",
  applicationName: business.name,
  openGraph: {
    type: "website",
    siteName: business.name,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false },
};

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getBusiness();
  return {
    ...staticMetadata,
    title: { default: `${name} | Genuine Used OEM Auto & Truck Parts`, template: `%s | ${name}` },
    applicationName: name,
    openGraph: { ...staticMetadata.openGraph, siteName: name },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, password managers) add attributes
    // to <html>/<body> before React hydrates. It only silences attribute diffs on these two tags.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
