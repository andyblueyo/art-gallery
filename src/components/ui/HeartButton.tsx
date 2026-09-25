"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface HeartButtonProps {
  pieceId: string;
  isOwner?: boolean;
  initialHeartCount?: number;
}

/**
 * The heart "seal": a round badge that sits on the top edge of a gallery
 * piece's title card. The owner's count goes inside it, widening it to a pill.
 * Only rendered for signed-in visitors.
 */
export function HeartButton({
  pieceId,
  isOwner = false,
  initialHeartCount = 0,
}: HeartButtonProps) {
  const [hearted, setHearted] = useState(false);
  const [count, setCount] = useState(initialHeartCount);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase
        .from("hearts")
        .select("id")
        .eq("piece_id", pieceId)
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setHearted(!!data));
    });
  }, [pieceId]);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!userId) return;
    const supabase = createClient();
    if (hearted) {
      setHearted(false);
      setCount((c) => Math.max(0, c - 1));
      await supabase
        .from("hearts")
        .delete()
        .eq("piece_id", pieceId)
        .eq("user_id", userId);
    } else {
      setHearted(true);
      setCount((c) => c + 1);
      await supabase
        .from("hearts")
        .insert({ piece_id: pieceId, user_id: userId });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={hearted ? "Remove from favorites" : "Add to favorites"}
      className={`flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-[#c8a040]/60 bg-[#1a120a] shadow-[0_4px_10px_rgba(0,0,0,0.3)] cursor-pointer transition-colors hover:border-[#c8a040] ${
        isOwner ? "px-3.5" : ""
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={hearted ? "#e05c4a" : "none"}
        stroke={hearted ? "#e05c4a" : "rgba(245,230,200,0.8)"}
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {isOwner && (
        <span className="text-xs font-medium tabular-nums leading-none text-[#f5e6c8]/80">{count}</span>
      )}
    </button>
  );
}
