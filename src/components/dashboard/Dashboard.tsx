"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DashboardArtwork, Profile } from "@/lib/types";
import { DashboardNav } from "./DashboardNav";
import { ProfileCard } from "./ProfileCard";
import { StatsRow } from "./StatsRow";
import { UploadZone } from "./UploadZone";
import { MyPieces } from "./MyPieces";

interface DashboardProps {
  userId: string;
  initialProfile: Profile;
}

export function Dashboard({ userId, initialProfile }: DashboardProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [artworks, setArtworks] = useState<DashboardArtwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewCount, setViewCount] = useState(0);
  const [heartTotal, setHeartTotal] = useState(0);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const [artRes, viewsRes] = await Promise.all([
      supabase
        .from("artworks")
        .select("*")
        .eq("artist_id", userId)
        .order("display_order", { ascending: true }),
      supabase
        .from("gallery_views")
        .select("id", { count: "exact", head: true })
        .eq("gallery_id", userId),
    ]);

    const pieces = (artRes.data ?? []) as DashboardArtwork[];
    setArtworks(pieces);
    setViewCount(viewsRes.count ?? 0);
    setHeartTotal(
      pieces.reduce((sum, a) => sum + (a.heart_count ?? 0), 0)
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const nextDisplayOrder = useMemo(() => {
    if (artworks.length === 0) return 0;
    return Math.max(...artworks.map((a) => a.display_order)) + 1;
  }, [artworks]);

  const handleOptimisticAdd = useCallback((artwork: DashboardArtwork) => {
    setArtworks((prev) => [...prev, artwork]);
  }, []);

  const handleOptimisticFail = useCallback((tempId: string) => {
    setArtworks((prev) => prev.filter((a) => a.id !== tempId));
  }, []);

  const handleUploaded = useCallback(
    (artwork: DashboardArtwork, tempId: string) => {
      setArtworks((prev) =>
        [...prev.filter((a) => a.id !== tempId), artwork].sort(
          (x, y) => x.display_order - y.display_order
        )
      );
    },
    []
  );

  const handleUpdate = useCallback((updated: DashboardArtwork) => {
    setArtworks((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setArtworks((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleReorder = useCallback(
    async (id: string, direction: "up" | "down") => {
      const sorted = [...artworks].sort(
        (a, b) => a.display_order - b.display_order
      );
      const index = sorted.findIndex((a) => a.id === id);
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= sorted.length) return;

      const a = sorted[index];
      const b = sorted[swapIndex];
      const supabase = createClient();

      await Promise.all([
        supabase
          .from("artworks")
          .update({ display_order: b.display_order })
          .eq("id", a.id),
        supabase
          .from("artworks")
          .update({ display_order: a.display_order })
          .eq("id", b.id),
      ]);

      setArtworks((prev) =>
        prev.map((piece) => {
          if (piece.id === a.id)
            return { ...piece, display_order: b.display_order };
          if (piece.id === b.id)
            return { ...piece, display_order: a.display_order };
          return piece;
        })
      );
    },
    [artworks]
  );

  const realPieces = artworks.filter((a) => !a._uploading);

  return (
    <div className="min-h-screen bg-[#f5f0e8] text-[#2a2018]">
      <div className="mx-auto max-w-[860px] px-5 py-8 sm:px-6 sm:py-10 space-y-10">
        <DashboardNav handle={profile.handle} />
        <ProfileCard profile={profile} onProfileUpdate={setProfile} />
        <StatsRow
          pieceCount={realPieces.length}
          viewCount={viewCount}
          heartCount={heartTotal}
        />
        <UploadZone
          artistId={userId}
          nextDisplayOrder={nextDisplayOrder}
          onOptimisticAdd={handleOptimisticAdd}
          onOptimisticFail={handleOptimisticFail}
          onUploaded={handleUploaded}
        />
        <MyPieces
          artworks={artworks}
          loading={loading}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
      </div>
    </div>
  );
}
