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
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

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
      `${name}'s portfolio gallery on gallery club — human-made art.`,
    openGraph: {
      title: `${name} | gallery club`,
      description: gallery.profile.bio || `View ${name}'s art gallery`,
    },
  };
}

export default async function PublicGalleryPage({ params }: PageProps) {
  console.log("[page /[handle]] rendering for handle =", params.handle);
  const gallery = await getGalleryByHandle(params.handle);

  if (!gallery) {
    console.warn("[page /[handle]] no gallery found for handle:", params.handle);
    notFound();
  }

  console.log("[page /[handle]] gallery fetched:", {
    profileId: gallery.profile.id,
    handle: gallery.profile.handle,
    artworkCount: gallery.artworks.length,
  });

  let isOwner = false;
  let isLoggedIn = false;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    isLoggedIn = !!user;

    if (isLoggedIn && user) {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", user.id)
        .single();

      isOwner = userProfile?.handle === gallery.profile.handle;
    }
  }

  const galleryUrl = await getGalleryUrl(gallery.profile.handle);
  const wallPieces = gallery.artworks.slice(0, GALLERY_WALL_MAX);
  const layout = buildGalleryLayout(wallPieces.length);
  const wallArtworks = artworksToWallArtworks(wallPieces);

  console.log("[page /[handle]] passing to GallerySalonWall:", {
    wallArtworkCount: wallArtworks.length,
    layoutCount: layout.length,
    firstWallArt: wallArtworks[0],
  });

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
        isOwner={isOwner}
        isLoggedIn={isLoggedIn}
        profileId={gallery.profile.id}
        layoutMode={gallery.profile.layout_mode ?? "auto"}
      />
    </>
  );
}
