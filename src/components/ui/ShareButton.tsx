"use client";

import { useEffect, useState } from "react";

interface ShareButtonProps {
  url: string;
  className?: string;
  variant?: "outline" | "minimal";
}

export function ShareButton({
  url,
  className = "",
  variant = "outline",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(url);

  useEffect(() => {
    // Always prefer the actual browser URL so share works in local dev
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, [url]);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "gallery club", url: shareUrl });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }

    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const baseStyles =
    variant === "outline"
      ? "inline-flex items-center gap-2 px-4 py-2 text-sm border border-brown/25 rounded-lg hover:border-brown/50 transition-colors"
      : "inline-flex items-center gap-2 text-sm hover:text-gold transition-colors";

  return (
    <button onClick={handleShare} className={`${baseStyles} ${className}`}>
      <LinkIcon />
      {copied ? "link copied!" : "share"}
    </button>
  );
}

function LinkIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
