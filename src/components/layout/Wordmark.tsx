import Link from "next/link";

interface WordmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
};

export function Wordmark({ className = "", size = "md" }: WordmarkProps) {
  return (
    <Link
      href="https://galleryclub.online"
      className={`font-serif text-brown hover:text-gold transition-colors ${sizes[size]} ${className}`}
    >
      gallery club
    </Link>
  );
}
