"use client";

import { useState } from "react";
import { collectArtwork } from "@/app/actions/collect";

interface CollectButtonProps {
  inventoryItemId: string;
  priceCoins: number;
  editionsRemaining: number;
  collectorCoinBalance: number;
}

/**
 * The full-width button under a gallery piece's title card: "Collect" on the
 * left, price and editions left on the right. Renders nothing once sold out,
 * unless this visitor just collected the last one.
 */
export function CollectButton({
  inventoryItemId,
  priceCoins,
  editionsRemaining,
  collectorCoinBalance,
}: CollectButtonProps) {
  const [remaining, setRemaining] = useState(editionsRemaining);
  const [collected, setCollected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sold out hides the button, except for the person who just collected the
  // last edition, who should still see "Collected ✓".
  if (remaining === 0 && !collected) return null;

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

  return (
    <div className="flex w-full flex-col gap-1">
      <button
        type="button"
        onClick={handleCollect}
        disabled={!canAfford || collected}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 whitespace-nowrap rounded-md border border-[#c8a040]/60 bg-[rgba(18,12,6,0.88)] px-3.5 text-sm font-semibold text-[#c8a040] shadow-[0_6px_14px_rgba(0,0,0,0.25)] transition-colors hover:border-[#c8a040] hover:bg-[rgba(18,12,6,0.95)] disabled:cursor-not-allowed disabled:hover:border-[#c8a040]/60 [&:disabled:not([data-collected])]:opacity-50"
        data-collected={collected ? "" : undefined}
      >
        {collected ? (
          <span>Collected ✓</span>
        ) : (
          <>
            <span>Collect</span>
            <span className="tabular-nums">
              ✦ {priceCoins} · {remaining} left
            </span>
          </>
        )}
      </button>
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
