"use client";

import { useState } from "react";
import { HumanMadeBadge } from "@/components/ui/HumanMadeBadge";

export interface ArtistBubbleData {
  name: string;
  handle: string;
  bio: string;
  location: string;
  instagram: string;
  avatarUrl?: string;
  pieceCount: number;
  followers: number;
}

interface ArtistBubbleProps {
  artist: ArtistBubbleData;
  siteOrigin?: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatInstagramUrl(instagram: string): string {
  if (!instagram) return "#";
  return `https://instagram.com/${instagram}`;
}

export function ArtistBubble({ artist, siteOrigin = "galleryclub.online" }: ArtistBubbleProps) {
  const [open, setOpen] = useState(false);
  const initials = getInitials(artist.name);
  const instagramHref = formatInstagramUrl(artist.instagram);
  const galleryUrl = `${artist.handle}.${siteOrigin}`;

  if (!open) {
    return (
      <div className="fixed bottom-5 left-5 z-40">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 border-[#c8a040] bg-[#2a2018] font-serif text-sm font-medium text-[#f5e6c8] shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8a040]/60 overflow-hidden"
          aria-label="Open artist profile"
        >
          {artist.avatarUrl ? (
            <img src={artist.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : initials}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 left-5 z-40 w-[min(100vw-2.5rem,340px)]">
      <div className="rounded-2xl border-2 border-[#c8a040] bg-[rgba(18,12,6,0.95)] p-5 shadow-2xl backdrop-blur-sm animate-in-fade">
      <div className="flex items-start gap-3">
  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-[#c8a040] bg-[#2a2018]">
    {artist.avatarUrl ? (
      <img src={artist.avatarUrl} alt="" className="h-full w-full object-cover" />
    ) : (
      <span className="flex h-full w-full items-center justify-center font-serif text-sm text-[#f5e6c8]">{initials}</span>
    )}
  </div>
  <div className="flex-1 min-w-0">
    <div className="flex items-center justify-between">
      <h2 className="font-serif text-xl leading-tight text-[#f5e6c8] break-all">{artist.name}</h2>
      <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-[#c8a040]/60 transition-colors hover:text-[#c8a040]" aria-label="Close artist profile">
        <span className="text-lg leading-none">×</span>
      </button>
    </div>
    <p className="text-sm text-[#c8a040]/75 break-all">{galleryUrl}</p>
    <div className="mt-1"><HumanMadeBadge className="text-badge-green-light" /></div>
  </div>
</div>
        <p className="mt-3 text-sm leading-relaxed text-[#e8dcc8]/85">
          {artist.bio}
        </p>
        {artist.location && (
          <p className="mt-1 text-xs text-[#c8a040]/60">{artist.location}</p>
        )}
        <p className="mt-4 text-xs tracking-wide text-[#c8a040]/60">
          {artist.pieceCount} pieces · {artist.followers} followers
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={instagramHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[#c8a040]/50 px-4 py-2 text-sm text-[#f5e6c8] transition-colors hover:border-[#c8a040] hover:bg-[#c8a040]/10"
          >
            Instagram
          </a>
        </div>
      </div>
    </div>
  );
}
