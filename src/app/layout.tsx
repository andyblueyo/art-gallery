import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";


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
      <div style={{
  background: '#1a1a1a',
  color: '#f5f0e8',
  textAlign: 'center',
  padding: '10px',
  fontSize: '14px',
  fontFamily: 'serif',
  zIndex: 9999,
  position: 'relative'
}}>
  🚧 gallery club is currently undergoing database migrations. all data is still stored, will be fully restored by 6/8. thank you for your support! new exciting feature soon to be released!! any questions, comments, email hello@galleryclub.online!
</div>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
