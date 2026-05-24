export function HumanMadeBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-badge-green ${className}`}
    >
      <SparkleIcon />
      human-made artist
    </span>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-badge-green"
    >
      <path d="M12 2l1.4 4.2L17.6 8 13.4 9.8 12 14l-1.4-4.2L6.4 8l4.2-1.8L12 2zM5 16l.8 2.4L8.2 19l-2.4.8L5 22l-.8-2.2L1.8 19l2.4-.6L5 16zm14 0l.8 2.4 2.4.6-2.4.8-.8 2.2-.8-2.2-2.4-.8 2.4-.6L19 16z" />
    </svg>
  );
}
