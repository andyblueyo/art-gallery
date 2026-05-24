import type { Artwork } from "@/lib/types";
import { ArtworkFrame } from "./ArtworkFrame";
import { getFrameShapeFromUrl } from "@/lib/frame-utils";

interface GalleryWallProps {
  artworks: Artwork[];
  collectionTitle: string;
}

export function GalleryWall({ artworks, collectionTitle }: GalleryWallProps) {
  if (artworks.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="gallery-wall-container rounded-2xl py-24 text-center text-brown-muted">
          <p className="text-lg">This gallery is waiting for its first piece.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
      <div className="gallery-wall-container rounded-2xl p-6 sm:p-10">
        <p className="text-xs font-medium tracking-widest text-brown-muted uppercase mb-8">
          {collectionTitle}
        </p>
        <div className="flex flex-wrap justify-center items-end gap-5 sm:gap-8 md:gap-10">
          {artworks.map((artwork) => (
            <ArtworkFrame
              key={artwork.id}
              artwork={artwork}
              shape={getFrameShapeFromUrl(artwork.file_url)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
