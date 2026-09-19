import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/layout/SiteNav";
import { GalleryCarousel } from "@/components/explore/GalleryCarousel";
import { getGalleryDirectory } from "@/lib/directory-server";
import { getGalleryUrl } from "@/lib/url";
import type { GalleryDirectoryEntry } from "@/lib/types";

const FEATURED_COUNT = 8;
const FEATURED_RECENT = 3;
// Always in the rotation, as long as the wall has work on it.
const FEATURED_PINNED = ["badartrat"];

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The pinned galleries, a few of the most recently updated (the directory's
// own order), then a random pick of the rest, shuffled together. Empty walls
// are left out.
function pickFeatured(directory: GalleryDirectoryEntry[]): GalleryDirectoryEntry[] {
  const filled = directory.filter((g) => g.pieceCount > 0 && g.wall.pieces.length > 0);
  const pinned = filled.filter((g) => FEATURED_PINNED.includes(g.handle));
  const rest = filled.filter((g) => !FEATURED_PINNED.includes(g.handle));
  const recent = rest.slice(0, FEATURED_RECENT);
  const others = shuffle(rest.slice(FEATURED_RECENT)).slice(
    0,
    FEATURED_COUNT - pinned.length - recent.length
  );
  return shuffle([...pinned, ...recent, ...others]);
}

export default async function HomePage() {
  const supabase = await createClient();
  const [{ data: { user } }, directory] = await Promise.all([
    supabase.auth.getUser(),
    getGalleryDirectory(),
  ]);
  const featured = await Promise.all(
    pickFeatured(directory).map(async (entry) => ({
      ...entry,
      url: await getGalleryUrl(entry.handle),
    }))
  );
  const handle = user
  ? (await supabase.from("profiles").select("handle").eq("id", user.id).single()).data?.handle
  : null;
  return (
    <div style={{ backgroundColor: "#F2EDE3" }} className="min-h-screen flex flex-col">
      <SiteNav signedIn={!!user} />

      {/* Hero */}
      <section className="flex-1 py-20 px-6 flex flex-col items-center justify-center">
        <div style={{ fontFamily: "'Crooked', serif", fontSize: "64px", color: "#2C2A22" }} className="mb-8 text-center leading-tight">
          gallery club
        </div>

        <div className="mb-12 max-w-sm">
          <Image
            src="/art/star.png"
            alt="Ornate frame"
            width={300}
            height={300}
            className="w-full h-auto"
          />
        </div>

        <p style={{ color: "#888780" }} className="text-center text-lg mb-8 max-w-2xl leading-relaxed">
          a space for REAL art: no algorithms, no ai images. just artists sharing work they make.
        </p>

        {user ? (
          <Link href={`https://${handle}.galleryclub.online`} style={{ backgroundColor: "#2C2A22", color: "#F2EDE3" }}
            className="px-8 py-3 rounded-lg hover:opacity-90 transition-opacity font-medium mb-6">
            view my gallery
          </Link>
          ) : (
          <Link href="/signup" style={{ backgroundColor: "#2C2A22", color: "#F2EDE3" }}
            className="px-8 py-3 rounded-lg hover:opacity-90 transition-opacity font-medium mb-6">
            create your gallery
          </Link>
        )}

        <p style={{ color: "#888780" }} className="text-sm italic">
          made by artists for artists.
        </p>
      </section>

      {/* 3-Column Pillars */}
      <section className="py-20 px-6" style={{ borderTop: "1px solid #D3CEBF", borderBottom: "1px solid #D3CEBF" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { title: "your layout", desc: "arrange your work exactly how it should be display. drag, rotate, resize. there's no grid to be constrained to." },
            { title: "REAL art only", desc: "celebrate the artists behind each piece. no algorithms to decide what's shown." },
            { title: "always free", desc: "no profit model, no fees, no shareholders. just a space online for artists to share." },
          ].map((pillar, idx) => (
            <div key={idx} className="text-center">
              <div
                style={{ fontFamily: "'Crooked', serif", fontSize: "28px", color: "#2C2A22" }}
                className="mb-4"
              >
                {pillar.title}
              </div>
              <p style={{ color: "#888780" }} className="text-sm leading-relaxed">
                {pillar.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Example Galleries */}
      <section className="py-20 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          {featured.length > 0 && (
            <>
              <p style={{ color: "#888780" }} className="text-sm text-center mb-12">
                featured artist galleries
              </p>
              <GalleryCarousel galleries={featured} />
            </>
          )}

          <p className="text-center mt-8">
            <Link href="/explore" style={{ color: "#2C2A22" }} className="text-sm underline underline-offset-4 hover:opacity-70 transition-opacity">
              explore all galleries
            </Link>
          </p>
        </div>
      </section>

      {/* Coming Soon */}
      <section className="py-20 px-6" style={{ borderTop: "1px solid #D3CEBF" }}>
        <div className="max-w-2xl mx-auto text-center">
          <div
            style={{ fontFamily: "'Crooked', serif", fontSize: "48px", color: "#2C2A22" }}
            className="mb-6"
          >
            collect & exchange
          </div>
          <p style={{ color: "#888780" }} className="text-lg leading-relaxed">
            hang work you love in your own gallery. curate art from other artists, build a collection, and show off the pieces that you love.
          </p>
          <p style={{ color: "#888780" }} className="text-sm mt-8 italic">
            now live testing in beta
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6" style={{ borderTop: "1px solid #D3CEBF" }}>
        <div className="max-w-6xl mx-auto text-center">
          <div style={{ fontFamily: "'Crooked', serif", fontSize: "24px", color: "#2C2A22" }} className="mb-4">
            gallery club
          </div>
          <p style={{ color: "#888780" }} className="text-sm">
            for artists. for art. for friends.
          </p>
          <div style={{ color: "#888780" }} className="text-xs mt-6 flex items-center justify-center gap-4">
            <Link href="/terms" className="hover:opacity-70 transition-opacity">
              terms
            </Link>
            <Link href="/privacy" className="hover:opacity-70 transition-opacity">
              privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
