import type { Artwork } from "@/lib/types";
import { ArtworkFrame } from "./ArtworkFrame";

interface GalleryGridProps {
  artworks: Artwork[];
}

export function GalleryGrid({ artworks }: GalleryGridProps) {
  if (artworks.length === 0) {
    return (
      <div className="text-center py-24 text-brown-muted">
        <p className="text-lg">No artworks yet.</p>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
        {artworks.map((artwork) => (
          <ArtworkFrame
            key={artwork.id}
            artwork={artwork}
            variant="grid"
          />
        ))}
      </div>
    </div>
  );
}
