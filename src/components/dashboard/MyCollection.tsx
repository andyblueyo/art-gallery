"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { returnArtwork } from "@/app/actions/return-artwork";

interface MyCollectionProps {
  userId: string;
}

export function MyCollection({ userId }: MyCollectionProps) {
  const [pieces, setPieces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCollection() {
      const supabase = createClient();
      const { data } = await supabase
        .from("inventory_items")
        .select("id, edition_number, acquired_at, artworks(id, title, file_url, edition_total, artist_id, profiles(handle, display_name))")
        .eq("owned_by", userId)
        .order("acquired_at", { ascending: false });
      setPieces((data ?? []).filter((p: any) => p.artworks?.artist_id !== userId));
      setLoading(false);
    }
    fetchCollection();
  }, [userId]);

  async function handleReturn() {
    if (!confirmingId) return;
    setReturning(true);
    setReturnError(null);
    const result = await returnArtwork(confirmingId);
    if ("error" in result) {
      setReturnError(result.error);
      setReturning(false);
    } else {
      setPieces((prev) => prev.filter((p) => p.id !== confirmingId));
      setConfirmingId(null);
      setReturning(false);
    }
  }

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

  const confirmingPiece = pieces.find((p) => p.id === confirmingId);

  return (
    <>
      <section className="space-y-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pieces.map((piece) => {
            const artwork = piece.artworks;
            const handle = artwork.profiles.handle;
            const name = artwork.profiles.display_name ?? handle;
            return (
              <div key={piece.id} className="group relative rounded-xl overflow-hidden border border-[#d8ceb8] bg-white/30 hover:border-[#c8a040] transition-colors">
                <a href={`https://${handle}.galleryclub.online`} className="block">
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
                <button
                  onClick={() => {
                    setReturnError(null);
                    setConfirmingId(piece.id);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white text-brown-muted hover:text-brown text-xs px-2 py-1 rounded-md border border-[#d8ceb8]"
                >
                  return
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Confirmation modal */}
      {confirmingId && confirmingPiece && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-[#faf7f0] rounded-xl border border-[#d8ceb8] p-6 max-w-sm w-full space-y-4">
            <h2 className="text-brown font-medium text-base">
              return this piece?
            </h2>
            <p className="text-brown-muted text-sm leading-relaxed">
              <span className="font-medium text-brown">
                {confirmingPiece.artworks.title}
              </span>{" "}
               will be removed from your collection and returned to the artist&apos;s gallery. no coins will be refunded. this cannot be undone.
            </p>
            {returnError && (
              <p className="text-red-500 text-xs">{returnError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setConfirmingId(null);
                  setReturnError(null);
                }}
                disabled={returning}
                className="flex-1 rounded-lg border border-[#d8ceb8] bg-white/50 px-4 py-2 text-sm text-brown-muted hover:bg-white transition-colors disabled:opacity-50"
              >
                cancel
              </button>
              <button
                onClick={handleReturn}
                disabled={returning}
                className="flex-1 rounded-lg bg-[#3b2a1a] px-4 py-2 text-sm text-[#faf7f0] hover:bg-[#2a1d10] transition-colors disabled:opacity-50"
              >
                {returning ? "returning…" : "yes, return it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}