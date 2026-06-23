"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DashboardArtwork, Profile } from "@/lib/types";
import { DashboardNav } from "./DashboardNav";
import { ProfileCard } from "./ProfileCard";
import { StatsRow } from "./StatsRow";
import { UploadZone } from "./UploadZone";
import { MyPieces } from "./MyPieces";
import { MyCollection } from "./MyCollection";

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
  const [activeTab, setActiveTab] = useState<"pieces" | "collection">("pieces");

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const [artRes, viewsRes] = await Promise.all([
      supabase
        .from("artworks")
        .select("*")
        .eq("artist_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
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
          (x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
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

  const realPieces = artworks.filter((a) => !a._uploading);

  return (
    <div className="min-h-screen bg-[#f5f0e8] text-[#2a2018]">
      <div className="mx-auto max-w-[860px] px-5 py-8 sm:px-6 sm:py-10 space-y-10">
        <DashboardNav handle={profile.handle} coinBalance={profile.coin_balance ?? 0}/>
        <ProfileCard profile={profile} onProfileUpdate={setProfile} />
        <StatsRow
          pieceCount={realPieces.length}
          viewCount={viewCount}
          heartCount={heartTotal}
        />
        <UploadZone
          artistId={userId}
          onOptimisticAdd={handleOptimisticAdd}
          onOptimisticFail={handleOptimisticFail}
          onUploaded={handleUploaded}
        />
{/* Tab bar */}
<div className="flex gap-8 border-b border-[#d8ceb8]">
  <button
    onClick={() => setActiveTab("pieces")}
    className={`pb-2 text-sm font-serif text-xl transition-colors ${
      activeTab === "pieces"
        ? "text-brown border-b-2 border-[#2a2018] -mb-px"
        : "text-brown-muted"
    }`}
  >
    my pieces
  </button>
  <button
    onClick={() => setActiveTab("collection")}
    className={`pb-2 text-sm font-serif text-xl transition-colors ${
      activeTab === "collection"
        ? "text-brown border-b-2 border-[#2a2018] -mb-px"
        : "text-brown-muted"
    }`}
  >
    my collection
  </button>
</div>

{activeTab === "pieces" && (
  <MyPieces
    artworks={artworks}
    loading={loading}
    onUpdate={handleUpdate}
    onDelete={handleDelete}
    userId={userId}
  />
)}
{activeTab === "collection" && (
  <MyCollection userId={userId} />
)}
      </div>
    </div>
  );
}
