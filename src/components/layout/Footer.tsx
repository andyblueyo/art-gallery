import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer className="border-t border-brown/10 py-8 px-6">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-brown-muted">
        <Wordmark size="sm" />
        <p>
          free portfolio galleries for{" "}
          <span className="text-badge-green font-medium">human-made</span> art
        </p>
      </div>
    </footer>
  );
}
