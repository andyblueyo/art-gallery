import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getGalleryUrl } from "@/lib/url";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export default async function HomePage() {
  let isLoggedIn = false;
  let galleryUrl: string | null = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    isLoggedIn = !!user;

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", user.id)
        .single();
      if (profile?.handle) {
        galleryUrl = await getGalleryUrl(profile.handle);
      }
    }
  }

  return (
    <div style={{ backgroundColor: "#F2EDE3" }} className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b" style={{ borderColor: "#D3CEBF", color: "#2C2A22" }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div style={{ fontFamily: "'Crooked', serif", fontSize: "24px" }}>
            gallery club
          </div>
          {isLoggedIn ? (
            <form action={signOut}>
              <button type="submit" className="text-sm hover:opacity-70 transition-opacity">
                sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="text-sm hover:opacity-70 transition-opacity">
              sign in
            </Link>
          )}
        </div>
      </nav>

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

        {galleryUrl ? (
          <a
            href={galleryUrl}
            style={{ backgroundColor: "#2C2A22", color: "#F2EDE3" }}
            className="px-8 py-3 rounded-lg hover:opacity-90 transition-opacity font-medium mb-6"
          >
            view my gallery
          </a>
        ) : (
          <Link
            href="/signup"
            style={{ backgroundColor: "#2C2A22", color: "#F2EDE3" }}
            className="px-8 py-3 rounded-lg hover:opacity-90 transition-opacity font-medium mb-6"
          >
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
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <p style={{ color: "#888780" }} className="text-sm text-center mb-12">
            example galleries
          </p>

          <div className="max-w-sm mx-auto">
            <a
              href="https://badartrat.galleryclub.online"
              className="block rounded-lg overflow-hidden transition-transform hover:scale-[1.02]"
              style={{ border: "1px solid #D3CEBF" }}
            >
              <div className="h-48 overflow-hidden">
                <img src="/art/badartrat-preview.png" alt="badartrat gallery" className="w-full h-full object-cover" />
              </div>
              <div className="p-4" style={{ color: "#2C2A22" }}>
                <p className="font-medium">badartrat</p>
                <p style={{ color: "#888780" }} className="text-xs">
                  badartrat.galleryclub.online
                </p>
              </div>
            </a>
          </div>
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
            coming soon
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
        </div>
      </footer>
    </div>
  );
}
