"use client";

import { useState } from "react";
import { collectArtwork } from "@/app/actions/collect";

interface CollectButtonProps {
  inventoryItemId: string;
  artworkId: string;
  priceCoins: number;
  editionsRemaining: number;
  collectorCoinBalance: number;
}

export function CollectButton({
  inventoryItemId,
  artworkId,
  priceCoins,
  editionsRemaining,
  collectorCoinBalance,
}: CollectButtonProps) {
  const [remaining, setRemaining] = useState(editionsRemaining);
  const [collected, setCollected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (remaining === 0) return null;

  const canAfford = collectorCoinBalance >= priceCoins;

  async function handleCollect() {
    setCollected(true);
    setRemaining((r) => r - 1);
    setError(null);

    const result = await collectArtwork(inventoryItemId, artworkId);

    if ("error" in result) {
      setCollected(false);
      setRemaining((r) => r + 1);
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleCollect}
        disabled={!canAfford || collected}
        className="rounded-md border border-[#c8a040]/60 bg-[rgba(18,12,6,0.85)] px-3 py-1.5 text-xs text-[#c8a040] backdrop-blur-sm transition-colors hover:border-[#c8a040] hover:bg-[rgba(18,12,6,0.95)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {collected ? "Collected ✓" : `Collect · ✦ ${priceCoins}`}
      </button>
      {error && <p className="text-xs text-red-400 max-w-[120px] text-center">{error}</p>}
    </div>
  );
}
