import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24 sm:py-32 text-center">
      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 bg-white/60 border border-neutral-200 rounded-full px-3 py-1 mb-6">
        <span className="w-1.5 h-1.5 rounded-full gradient-bg" />
        Live near you
      </div>
      <h1 className="text-4xl sm:text-6xl font-semibold mb-5 tracking-tight">
        Find your people.
        <br />
        <span className="gradient-text">Make it happen.</span>
      </h1>
      <p className="text-neutral-600 text-lg mb-10 max-w-xl mx-auto">
        Discover things happening near you, host your own, and bring your
        friends along — all in one place.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href="/events"
          className="btn-gradient inline-block px-6 py-3 text-sm font-medium shadow-md shadow-fuchsia-500/10"
        >
          Browse Events
        </Link>
        <Link
          href="/groups"
          className="inline-block px-6 py-3 rounded-full text-sm font-medium border border-neutral-300 bg-white/70 hover:bg-white transition-colors"
        >
          Explore Groups
        </Link>
      </div>
    </div>
  );
}
