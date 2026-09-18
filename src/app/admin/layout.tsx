import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Gate for everything under /admin. This only hides the UI: the real
// enforcement is RLS on frames / frame_categories / the frames bucket, all
// of which call the same is_admin() (supabase/migrations/004_frames_catalog.sql).
// Non-admins get a 404 rather than a 403 so the route's existence isn't
// advertised.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/frames");

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || !isAdmin) notFound();

  return (
    <div className="min-h-screen bg-[#f5f0e8] text-[#2a2018]">
      <header className="border-b border-[#d8ceb8] bg-[#faf7f0]">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <span className="font-serif text-lg text-brown">gallery club · admin</span>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin/frames" className="text-brown hover:text-[#c8a040]">frames</Link>
          </nav>
          <Link href="/dashboard" className="ml-auto text-xs text-brown-muted hover:text-brown">← dashboard</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
