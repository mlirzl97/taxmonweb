import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";

import { TabBar } from "@/components/TabBar";
import { needsYou, SAMPLE } from "@/lib/sample-data";

import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--font-fraunces", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Antoine", template: "%s · Antoine" },
  description: "Antoine — the TaxMon Colony game. Wag kang pahuhuli!",
  applicationName: "Antoine",
  appleWebApp: { capable: true, title: "Antoine", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f6efe0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        {SAMPLE && <div className="sample-ribbon" role="note">Sample data · fictional clients and people</div>}
        {children}
        <TabBar nowCount={needsYou.length} />
      </body>
    </html>
  );
}
