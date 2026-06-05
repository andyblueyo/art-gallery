"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface HeartButtonProps {
  pieceId: string;
  isOwner?: boolean;
  initialHeartCount?: number;
  isLoggedIn?: boolean;
}

export function HeartButton({
  pieceId,
  isOwner = false,
  initialHeartCount = 0,
  isLoggedIn = false,
}: HeartButtonProps) {
  const [hearted, setHearted] = useState(false);
  const [count, setCount] = useState(initialHeartCount);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
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
  }, [pieceId, isLoggedIn]);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!isLoggedIn || !userId) return;
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
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleClick}
        aria-label={hearted ? "Remove from favorites" : "Add to favorites"}
        className={`p-1.5 rounded-full bg-[rgba(18,12,6,0.55)] backdrop-blur-sm shadow-sm transition-transform ${
          isLoggedIn ? "hover:scale-110 cursor-pointer" : "cursor-default opacity-60"
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={hearted ? "#e05c4a" : "none"}
          stroke={hearted ? "#e05c4a" : "rgba(245,230,200,0.75)"}
          strokeWidth="2"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
      {isOwner && (
        <span className="text-xs text-[#f5e6c8]/80 tabular-nums font-medium leading-none">
          {count}
        </span>
      )}
    </div>
  );
}
