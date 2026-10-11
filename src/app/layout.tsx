import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "TaxMonWeb · Tax Compliance Control",
  description: "TaxMonWeb compliance monitoring and control tower.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
