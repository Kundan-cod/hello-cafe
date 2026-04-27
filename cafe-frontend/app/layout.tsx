import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToastContainer from "@/components/ui/Toast";
import AppDialogContainer from "@/components/ui/AppDialog";
import RestoreAuth from "@/components/RestoreAuth";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hello Cafe - Nepal's Own Cafe Management System",
  description:
    "Complete Cafe management: orders, menu, inventory, reports. Start your free trial.",
  icons: {
    icon: "/pwa-icon-192",
    shortcut: "/pwa-icon-192",
    apple: "/pwa-icon-192",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#dc2626",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/pwa-icon-192" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Hello Cafe" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-dvh`}
      >
        {children}
        <RestoreAuth />
        <ToastContainer />
        <AppDialogContainer />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
