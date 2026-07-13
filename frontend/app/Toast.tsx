"use client";

import { useEffect, useState } from "react";

const EVENT_NAME = "clubmax:toast";

// Fire-and-forget helper — dispatches a browser CustomEvent that the
// singleton <Toast /> mounted in the root layout listens for. Using an
// event instead of context means callers (form components) don't need
// any provider wiring, just `showToast("Saved!")`.
export function showToast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(EVENT_NAME, { detail: message }));
}

export default function Toast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function handle(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      setMessage(detail);
      const timer = setTimeout(() => setMessage(null), 2800);
      return () => clearTimeout(timer);
    }
    window.addEventListener(EVENT_NAME, handle);
    return () => window.removeEventListener(EVENT_NAME, handle);
  }, []);

  if (!message) return null;

  return (
    <div className="fixed top-4 right-4 z-[100]">
      <div className="flex items-center gap-2 rounded-full bg-neutral-900 text-white text-sm px-4 py-2.5 shadow-lg border border-white/10">
        <span className="gradient-bg inline-block w-2 h-2 rounded-full" />
        {message}
      </div>
    </div>
  );
}
