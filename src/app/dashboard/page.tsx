import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { Profile } from "@/lib/types";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-2xl text-brown">dashboard</h1>
          <p className="mt-3 text-sm text-brown-muted leading-relaxed">
            Add your Supabase URL and anon key to{" "}
            <code className="text-xs bg-[#ede7da] px-1 py-0.5 rounded">
              .env.local
            </code>{" "}
            to enable the artist dashboard, then run the schema in{" "}
            <code className="text-xs bg-[#ede7da] px-1 py-0.5 rounded">
              supabase/schema.sql
            </code>
            .
          </p>
          <Link
            href="/mika"
            className="mt-6 inline-block text-sm text-[#c8a040] hover:underline"
          >
            view demo gallery →
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/signup");
  }

  return <Dashboard userId={user.id} initialProfile={profile as Profile} />;
}
