import Link from "next/link";

export default function TermsPage() {
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
            terms of service • last updated: July 2026
          </p>

          <div style={{ color: "#2C2A22" }} className="space-y-8 leading-relaxed">
            <section>
              <h2 style={{ fontFamily: "'Crooked', serif", fontSize: "28px", color: "#2C2A22" }} className="mb-4">
                your art
              </h2>
              <p>
                you own your art. gallery club does not claim ownership over anything you upload. all rights remain yours.
              </p>
            </section>

            <section>
              <h2 style={{ fontFamily: "'Crooked', serif", fontSize: "28px", color: "#2C2A22" }} className="mb-4">
                what&apos;s not allowed
              </h2>
              <p className="mb-4">
                do not upload content that is:
              </p>
              <ul className="space-y-2 ml-6">
                <li>• sexually explicit or pornographic</li>
                <li>• violent, graphic, or disturbing</li>
                <li>• discriminatory, racist, or harassing toward any person or group</li>
                <li>• illegal or in violation of any applicable law</li>
                <li>• copyrighted material you do not have the right to share</li>
                <li>• AI-generated images of any kind</li>
              </ul>
              <p className="mt-4">
                gallery club reserves the right to remove content or accounts that violate these rules.
              </p>
            </section>

            <section>
              <h2 style={{ fontFamily: "'Crooked', serif", fontSize: "28px", color: "#2C2A22" }} className="mb-4">
                your account
              </h2>
              <p>
                you are responsible for the content you upload and the activity on your account.
              </p>
            </section>

            <section>
              <h2 style={{ fontFamily: "'Crooked', serif", fontSize: "28px", color: "#2C2A22" }} className="mb-4">
                email communications
              </h2>
              <p>
              by creating a gallery club account, you agree to receive emails from us about your account, new features, and occasional announcements from the gallery club community. you can opt out of non-essential emails anytime using the unsubscribe link. we don't sell or share your email with third parties for their marketing.
              </p>
            </section>

            <section>
              <h2 style={{ fontFamily: "'Crooked', serif", fontSize: "28px", color: "#2C2A22" }} className="mb-4">
                changes
              </h2>
              <p>
                we may update these terms occasionally. continued use of gallery club means you accept any changes.
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
