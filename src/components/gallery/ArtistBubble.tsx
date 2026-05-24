"use client";

import { useState } from "react";
import { HumanMadeBadge } from "@/components/ui/HumanMadeBadge";

export interface ArtistBubbleData {
  name: string;
  handle: string;
  bio: string;
  instagram: string;
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
  if (instagram.startsWith("http")) return instagram;
  return `https://${instagram.replace(/^\/+/, "")}`;
}

export function ArtistBubble({ artist, siteOrigin = "artpenny.com" }: ArtistBubbleProps) {
  const [open, setOpen] = useState(false);
  const initials = getInitials(artist.name);
  const instagramHref = formatInstagramUrl(artist.instagram);

  if (!open) {
    return (
      <div className="fixed bottom-5 left-5 z-40">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 border-[#c8a040] bg-[#2a2018] font-serif text-sm font-medium text-[#f5e6c8] shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8a040]/60"
          aria-label="Open artist profile"
        >
          {initials}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 left-5 z-40 w-[min(100vw-2.5rem,340px)]">
      <div className="rounded-2xl border-2 border-[#c8a040] bg-[rgba(18,12,6,0.95)] p-5 shadow-2xl backdrop-blur-sm animate-in-fade">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 rounded p-1 text-[#c8a040]/60 transition-colors hover:text-[#c8a040]"
          aria-label="Close artist profile"
        >
          <span className="text-lg leading-none">×</span>
        </button>

        <h2 className="pr-6 font-serif text-2xl capitalize leading-tight text-[#f5e6c8]">
          {artist.name}
        </h2>
        <p className="mt-1 text-sm text-[#c8a040]/75">
          {siteOrigin}/{artist.handle}
        </p>
        <div className="mt-3">
          <HumanMadeBadge className="text-badge-green-light" />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#e8dcc8]/85">
          {artist.bio}
        </p>
        <p className="mt-4 text-xs tracking-wide text-[#c8a040]/60">
          {artist.pieceCount} pieces · {artist.followers} followers
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-[#c8a040] px-4 py-2 text-sm font-medium text-[#1a1208] transition-colors hover:bg-[#e0c060]"
          >
            Follow
          </button>
          <a
            href={instagramHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[#c8a040]/50 px-4 py-2 text-sm text-[#f5e6c8] transition-colors hover:border-[#c8a040] hover:bg-[#c8a040]/10"
          >
            Instagram
          </a>
        </div>

        <div className="mt-5 flex justify-center border-t border-[#c8a040]/20 pt-4">
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-[#c8a040] bg-[#2a2018] font-serif text-base font-medium text-[#f5e6c8]">
            {initials}
          </div>
        </div>
      </div>
    </div>
  );
}
