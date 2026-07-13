"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "./CurrentUserContext";
import Sidebar from "./Sidebar";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Nav() {
  const { currentUser, loading } = useCurrentUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-30 backdrop-blur-lg bg-white/70 border-b border-neutral-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-900/5 text-neutral-700 shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>

          <Link href="/" className="font-semibold text-lg gradient-text shrink-0">
            ClubMaxing
          </Link>

          <div className="ml-auto flex items-center gap-3">
            {!loading && currentUser && (
              <>
                <Link
                  href="/events/new"
                  className="btn-gradient text-sm px-4 py-1.5 shadow-sm"
                >
                  + New Event
                </Link>
                <Link href="/login" className="flex items-center gap-2 group">
                  <span className="hidden md:inline text-sm text-neutral-600 group-hover:text-neutral-900">
                    {currentUser.name}
                  </span>
                  <span className="gradient-ring inline-flex">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-xs font-semibold text-neutral-800">
                      {initials(currentUser.name)}
                    </span>
                  </span>
                </Link>
              </>
            )}
            {!loading && !currentUser && (
              <Link href="/login" className="btn-gradient text-sm px-4 py-1.5 shadow-sm">
                Log in
              </Link>
            )}
          </div>
        </div>
      </nav>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
