"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type TransactionDirection = "sales" | "purchases";

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
  // Only populated for the "sales" direction, which embeds the counterparty
  // via a foreign-key join rather than a second hydrate query.
  buyer?: { handle: string } | null;
}

interface CounterpartyProfile {
  handle: string;
  display_name: string | null;
}

type ProfileMap = Record<string, CounterpartyProfile>;

interface Stat {
  value: number;
  label: string;
}

interface BadgeStyle {
  label: string;
  className: string;
}

interface DirectionConfig {
  /** Supabase select string — "sales" embeds the buyer profile, "purchases" does not. */
  select: string;
  orFilter: (userId: string) => string;
  /**
   * Which column holds the counterparty profile id, or null when the direction
   * resolves the counterparty through an embedded join instead of a second query.
   */
  counterpartyId: ((t: Transaction) => string) | null;
  counterpartyHandle: (t: Transaction, profiles: ProfileMap) => string | null;
  counterpartyHeader: string;
  emptyMessage: string;
  stats: (transactions: Transaction[]) => [Stat, Stat];
  badges: Record<string, BadgeStyle>;
  /** Rows of this type render "—" for edition and counterparty. */
  isMuted: (t: Transaction) => boolean;
  artworkCell: (t: Transaction) => ReactNode;
  amountCell: (t: Transaction) => ReactNode;
}

const BADGE_BASE = "inline-block px-2 py-0.5 rounded-full text-xs";
const BADGE_DEFAULT = "bg-[#ede7da] text-brown-muted";
const BADGE_GREEN = "bg-green-100 text-green-700";
const BADGE_AMBER = "bg-amber-100 text-amber-700";
const BADGE_RED = "bg-red-100 text-red-700";

const sumAmounts = (rows: Transaction[]) =>
  rows.reduce((sum, t) => sum + (t.amount ?? 0), 0);

const CONFIG: Record<TransactionDirection, DirectionConfig> = {
  sales: {
    select: "*, buyer:profiles!transactions_from_user_fkey(handle)",
    orFilter: (userId) =>
      `and(to_user.eq.${userId},type.eq.purchase),and(from_user.eq.${userId},type.eq.removal),and(to_user.eq.${userId},type.eq.return)`,
    counterpartyId: null,
    counterpartyHandle: (t) => t.buyer?.handle ?? null,
    counterpartyHeader: "collector",
    emptyMessage: "no sales yet · keep creating",
    stats: (transactions) => {
      const purchaseRows = transactions.filter((t) => t.type === "purchase");
      return [
        { value: sumAmounts(purchaseRows), label: "coins earned" },
        { value: purchaseRows.length, label: "pieces sold" },
      ];
    },
    badges: {
      purchase: { label: "sale", className: BADGE_GREEN },
      return: { label: "return", className: BADGE_AMBER },
      removal: { label: "clawback", className: BADGE_RED },
    },
    isMuted: (t) => t.type === "return",
    artworkCell: (t) => (
      <>
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
            ? `${t.artwork_title ?? ""}`
            : (t.artwork_title ?? "—")}
        </span>
      </>
    ),
    amountCell: (t) =>
      t.type === "removal" ? (
        <span className="text-red-500">{t.amount}</span>
      ) : t.type === "purchase" ? (
        <span className="text-[#2a2018]">{t.amount}</span>
      ) : (
        <span className="text-brown-muted">—</span>
      ),
  },

  purchases: {
    select: "*",
    orFilter: (userId) =>
      `and(from_user.eq.${userId},type.eq.purchase),and(to_user.eq.${userId},type.eq.removal)`,
    counterpartyId: (t) => (t.type === "removal" ? t.from_user : t.to_user),
    counterpartyHandle: (t, profiles) => {
      const artistId = t.type === "removal" ? t.from_user : t.to_user;
      return profiles[artistId]?.handle ?? null;
    },
    counterpartyHeader: "artist",
    emptyMessage: "no purchases yet · browse galleries to find art you love",
    stats: (transactions) => {
      const purchaseRows = transactions.filter((t) => t.type === "purchase");
      const removalRows = transactions.filter((t) => t.type === "removal");
      return [
        {
          value: sumAmounts(purchaseRows) - sumAmounts(removalRows),
          label: "coins spent",
        },
        {
          value: purchaseRows.length - removalRows.length,
          label: "artworks collected",
        },
      ];
    },
    badges: {
      purchase: { label: "purchase", className: BADGE_GREEN },
      removal: { label: "removed by artist", className: BADGE_RED },
    },
    isMuted: (t) => t.type === "removal",
    artworkCell: (t) => {
      const isRemoval = t.type === "removal";
      return (
        <>
          {isRemoval ? (
            <img
              src="/art/no-file.png"
              alt=""
              className="w-10 h-10 rounded object-cover bg-[#ede7da] flex-shrink-0 opacity-40"
            />
          ) : (
            <img
              src={t.artwork_image_url ?? ""}
              alt={t.artwork_title ?? ""}
              className="w-10 h-10 rounded object-cover bg-[#ede7da] flex-shrink-0"
            />
          )}
          <span
            className={isRemoval ? "text-brown-muted italic" : "text-[#2a2018]"}
          >
            {isRemoval ? "a piece was removed" : (t.artwork_title ?? "—")}
          </span>
        </>
      );
    },
    amountCell: (t) =>
      t.type === "removal" ? (
        <span className="text-green-700">+{t.amount}</span>
      ) : (
        <span className="text-[#2a2018]">{t.amount}</span>
      ),
  },
};

