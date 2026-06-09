import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGalleryByHandle, getPrimaryGalleryId, getGalleryPieces } from "@/lib/data";
import type { GalleryPiece } from "@/lib/types";
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
      `${name}'s gallery on galleryclub.online`,
    openGraph: {
      title: `${name} | gallery club`,
      description: gallery.profile.bio || `View ${name}'s art gallery`,
    },
    icons: {
      icon: gallery.profile.avatar_url || '/favicon.ico',
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

  let galleryPieces: GalleryPiece[] = [];
  if (gallery.profile.layout_mode === "custom") {
    const primaryGalleryId = await getPrimaryGalleryId(gallery.profile.id);
    if (primaryGalleryId) {
      galleryPieces = await getGalleryPieces(primaryGalleryId);
    }
  }

  let isOwner = false;
  let isLoggedIn = false;
  let collectorCoinBalance: number | null = null;
  let collectableItems: Record<string, string> = {};

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

      if (!isOwner) {
        const [{ data: viewerProfile }, { data: items }] = await Promise.all([
          supabase
            .from("profiles")
            .select("coin_balance")
            .eq("id", user.id)
            .single(),
          supabase
            .from("inventory_items")
            .select("id, artwork_id")
            .eq("owned_by", gallery.profile.id)
            .eq("listed_for_sale", true),
        ]);

        collectorCoinBalance = viewerProfile?.coin_balance ?? 0;

        for (const item of items ?? []) {
          if (!collectableItems[item.artwork_id]) {
            collectableItems[item.artwork_id] = item.id;
          }
        }
      }
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
      <ViewCounter galleryId={gallery.profile.id} isOwner={isOwner} />
      <GallerySalonWall
        artist={artist}
        artworks={wallArtworks}
        layout={layout}
        galleryUrl={galleryUrl}
        totalPieceCount={gallery.artworks.length}
        allArtworks={gallery.artworks}
        galleryPieces={galleryPieces}
        isOwner={isOwner}
        isLoggedIn={isLoggedIn}
        profileId={gallery.profile.id}
        layoutMode={gallery.profile.layout_mode ?? "auto"}
        collectorCoinBalance={collectorCoinBalance}
        collectableItems={collectableItems}
      />
    </>
  );
}
