"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface MyPurchasesProps {
  userId: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  artwork_image_url: string | null;
  artwork_title: string | null;
  edition_number: number | null;
  created_at: string;
  to_user: string;
  from_user: string;
}

interface ArtistProfile {
  handle: string;
  display_name: string | null;
}

function TypeBadge({ type }: { type: string }) {
  if (type === "purchase")
    return <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">purchase</span>;
  if (type === "removal")
    return <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">removed by artist</span>;
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-[#ede7da] text-brown-muted">{type}</span>;
}

export function MyPurchases({ userId }: MyPurchasesProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ArtistProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPurchases() {
      const supabase = createClient();

      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .eq("from_user", userId)
        .in("type", ["purchase", "removal"])
        .order("created_at", { ascending: false });

      const rows = (txData ?? []) as Transaction[];
      setTransactions(rows);

      const artistIds = Array.from(new Set(rows.map((t) => t.to_user).filter(Boolean)));
      if (artistIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, handle, display_name")
          .in("id", artistIds);
        const map: Record<string, ArtistProfile> = {};
        for (const p of (profiles ?? []) as { id: string; handle: string; display_name: string | null }[]) {
          map[p.id] = { handle: p.handle, display_name: p.display_name };
        }
        setProfileMap(map);
      }

      setLoading(false);
    }
    fetchPurchases();
  }, [userId]);

  const purchaseRows = transactions.filter((t) => t.type === "purchase");
  const removalRows = transactions.filter((t) => t.type === "removal");

  const totalSpent = purchaseRows.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const artworksCollected = purchaseRows.length;
  const refundCount = removalRows.length;
  const refundTotal = removalRows.reduce((sum, t) => sum + (t.amount ?? 0), 0);

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-[#ede7da] animate-pulse" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-[#ede7da] animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#d8ceb8] bg-white/30 p-4 text-center">
          <p className="font-serif text-2xl text-[#2a2018]">{totalSpent}</p>
          <p className="text-xs text-brown-muted mt-1">coins spent</p>
        </div>
        <div className="rounded-xl border border-[#d8ceb8] bg-white/30 p-4 text-center">
          <p className="font-serif text-2xl text-[#2a2018]">{artworksCollected}</p>
          <p className="text-xs text-brown-muted mt-1">artworks collected</p>
        </div>
        <div className="rounded-xl border border-[#d8ceb8] bg-white/30 p-4 text-center">
          <p className="font-serif text-2xl text-[#2a2018]">{refundCount}</p>
          <p className="text-xs text-brown-muted mt-1">
            {refundCount === 1 ? "refund" : "refunds"}{refundTotal > 0 ? ` · +${refundTotal}` : ""}
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-[#d8ceb8] bg-white/30 py-16 text-center">
          <p className="text-brown-muted text-sm">no purchases yet · browse galleries to find art you love</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#d8ceb8] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#d8ceb8] bg-[#ede7da]/50">
                <th className="text-left px-4 py-3 text-xs text-brown-muted font-normal">artwork</th>
                <th className="text-left px-4 py-3 text-xs text-brown-muted font-normal">edition</th>
                <th className="text-left px-4 py-3 text-xs text-brown-muted font-normal">artist</th>
                <th className="text-left px-4 py-3 text-xs text-brown-muted font-normal">date</th>
                <th className="text-right px-4 py-3 text-xs text-brown-muted font-normal">amount</th>
                <th className="text-right px-4 py-3 text-xs text-brown-muted font-normal">type</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const artist = profileMap[t.to_user];
                const isRemoval = t.type === "removal";
                return (
                  <tr
                    key={t.id}
                    className="border-b border-[#d8ceb8] last:border-0 hover:bg-white/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {isRemoval && !t.artwork_image_url ? (
                          <div className="w-10 h-10 rounded bg-[#ede7da] flex-shrink-0 flex items-center justify-center">
                            <span className="text-[10px] text-brown-muted leading-tight text-center">unavail&shy;able</span>
                          </div>
                        ) : t.artwork_image_url ? (
                          <img
                            src={t.artwork_image_url}
                            alt={t.artwork_title ?? ""}
                            className="w-10 h-10 rounded object-cover bg-[#ede7da] flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-[#ede7da] flex-shrink-0" />
                        )}
                        <span className="text-[#2a2018]">{t.artwork_title ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brown-muted">
                      {t.edition_number != null ? `#${t.edition_number}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-brown-muted">
                      {artist ? `@${artist.handle}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-brown-muted whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isRemoval ? (
                        <span className="text-green-700">+{t.amount}</span>
                      ) : (
                        <span className="text-[#2a2018]">−{t.amount}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TypeBadge type={t.type} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
