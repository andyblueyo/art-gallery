"use client";

import React from "react";

/**
 * Secondary outlined button used for "back" / "cancel" steps in the upload
 * flow. All current call sites share one class string exactly.
 */

const BASE =
  "rounded-lg border border-[#d8ceb8] px-4 py-2 text-sm text-brown hover:bg-[#faf7f0]";

export interface SecondaryButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: "button" | "submit";
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: SecondaryButtonProps) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={BASE}>
      {children}
    </button>
  );
}
