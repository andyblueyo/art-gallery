// Route-level Suspense fallback for a gallery. Streams immediately while the
// page's data queries run.
//
// Deliberately just the wall: the same default plaster colour, grain and
// vignette the real page paints, so the transition is a continuation rather
// than a swap. Pieces can't be placed yet — their positions arrive with the
// data — and the moment they do, FramedArtwork renders every piece as a
// tinted shape at its final size before any image lands. No spinner and no
// minimum duration: the fallback shows for exactly as long as the data takes.
export default function GalleryLoading() {
  return (
    <div
      className="gallery-salon-wall relative min-h-[100dvh] w-full overflow-x-hidden"
      style={{ backgroundColor: "#e8ddd0" }}
      aria-busy="true"
      aria-label="loading gallery"
    >
      <div className="gallery-salon-wall__texture pointer-events-none absolute inset-0" />
      <div className="gallery-salon-wall__vignette pointer-events-none absolute inset-0" />
    </div>
  );
}
