import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import { BrandingProvider } from "@/context/BrandingContext";
import { getBranding } from "@/lib/branding";
import { themeStyleBody } from "@/lib/branding-shared";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sarabun",
});

export const metadata: Metadata = {
  title: "ระบบบริหารจัดการร้านเสริมสวย",
  description: "Salon Management System - POS, CRM, ERP, Dashboard, HR",
};

// Read branding fresh on every request so the inlined CSS variables match what
// the user just saved on /settings/branding. The query is a single SELECT on
// SystemConfig (≤5 rows) — cheap enough to skip caching.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding();
  return (
    <html lang="th" className={`h-full ${sarabun.variable}`}>
      <head>
        {/* Inline theme vars BEFORE first paint so the page never flashes the
            globals.css defaults on the way to the user's chosen palette. */}
        <style dangerouslySetInnerHTML={{ __html: themeStyleBody(branding.theme) }} />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <BrandingProvider initial={branding}>
          <ThemeProvider>{children}</ThemeProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
