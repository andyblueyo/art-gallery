import Link from "next/link";
import { Wordmark } from "@/components/layout/Wordmark";
import { DEMO_HANDLE } from "@/lib/demo-data";

const exampleGalleries = [
  {
    handle: DEMO_HANDLE,
    name: "maya lin",
    preview:
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&q=80",
  },
  {
    handle: "demo",
    name: "Coming soon",
    preview:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80",
    disabled: true,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="px-6 py-6">
        <Wordmark size="lg" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-16">
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-brown max-w-2xl leading-tight mb-6">
          the most beautiful way to share your art
        </h1>
        <p className="text-brown-muted text-lg sm:text-xl max-w-md mb-10">
          free portfolio galleries for human-made art
        </p>
        <Link
          href="/signup"
          className="inline-block px-10 py-4 bg-brown text-cream rounded-lg hover:bg-brown-light transition-colors text-base font-medium"
        >
          create your gallery
        </Link>
      </main>

      <section className="border-t border-brown/10 py-16 px-6">
        <p className="text-center text-sm text-brown-muted mb-8">
          example galleries
        </p>
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
          {exampleGalleries.map((gallery) =>
            gallery.disabled ? (
              <div
                key={gallery.handle}
                className="opacity-50 rounded-xl border border-brown/10 overflow-hidden bg-white/50"
              >
                <div
                  className="h-40 bg-cover bg-center"
                  style={{ backgroundImage: `url(${gallery.preview})` }}
                />
                <div className="p-4 text-left">
                  <p className="font-medium text-brown">{gallery.name}</p>
                  <p className="text-xs text-brown-muted">coming soon</p>
                </div>
              </div>
            ) : (
              <Link
                key={gallery.handle}
                href={`/${gallery.handle}`}
                className="group rounded-xl border border-brown/10 overflow-hidden bg-white/50 hover:border-gold/40 transition-colors"
              >
                <div
                  className="h-40 bg-cover bg-center group-hover:scale-[1.02] transition-transform duration-500"
                  style={{ backgroundImage: `url(${gallery.preview})` }}
                />
                <div className="p-4 text-left">
                  <p className="font-medium text-brown">{gallery.name}</p>
                  <p className="text-xs text-brown-muted">
                    @{gallery.handle}
                  </p>
                </div>
              </Link>
            )
          )}
        </div>
      </section>
    </div>
  );
}
