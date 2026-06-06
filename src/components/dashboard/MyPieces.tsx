"use client";

import type { DashboardArtwork } from "@/lib/types";
import { ArtworkCard } from "./ArtworkCard";

interface MyPiecesProps {
  artworks: DashboardArtwork[];
  loading: boolean;
  onUpdate: (artwork: DashboardArtwork) => void;
  onDelete: (id: string) => void;
}

export function MyPieces({
  artworks,
  loading,
  onUpdate,
  onDelete,
}: MyPiecesProps) {
  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="font-serif text-xl text-brown">my pieces</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-[#ede7da] animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  if (artworks.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="font-serif text-xl text-brown">my pieces</h2>
        <div className="rounded-xl border border-[#d8ceb8] bg-white/30 py-16 text-center">
          <div className="mx-auto mb-6 h-24 w-20 rounded-sm border-4 border-[#c8a040] bg-[#faf7f0] shadow-inner" />
          <p className="text-brown-muted text-sm">
            your gallery wall is empty · upload your first piece above
          </p>
        </div>
      </section>
    );
  }

  const sorted = [...artworks].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <section className="space-y-4 pb-16">
      <h2 className="font-serif text-xl text-brown">my pieces</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((artwork, index) => (
          <ArtworkCard
            key={artwork.id}
            artwork={artwork}
            isFirst={index === 0}
            isLast={index === sorted.length - 1}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}
