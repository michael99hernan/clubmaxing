"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../CurrentUserContext";

type User = {
  id: string;
  name: string;
  email: string;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function UserPicker({ users }: { users: User[] }) {
  const router = useRouter();
  const { setCurrentUser } = useCurrentUser();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users.slice(0, 20); // don't render all 100+ until the user types
    return users
      .filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [query, users]);

  function selectUser(user: User) {
    setCurrentUser(user);
    router.push("/events");
  }

  if (users.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No users exist yet — create one via the backend first.
      </p>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} // delay so the click on an option registers first
        placeholder="Search by name or email..."
        className="w-full border border-neutral-300 rounded-full px-4 py-2.5 text-sm bg-white/70 focus:bg-white outline-none focus:ring-2 focus:ring-fuchsia-500/20"
      />

      {open && (
        <div className="absolute z-10 mt-2 w-full max-h-72 overflow-y-auto border border-neutral-200 rounded-2xl bg-white shadow-lg p-1.5">
          {filtered.length === 0 && (
            <p className="text-sm text-neutral-500 px-3 py-2">No matches.</p>
          )}
          {filtered.map((user) => (
            <button
              key={user.id}
              onClick={() => selectUser(user)}
              className="w-full flex items-center gap-3 text-left px-2.5 py-2 rounded-xl hover:bg-neutral-50"
            >
              <span className="gradient-ring inline-flex shrink-0">
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-white text-xs font-semibold text-neutral-800">
                  {initials(user.name)}
                </span>
              </span>
              <span>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-neutral-500">{user.email}</p>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
