import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HOW MANY? — Can you see quantity without counting?",
  description:
    "A small research prototype exploring numerosity perception and the Approximate Number System. No data leaves your browser.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f5f0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh overflow-x-hidden">{children}</body>
    </html>
  );
}
