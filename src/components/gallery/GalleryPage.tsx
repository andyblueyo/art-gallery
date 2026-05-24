"use client";

import type { Profile } from "@/lib/types";
import type { Artwork } from "@/lib/types";
import type { GalleryView } from "@/lib/types";
import { useState } from "react";
import { SiteNav } from "@/components/layout/SiteNav";
import { ViewToggle } from "./ViewToggle";
import { ProfileHeader } from "./ProfileHeader";
import { GalleryStats } from "./GalleryStats";
import { GalleryWall } from "./GalleryWall";
import { GalleryGrid } from "./GalleryGrid";
import { AboutTab } from "./AboutTab";
import { GalleryFooterCTA } from "./GalleryFooterCTA";
import { getCollectionTitle } from "@/lib/profile-utils";

interface GalleryPageProps {
  profile: Profile;
  artworks: Artwork[];
  galleryUrl: string;
}

export function GalleryPage({
  profile,
  artworks,
  galleryUrl,
}: GalleryPageProps) {
  const [view, setView] = useState<GalleryView>("wall");

  const displayName = profile.display_name || profile.handle;
  const collectionTitle = getCollectionTitle(displayName);

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <SiteNav />

      <ProfileHeader
        profile={profile}
        artworks={artworks}
        galleryUrl={galleryUrl}
      />

      <GalleryStats profile={profile} pieceCount={artworks.length} />

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6">
        <ViewToggle view={view} onViewChange={setView} />
      </div>

      <main className="flex-1 pt-8">
        {view === "wall" && (
          <GalleryWall
            artworks={artworks}
            collectionTitle={collectionTitle}
          />
        )}
        {view === "grid" && <GalleryGrid artworks={artworks} />}
        {view === "about" && <AboutTab profile={profile} artworks={artworks} />}
      </main>

      <GalleryFooterCTA />
    </div>
  );
}
