import Link from "next/link";
import { Wordmark } from "@/components/layout/Wordmark";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
      <Wordmark size="lg" className="mb-8" />
      <h1 className="font-serif text-2xl text-brown mb-2">gallery not found</h1>
      <p className="text-brown-muted text-sm mb-8 max-w-sm">
        This artist hasn&apos;t set up their gallery yet, or the handle
        doesn&apos;t exist.
      </p>
      <Link
        href="https://galleryclub.online"
        className="text-sm text-gold hover:underline underline-offset-2"
      >
        back to gallery club
      </Link>
    </div>
  );
}
