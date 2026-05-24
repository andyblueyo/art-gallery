import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center px-6 py-12">
      <Suspense fallback={<div className="text-brown-muted text-sm">Loading…</div>}>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
