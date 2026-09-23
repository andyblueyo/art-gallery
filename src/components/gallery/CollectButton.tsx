"use client";

import { useState } from "react";
import { collectArtwork } from "@/app/actions/collect";

interface CollectButtonProps {
  inventoryItemId: string;
  priceCoins: number;
  editionsRemaining: number;
  collectorCoinBalance: number;
  /** "touch" grows the tap target to 44px under 768px; desktop is unchanged. */
  size?: "default" | "touch";
  /**
   * "label" is the full-width button at the foot of the phone wall label,
   * with its own divider above it, so both go away together when the last
   * edition sells.
   */
  variant?: "chip" | "label";
}

export function CollectButton({
  inventoryItemId,
  priceCoins,
  editionsRemaining,
  collectorCoinBalance,
  size = "default",
  variant = "chip",
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

    const result = await collectArtwork(inventoryItemId);

    if ("error" in result) {
      setCollected(false);
      setRemaining((r) => r + 1);
      setError(result.error);
    }
  }

  const label = collected ? "Collected ✓" : `Collect · ✦ ${priceCoins}`;

  if (variant === "label") {
    return (
      <div className="mt-3 flex flex-col gap-1 border-t border-[#d9ccb0] pt-3">
        <button
          type="button"
          onClick={handleCollect}
          disabled={!canAfford || collected}
          className={`min-h-[44px] w-full whitespace-nowrap rounded-[3px] border border-[#1f150b] px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
            collected ? "bg-transparent text-[#1f150b]" : "bg-[#1f150b] text-[#f7f0e1] disabled:opacity-50"
          }`}
        >
          {label}
        </button>
        {error && <p className="text-center text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleCollect}
        disabled={!canAfford || collected}
        className={`${size === "touch" ? "max-md:min-h-[44px] max-md:px-4 max-md:text-sm " : ""}rounded-md border border-[#c8a040]/60 bg-[rgba(18,12,6,0.85)] px-3 py-1.5 text-xs text-[#c8a040] backdrop-blur-sm transition-colors hover:border-[#c8a040] hover:bg-[rgba(18,12,6,0.95)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap`}
      >
        {label}
      </button>
      {error && <p className="text-xs text-red-400 max-w-[120px] text-center">{error}</p>}
    </div>
  );
}
