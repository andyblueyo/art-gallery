import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div style={{ backgroundColor: "#F2EDE3" }} className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b" style={{ borderColor: "#D3CEBF", color: "#2C2A22" }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div style={{ fontFamily: "'Crooked', serif", fontSize: "24px" }}>
            gallery club
          </div>
          <Link href="/login" className="text-sm hover:opacity-70 transition-opacity">
            sign in
          </Link>
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
          a free space for human-made art — no algorithms, no ai images. just artists sharing work they&apos;re proud of.
        </p>

        <Link
          href="/signup"
          style={{ backgroundColor: "#2C2A22", color: "#F2EDE3" }}
          className="px-8 py-3 rounded-lg hover:opacity-90 transition-opacity font-medium mb-6"
        >
          create your gallery
        </Link>

        <p style={{ color: "#888780" }} className="text-sm italic">
          for artists. for art. for friends.
        </p>
      </section>

      {/* 3-Column Pillars */}
      <section className="py-20 px-6" style={{ borderTop: "1px solid #D3CEBF", borderBottom: "1px solid #D3CEBF" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { title: "your layout", desc: "arrange your work exactly how you want it. drag, rotate, resize. full creative control." },
            { title: "human-made only", desc: "celebrate the artists behind each piece. no algorithms deciding what's shown." },
            { title: "always free", desc: "no subscriptions, no fees, no upsell. just a place for artists to share." },
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
            <Link
              href="/badartrat"
              className="block rounded-lg overflow-hidden transition-transform hover:scale-[1.02]"
              style={{ border: "1px solid #D3CEBF" }}
            >
              <div className="bg-gray-200 h-48 flex items-center justify-center" style={{ backgroundColor: "#E8E3D8" }}>
                <span style={{ color: "#888780" }} className="text-sm">
                  Gallery preview
                </span>
              </div>
              <div className="p-4" style={{ color: "#2C2A22" }}>
                <p className="font-medium">badartrat</p>
                <p style={{ color: "#888780" }} className="text-xs">
                  badartrat.galleryclub.online
                </p>
              </div>
            </Link>
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
            hang work you love in your own gallery. curate art from other artists, build a collection, exchange work with friends.
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
