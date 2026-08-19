"use client";

import Link from "next/link";
import { signIn } from "@/app/login/actions";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isValidHandle, normalizeHandle } from "@/lib/handle";

type Mode = "login" | "signup";

interface AuthFormProps {
  mode: Mode;
}

export function AuthForm({ mode }: AuthFormProps) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [agreedNotAI, setAgreedNotAI] = useState(false);
  const [agreedToS, setAgreedToS] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setHandleError(null);
    setEmailError(null);
    setPasswordError(null);

    let hasFieldError = false;

    // Simple sanity check, same for both modes: something@something
    if (!email.includes("@") || email.trim().startsWith("@") || email.trim().endsWith("@")) {
      setEmailError("Please enter a valid email address.");
      hasFieldError = true;
    }

    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      hasFieldError = true;
    }

    let normalized = "";
    if (mode === "signup") {
      normalized = normalizeHandle(handle);
      if (!isValidHandle(normalized)) {
        setHandleError("Handle must be 3–30 characters, lowercase letters, numbers, and hyphens only.");
        hasFieldError = true;
      }
    }

    if (hasFieldError) return;

    setLoading(true);

    try {
      if (mode === "login") {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        window.location.replace("/dashboard");
      } else {
        if (!agreedNotAI || !agreedToS) {
          throw new Error("Please confirm both checkboxes before creating your account.");
        }
        const supabase = createClient();

        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("handle", normalized)
          .maybeSingle();

        if (existing) {
          setHandleError("That handle is already taken.");
          setLoading(false);
          return;
        }

        const { data: authData, error: signUpError } =
          await supabase.auth.signUp({ email, password });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error("Sign up failed.");

        const { error: profileError } = await supabase.from("profiles").insert({
          id: authData.user.id,
          handle: normalized,
          display_name: displayName.trim() || normalized,
          bio: "",
          location: "",
          instagram_url: "",
          avatar_url: "",
        });

        if (profileError) throw profileError;
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <Link
        href="/"
        className="font-serif text-2xl text-brown hover:text-gold transition-colors"
      >
        gallery club
      </Link>
      <h1 className="mt-8 font-serif text-3xl text-brown">
        {mode === "login" ? "welcome back" : "create your gallery"}
      </h1>
      <p className="mt-2 text-sm text-brown-muted">
        {mode === "login"
          ? "Sign in to manage your portfolio."
          : "Start sharing your art."}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        {mode === "signup" && (
          <>
            <Field
              label="display name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="hella"
              maxLength={50}
            />
            <Field
              label="handle"
              value={handle}
              onChange={(v) => {
                setHandle(v);
                if (handleError) setHandleError(null);
              }}
              placeholder="badartrat"
              maxLength={30}
              hint={
                handleError
                  ? undefined
                  : `${handle ? normalizeHandle(handle) : "your-handle"}.galleryclub.online`
              }
              hasError={!!handleError}
              errorMessage={handleError ?? undefined}
            />
          </>
        )}
        <Field
          label="email"
          type="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            if (emailError) setEmailError(null);
          }}
          required
          hasError={!!emailError}
          errorMessage={emailError ?? undefined}
        />
        <Field
          label="password"
          type="password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            if (passwordError) setPasswordError(null);
          }}
          required
          minLength={6}
          hasError={!!passwordError}
          errorMessage={passwordError ?? undefined}
        />

        {mode === "signup" && (
          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-2 text-sm text-brown-muted">
              <input
                type="checkbox"
                checked={agreedNotAI}
                onChange={(e) => setAgreedNotAI(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 rounded border-[#d8ceb8] text-[#c8a040] focus:ring-[#c8a040]/40"
              />
              <span>
                By checking this box, I solemnly swear that I will only share art that is made by me and no AI generated images will hang in my collection, which I swear upon my still-beating heart. 
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-brown-muted">
              <input
                type="checkbox"
                checked={agreedToS}
                onChange={(e) => setAgreedToS(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 rounded border-[#d8ceb8] text-[#c8a040] focus:ring-[#c8a040]/40"
              />
              <span>
                I agree to the{" "}
                <a
                  href="https://galleryclub.online/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold hover:underline"
                >
                  Terms of Service
                </a>
              </span>
            </label>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || (mode === "signup" && (!agreedNotAI || !agreedToS))}
          className="w-full rounded-lg bg-[#c8a040] py-3 text-sm font-medium text-[#1a1208] transition-colors hover:bg-[#e0c060] disabled:opacity-50"
        >
          {loading
            ? "please wait…"
            : mode === "login"
              ? "sign in"
              : "create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-brown-muted">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="text-gold hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-gold hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  required,
  minLength,
  maxLength,
  hasError,
  errorMessage,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  hasError?: boolean;
  errorMessage?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-brown-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className={`mt-1 w-full rounded-lg border bg-white/60 px-3 py-2.5 text-brown placeholder:text-brown-muted/50 focus:outline-none focus:ring-1 ${
          hasError
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/40"
            : "border-[#d8ceb8] focus:border-[#c8a040] focus:ring-[#c8a040]/40"
        }`}
      />
      {hint && <span className="mt-1 block text-xs text-brown-muted">{hint}</span>}
      {hasError && errorMessage && (
        <span className="mt-1 block text-xs text-red-700">{errorMessage}</span>
      )}
    </label>
  );
}