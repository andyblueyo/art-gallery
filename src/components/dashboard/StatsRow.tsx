interface StatsRowProps {
  pieceCount: number;
  viewCount: number;
  heartCount: number;
}

export function StatsRow({ pieceCount, viewCount, heartCount }: StatsRowProps) {
  return (
    <section className="grid grid-cols-3 gap-3 sm:gap-4">
      <StatBox label="pieces" value={pieceCount} />
      <StatBox label="gallery views" value={viewCount} />
      <StatBox label="hearts received" value={heartCount} />
    </section>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#ede7da] px-3 py-4 text-center sm:px-4 sm:py-5">
      <p className="text-2xl font-bold text-brown sm:text-3xl">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-brown-muted sm:text-xs">
        {label}
      </p>
    </div>
  );
}
