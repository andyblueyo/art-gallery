import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGalleryByHandle } from "@/lib/data";
import { getGalleryUrl } from "@/lib/url";
import { ViewCounter } from "@/components/gallery/ViewCounter";
import { GallerySalonWall } from "@/components/gallery/GallerySalonWall";
import {
  artworksToWallArtworks,
  profileToWallArtist,
} from "@/lib/gallery-wall-map";
import { buildGalleryLayout, GALLERY_WALL_MAX } from "@/lib/gallery-layout";

interface PageProps {
  params: { handle: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const gallery = await getGalleryByHandle(params.handle);

  if (!gallery) {
    return { title: "Gallery not found" };
  }

  const name = gallery.profile.display_name || gallery.profile.handle;
  return {
    title: `${name} (@${gallery.profile.handle})`,
    description:
      gallery.profile.bio ||
      `${name}'s portfolio gallery on artpenny — human-made art.`,
    openGraph: {
      title: `${name} | artpenny`,
      description: gallery.profile.bio || `View ${name}'s art gallery`,
    },
  };
}

export default async function PublicGalleryPage({ params }: PageProps) {
  const gallery = await getGalleryByHandle(params.handle);

  if (!gallery) {
    notFound();
  }

  const galleryUrl = await getGalleryUrl(gallery.profile.handle);
  const wallPieces = gallery.artworks.slice(0, GALLERY_WALL_MAX);
  const layout = buildGalleryLayout(wallPieces.length);
  const wallArtworks = artworksToWallArtworks(wallPieces);

  const artist = profileToWallArtist(
    gallery.profile,
    gallery.artworks.length,
    0
  );

  return (
    <>
      <ViewCounter artistId={gallery.profile.id} />
      <GallerySalonWall
        artist={artist}
        artworks={wallArtworks}
        layout={layout}
        galleryUrl={galleryUrl}
        totalPieceCount={gallery.artworks.length}
        allArtworks={gallery.artworks}
      />
    </>
  );
}
