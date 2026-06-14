"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface MyCollectionProps {
  userId: string;
}

export function MyCollection({ userId }: MyCollectionProps) {
  const [pieces, setPieces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCollection() {
      const supabase = createClient();
      const { data } = await supabase
        .from("inventory_items")
        .select("id, edition_number, acquired_at, artworks(id, title, file_url, edition_total, profiles(handle, display_name))")
        .eq("owned_by", userId)
        .order("acquired_at", { ascending: false });
        setPieces((data ?? []).filter((p: any) => p.artworks?.artist_id !== userId));
      setLoading(false);
    }
    fetchCollection();
  }, [userId]);

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-xl bg-[#ede7da] animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (pieces.length === 0) {
    return (
      <section className="space-y-4">
        <div className="rounded-xl border border-[#d8ceb8] bg-white/30 py-16 text-center">
          <div className="mx-auto mb-6 h-24 w-20 rounded-sm border-4 border-[#c8a040] bg-[#faf7f0] shadow-inner" />
          <p className="text-brown-muted text-sm">
            collect your first piece · browse galleries to find art you love
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 pb-16">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pieces.map((piece) => {
          const artwork = piece.artworks;
          const handle = artwork.profiles.handle;
          const name = artwork.profiles.display_name ?? handle;
          return (
            <a
              key={piece.id}
              href={`https://${handle}.galleryclub.online`}
              className="group block rounded-xl overflow-hidden border border-[#d8ceb8] bg-white/30 hover:border-[#c8a040] transition-colors"
            >
              <div className="aspect-square bg-[#ede7da] overflow-hidden">
                <img
                  src={artwork.file_url}
                  alt={artwork.title}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-brown">{artwork.title}</p>
                <p className="text-xs text-brown-muted">by {name}</p>
                <p className="text-xs text-brown-muted">
                  edition {piece.edition_number} of {artwork.edition_total}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}