"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface MySalesProps {
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

function TypeBadge({ type }: { type: string }) {
  if (type === "purchase")
    return <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">sale</span>;
  if (type === "return")
    return <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">return</span>;
  if (type === "removal")
    return <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">clawback</span>;
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-[#ede7da] text-brown-muted">{type}</span>;
}

export function MySales({ userId }: MySalesProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSales() {
      const supabase = createClient();
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .or(
          `and(to_user.eq.${userId},type.eq.purchase),and(from_user.eq.${userId},type.eq.removal),and(to_user.eq.${userId},type.eq.return)`
        )
        .order("created_at", { ascending: false });
      setTransactions((data ?? []) as Transaction[]);
      setLoading(false);
    }
    fetchSales();
  }, [userId]);

  const purchaseRows = transactions.filter((t) => t.type === "purchase");
  const returnRows = transactions.filter((t) => t.type === "return");

  const totalEarned = purchaseRows.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const editionsSold = purchaseRows.length;
  const totalReturned = returnRows.length;

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
          <p className="font-serif text-2xl text-[#2a2018]">{totalEarned}</p>
          <p className="text-xs text-brown-muted mt-1">coins earned</p>
        </div>
        <div className="rounded-xl border border-[#d8ceb8] bg-white/30 p-4 text-center">
          <p className="font-serif text-2xl text-[#2a2018]">{editionsSold}</p>
          <p className="text-xs text-brown-muted mt-1">editions sold</p>
        </div>
        <div className="rounded-xl border border-[#d8ceb8] bg-white/30 p-4 text-center">
          <p className="font-serif text-2xl text-[#2a2018]">{totalReturned}</p>
          <p className="text-xs text-brown-muted mt-1">total returned</p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-[#d8ceb8] bg-white/30 py-16 text-center">
          <p className="text-brown-muted text-sm">no sales yet · keep creating</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#d8ceb8] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#d8ceb8] bg-[#ede7da]/50">
                <th className="text-left px-4 py-3 text-xs text-brown-muted font-normal">artwork</th>
                <th className="text-left px-4 py-3 text-xs text-brown-muted font-normal">edition</th>
                <th className="text-left px-4 py-3 text-xs text-brown-muted font-normal">date</th>
                <th className="text-right px-4 py-3 text-xs text-brown-muted font-normal">amount</th>
                <th className="text-right px-4 py-3 text-xs text-brown-muted font-normal">type</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[#d8ceb8] last:border-0 hover:bg-white/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {t.artwork_image_url ? (
                        <img
                          src={t.artwork_image_url}
                          alt={t.artwork_title ?? ""}
                          className="w-10 h-10 rounded object-cover bg-[#ede7da] flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-[#ede7da] flex-shrink-0" />
                      )}
                      <span className="text-[#2a2018]">
                        {t.type === "return"
                          ? `a piece was returned · ${t.artwork_title ?? ""}`
                          : (t.artwork_title ?? "—")}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-brown-muted">
                    {t.edition_number != null ? `#${t.edition_number}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-brown-muted whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {t.type === "removal" ? (
                      <span className="text-red-500">−{t.amount}</span>
                    ) : t.type === "purchase" ? (
                      <span className="text-[#2a2018]">+{t.amount}</span>
                    ) : (
                      <span className="text-brown-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <TypeBadge type={t.type} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
