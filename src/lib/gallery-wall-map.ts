import type { Artwork, Profile } from "@/lib/types";
import type { ArtistBubbleData } from "@/components/gallery/ArtistBubble";
import type { WallArtwork } from "@/lib/gallery-wall-data";

export function profileToWallArtist(
  profile: Profile,
  pieceCount: number,
  followers = 0
): ArtistBubbleData {
  const instagram = profile.instagram_url
    ? profile.instagram_url.replace(/^https?:\/\//, "")
    : "";

  return {
    name: profile.display_name || profile.handle,
    handle: profile.handle,
    bio: profile.bio || "",
    instagram,
    pieceCount,
    followers,
  };
}

export function artworksToWallArtworks(artworks: Artwork[]): WallArtwork[] {
  return artworks.map((a) => ({
    title: a.title,
    medium: a.medium,
    src: a.file_url,
    fileType: a.file_type,
  }));
}
