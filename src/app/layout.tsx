import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next"


export const metadata: Metadata = {
  title: {
    default: "gallery club — free portfolio galleries for real art",
    template: "%s | gallery club",
  },
  description:
    "Free portfolio galleries for sharing real art with others.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        {children}
        <Analytics />
        </body>
    </html>
  );
}
