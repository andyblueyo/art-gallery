import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "gallery club — free portfolio galleries for human-made art",
    template: "%s | gallery club",
  },
  description:
    "The most beautiful way to share your art. Free portfolio galleries for human-made art.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
