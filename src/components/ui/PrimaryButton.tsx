"use client";

import React from "react";

/**
 * Primary gold action button.
 *
 * Call sites differ in padding, in whether the disabled state also sets
 * `cursor-not-allowed`, and in whether the label sits in a flex row (to make
 * room for a spinner). Each is a prop so no call site's look is flattened.
 *
 * Note: src/components/auth/AuthForm.tsx duplicates this styling but is a
 * protected file and deliberately keeps its own copy.
 */

const BASE =
  "rounded-lg bg-[#c8a040] text-sm font-medium text-[#1a1208] hover:bg-[#e0c060] disabled:opacity-50";

const SIZES = {
  sm: "px-5 py-2",
  md: "px-6 py-2",
  lg: "px-6 py-2.5",
} as const;

export interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: "button" | "submit";
  size?: keyof typeof SIZES;
  /** Adds disabled:cursor-not-allowed. The profile editor omits it. */
  disabledCursor?: boolean;
  /** Lays the label out as a centered flex row with a gap, for a spinner. */
  flex?: boolean;
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  size = "md",
  disabledCursor = true,
  flex = false,
}: PrimaryButtonProps) {
  const className = [
    flex ? "flex items-center justify-center gap-2" : "",
    BASE,
    SIZES[size],
    disabledCursor ? "disabled:cursor-not-allowed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
