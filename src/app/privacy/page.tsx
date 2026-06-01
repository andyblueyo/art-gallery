import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div style={{ backgroundColor: "#F2EDE3" }} className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b" style={{ borderColor: "#D3CEBF", color: "#2C2A22" }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" style={{ fontFamily: "'Crooked', serif", fontSize: "24px" }}>
            gallery club
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 style={{ fontFamily: "'Crooked', serif", fontSize: "48px", color: "#2C2A22" }} className="mb-2">
            gallery club
          </h1>
          <p style={{ color: "#888780" }} className="text-sm mb-12">
            privacy policy • last updated: June 2026
          </p>

          <div style={{ color: "#2C2A22" }} className="space-y-8 leading-relaxed">
            <section>
              <h2 style={{ fontFamily: "'Crooked', serif", fontSize: "28px", color: "#2C2A22" }} className="mb-4">
                what we collect
              </h2>
              <p>
                we collect your email address when you sign up, and store the images and profile information you upload.
              </p>
            </section>

            <section>
              <h2 style={{ fontFamily: "'Crooked', serif", fontSize: "28px", color: "#2C2A22" }} className="mb-4">
                how we use it
              </h2>
              <p>
                your data is used only to operate your gallery. we will never sell, rent, or share your personal data with third parties without your explicit permission.
              </p>
            </section>

            <section>
              <h2 style={{ fontFamily: "'Crooked', serif", fontSize: "28px", color: "#2C2A22" }} className="mb-4">
                your data
              </h2>
              <p>
                you can delete your account and all associated data at any time by contacting <a href="mailto:hello@galleryclub.online" className="underline hover:opacity-70">hello@galleryclub.online</a>.
              </p>
            </section>

            <section>
              <h2 style={{ fontFamily: "'Crooked', serif", fontSize: "28px", color: "#2C2A22" }} className="mb-4">
                cookies
              </h2>
              <p>
                gallery club uses cookies only for authentication (keeping you logged in). we do not use tracking or advertising cookies.
              </p>
            </section>

            <section>
              <h2 style={{ fontFamily: "'Crooked', serif", fontSize: "28px", color: "#2C2A22" }} className="mb-4">
                third parties
              </h2>
              <p>
                we use Supabase for database and file storage, and Vercel for hosting. both are subject to their own privacy policies.
              </p>
            </section>

            <section>
              <h2 style={{ fontFamily: "'Crooked', serif", fontSize: "28px", color: "#2C2A22" }} className="mb-4">
                questions?
              </h2>
              <p>
                reach us at <a href="mailto:hello@galleryclub.online" className="underline hover:opacity-70">hello@galleryclub.online</a>
              </p>
            </section>
          </div>
        </div>
      </main>

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
