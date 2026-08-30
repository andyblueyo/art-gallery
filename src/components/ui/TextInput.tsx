"use client";

import React from "react";

/**
 * Labeled text input shared by the upload flow and the profile editor.
 *
 * The two families differ in ways that are preserved via props rather than
 * flattened: the profile editor adds a focus ring and an error state, the
 * upload flow does not. `children` carries per-call-site extras that sit
 * inside the label (a <datalist>, or a bespoke hint paragraph).
 */

const INPUT_BASE =
  "mt-1 w-full rounded-lg border bg-white/60 px-3 py-2.5 text-brown focus:outline-none";
const LABEL_TEXT =
  "text-xs font-medium uppercase tracking-wide text-brown-muted";

export interface TextInputProps {
  label: React.ReactNode;
  value: string | number;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  maxLength?: number;
  type?: "text" | "number";
  min?: number;
  max?: number;
  /** Wired to the input's `list` attribute; pair with a <datalist> in children. */
  list?: string;
  /** Renders the "12/50" counter under the field. Requires maxLength. */
  counter?: boolean;
  /** Rendered as a block span below the field (profile-editor style). */
  hint?: React.ReactNode;
  hasError?: boolean;
  errorMessage?: string | null;
  /** Adds focus:ring-1 and ringed focus colors. Upload flow leaves this off. */
  focusRing?: boolean;
  /** Extra utilities on the wrapping <label>, e.g. "sm:col-span-2". */
  labelClassName?: string;
  children?: React.ReactNode;
}

export function TextInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  maxLength,
  type = "text",
  min,
  max,
  list,
  counter = false,
  hint,
  hasError = false,
  errorMessage,
  focusRing = false,
  labelClassName,
  children,
}: TextInputProps) {
  const inputClass = [
    INPUT_BASE,
    focusRing ? "focus:ring-1" : "",
    hasError
      ? "border-red-500 focus:border-red-500 focus:ring-red-500/40"
      : focusRing
        ? "border-[#d8ceb8] focus:border-[#c8a040] focus:ring-[#c8a040]/40"
        : "border-[#d8ceb8] focus:border-[#c8a040]",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={labelClassName ? `block ${labelClassName}` : "block"}>
      <span className={LABEL_TEXT}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        max={max}
        list={list}
        className={inputClass}
      />
      {counter && (
        <p className="text-right text-xs text-brown-muted">
          {String(value).length}/{maxLength}
        </p>
      )}
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-brown-muted">{hint}</span>
      )}
      {hasError && errorMessage && (
        <span className="mt-1 block text-xs text-red-700">{errorMessage}</span>
      )}
    </label>
  );
}
