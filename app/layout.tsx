import type React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "INVOICE PILOT",
  description: "Invoice Generator & Manager",
  icons: {
    icon: "/ChatGPT Image Oct 26, 2025, 11_14_55 PM.png", // Main favicon
    shortcut: "/ChatGPT Image Oct 26, 2025, 11_14_55 PM.png", // For older browsers
    apple: "/ChatGPT Image Oct 26, 2025, 11_14_55 PM.png", // For iOS devices
  },
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
