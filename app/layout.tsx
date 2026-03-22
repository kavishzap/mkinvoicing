import type React from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MoLedger",
  description: "Invoice, expense tracking & bookkeeping",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MoLedger",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/ChatGPT Image Oct 26, 2025, 11_14_55 PM.png", // Main favicon
    shortcut: "/ChatGPT Image Oct 26, 2025, 11_14_55 PM.png", // For older browsers
    apple: "/ChatGPT Image Oct 26, 2025, 11_14_55 PM.png", // For iOS devices
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
