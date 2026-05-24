import Link from "next/link";

export function GalleryFooterCTA() {
  return (
    <section className="bg-brown text-cream mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3 text-sm leading-relaxed">
          <SparkleIcon />
          <p>
            are you an artist? create your free gallery in 2 minutes — share
            it anywhere
          </p>
        </div>
        <Link
          href="/signup"
          className="text-sm font-medium hover:text-gold-light transition-colors whitespace-nowrap shrink-0"
        >
          create your gallery ↗
        </Link>
      </div>
    </section>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-gold-light shrink-0 mt-0.5"
    >
      <path d="M12 2l1.4 4.2L17.6 8 13.4 9.8 12 14l-1.4-4.2L6.4 8l4.2-1.8L12 2zM5 16l.8 2.4L8.2 19l-2.4.8L5 22l-.8-2.2L1.8 19l2.4-.6L5 16zm14 0l.8 2.4 2.4.6-2.4.8-.8 2.2-.8-2.2-2.4-.8 2.4-.6L19 16z" />
    </svg>
  );
}