function TypeBadge({
  type,
  badges,
}: {
  type: string;
  badges: Record<string, BadgeStyle>;
}) {
  const badge = badges[type];
  return (
    <span className={`${BADGE_BASE} ${badge?.className ?? BADGE_DEFAULT}`}>
      {badge?.label ?? type}
    </span>
  );
}

const TH_LEFT = "text-left px-4 py-3 text-xs text-brown-muted font-normal";
const TH_RIGHT = "text-right px-4 py-3 text-xs text-brown-muted font-normal";

interface TransactionTableProps {
  userId: string;
  direction: TransactionDirection;
}

export function TransactionTable({ userId, direction }: TransactionTableProps) {
  const config = CONFIG[direction];
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profileMap, setProfileMap] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTransactions() {
      const supabase = createClient();

      const { data: txData } = await supabase
        .from("transactions")
        .select(config.select)
        .or(config.orFilter(userId))
        .order("created_at", { ascending: false });

      const rows = (txData ?? []) as unknown as Transaction[];
      setTransactions(rows);

      if (config.counterpartyId) {
        const profileIds = Array.from(
          new Set(rows.map(config.counterpartyId).filter(Boolean))
        );
        if (profileIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, handle, display_name")
            .in("id", profileIds);
          const map: ProfileMap = {};
          for (const p of (profiles ?? []) as {
            id: string;
            handle: string;
            display_name: string | null;
          }[]) {
            map[p.id] = { handle: p.handle, display_name: p.display_name };
          }
          setProfileMap(map);
        }
      }

      setLoading(false);
    }
    fetchTransactions();
  }, [userId, config]);

  const stats = config.stats(transactions);

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
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
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[#d8ceb8] bg-white/30 p-4 text-center"
          >
            <p className="font-serif text-2xl text-[#2a2018]">{stat.value}</p>
            <p className="text-xs text-brown-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-[#d8ceb8] bg-white/30 py-16 text-center">
          <p className="text-brown-muted text-sm">{config.emptyMessage}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#d8ceb8] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#d8ceb8] bg-[#ede7da]/50">
                <th className={TH_LEFT}>artwork</th>
                <th className={TH_LEFT}>edition</th>
                <th className={TH_LEFT}>{config.counterpartyHeader}</th>
                <th className={TH_LEFT}>date</th>
                <th className={TH_RIGHT}>amount</th>
                <th className={TH_RIGHT}>type</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const muted = config.isMuted(t);
                const handle = config.counterpartyHandle(t, profileMap);
                return (
                  <tr
                    key={t.id}
                    className="border-b border-[#d8ceb8] last:border-0 hover:bg-white/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {config.artworkCell(t)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brown-muted">
                      {muted || t.edition_number == null
                        ? "—"
                        : `#${t.edition_number}`}
                    </td>
                    <td className="px-4 py-3 text-brown-muted">
                      {muted ? "—" : handle ? `@${handle}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-brown-muted whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {config.amountCell(t)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TypeBadge type={t.type} badges={config.badges} />
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
