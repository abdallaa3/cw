import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Wave Academy",
  title: "Wave Academy — نظام الإدارة المالية",
  description: "نظام إدارة أكاديمية Code Wave — الطلاب، الجروبات، الدفعات، الخزينة، والتقارير.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/codewave-logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
