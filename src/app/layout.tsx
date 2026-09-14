import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getFrames } from "@/lib/frames-server";
import { FramesProvider } from "@/components/frames/FramesProvider";


export const metadata: Metadata = {
  title: {
    default: "gallery club — free portfolio galleries for real art",
    template: "%s | gallery club",
  },
  description:
    "Free portfolio galleries for sharing real art with others.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cached under the 'frames' tag; falls back to the committed snapshot.
  const frameCatalog = await getFrames();

  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <FramesProvider catalog={frameCatalog}>{children}</FramesProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
