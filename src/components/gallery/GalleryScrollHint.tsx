"use client";

import React from "react";

/**
 * One-time hint that the custom-layout wall scrolls on both axes. Shown once
 * per visitor across every artist gallery, then never again.
 */

const COOKIE_NAME = "gc_scroll_hint_seen";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
/** How long the pill stays up if the visitor doesn't scroll first. */
const VISIBLE_MS = 4000;
const FADE_MS = 400;

// Every artist gallery is its own subdomain, so the flag has to live on a
// cookie scoped to the parent domain — localStorage would re-show the hint on
// each new gallery. This derivation is deliberately duplicated from the
// Supabase clients rather than shared: those files are protected and must not
// grow new imports or exports.
const COOKIE_DOMAIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "").includes(
  "galleryclub.online"
)
  ? ".galleryclub.online"
  : undefined;

/**
 * A read we can't complete is treated as "not seen yet" — better a repeat hint
 * than none at all.
 */
function hasSeenHint(): boolean {
  try {
    return document.cookie
      .split("; ")
      .some((entry) => entry === `${COOKIE_NAME}=1`);
  } catch {
    return false;
  }
}

function rememberHintShown(): void {
  try {
    const domain = COOKIE_DOMAIN ? `; domain=${COOKIE_DOMAIN}` : "";
    document.cookie =
      `${COOKIE_NAME}=1; max-age=${COOKIE_MAX_AGE_SECONDS}` +
      `; path=/; SameSite=Lax${domain}`;
  } catch {
    // Nothing to recover from; the hint may simply show again.
  }
}

/**
 * The wall's two axes scroll on different elements: horizontally on the scroll
 * container, vertically on the window (GalleryMinimap reads both). Either one
 * overflowing is enough for the hint to be worth showing.
 */
function wallScrolls(scroller: HTMLDivElement | null): boolean {
  const horizontal = scroller
    ? scroller.scrollWidth > scroller.clientWidth + 1
    : false;
  const vertical =
    document.documentElement.scrollHeight > window.innerHeight + 1;
  return horizontal || vertical;
}

export function GalleryScrollHint({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement>;
}) {
  // "pending" renders nothing, so the cookie is read before the first visible
  // paint and returning visitors never see a flash.
  const [phase, setPhase] = React.useState<
    "pending" | "visible" | "fading" | "done"
  >("pending");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasSeenHint()) return;
    if (!wallScrolls(scrollRef.current)) return;

    // Set on show, not on dismiss: a visitor who saw it has seen it.
    rememberHintShown();
    setPhase("visible");

    const scroller = scrollRef.current;
    const dismiss = () => setPhase("fading");
    const timer = setTimeout(dismiss, VISIBLE_MS);

    window.addEventListener("scroll", dismiss, { passive: true });
    window.addEventListener("touchstart", dismiss, { passive: true });
    scroller?.addEventListener("scroll", dismiss, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", dismiss);
      window.removeEventListener("touchstart", dismiss);
      scroller?.removeEventListener("scroll", dismiss);
    };
  }, [scrollRef]);

  React.useEffect(() => {
    if (phase !== "fading") return;
    const timer = setTimeout(() => setPhase("done"), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "pending" || phase === "done") return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        // Under the minimap's 50, over the wall's own z-10 stacking context.
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Keeps the line off the edges when it wraps on a narrow screen.
        padding: "0 32px",
        background: "rgba(18,12,6,0.42)",
        // The scrim covers the whole viewport, so without this nothing on the
        // wall would be clickable while the hint is up.
        pointerEvents: "none",
        opacity: phase === "fading" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
    >
      <p className="text-center font-serif text-[17px] leading-[1.5] text-[#f5e6c8] sm:text-[19px]">
        scroll in any direction to explore the gallery
      </p>
    </div>
  );
}
