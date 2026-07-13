"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentUser } from "./CurrentUserContext";

type NavItem = { href: string; label: string };
type NavSection = { title: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    title: "Events",
    items: [
      { href: "/events", label: "Explore" },
      { href: "/events/mine", label: "My Events" },
      { href: "/events/invited", label: "Invited" },
      { href: "/events/going", label: "Going" },
      { href: "/events/by-group", label: "By Group" },
    ],
  },
  {
    title: "Friends",
    items: [{ href: "/friends", label: "Friends" }],
  },
  {
    title: "Users",
    items: [{ href: "/users", label: "All Users" }],
  },
];

type MyGroup = {
  id: string;
  name: string;
  created_by?: string | { Bytes: number[]; Valid: boolean } | null;
};

function normalizeUUID(value: MyGroup["created_by"]): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "Bytes" in value) {
    return value.Bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return null;
}

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { currentUser } = useCurrentUser();
  const [myGroups, setMyGroups] = useState<MyGroup[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setMyGroups([]);
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups/mine`, {
      headers: { "X-User-Id": currentUser.id },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then(setMyGroups)
      .catch(() => setMyGroups([]));
  }, [currentUser]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-neutral-200 shadow-xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200/70">
          <span className="font-semibold text-lg gradient-text">ClubMaxing</span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-500"
          >
            ✕
          </button>
        </div>

        <nav className="px-3 py-4 flex flex-col gap-5 overflow-y-auto">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1.5">
                {section.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active =
                    item.href === "/events"
                      ? pathname === "/events"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`text-sm px-3 py-2 rounded-xl transition-colors ${
                        active
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Groups section: has its own "+ create" affordance and lists
              the groups the current user actually belongs to, rather than
              a static "All Groups" link. */}
          <div>
            <div className="flex items-center justify-between px-3 mb-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Groups
              </p>
              <Link
                href="/groups/new"
                onClick={onClose}
                aria-label="Create group"
                title="Create group"
                className="w-5 h-5 flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 text-sm leading-none"
              >
                +
              </Link>
            </div>
            <div className="flex flex-col gap-0.5">
              {myGroups.length === 0 && (
                <p className="px-3 py-1 text-sm text-neutral-400">
                  No groups yet
                </p>
              )}
              {myGroups.map((group) => {
                const href = `/groups/${group.id}`;
                const active = pathname.startsWith(href);
                const isOwner =
                  !!currentUser && normalizeUUID(group.created_by) === currentUser.id;
                return (
                  <Link
                    key={group.id}
                    href={href}
                    onClick={onClose}
                    className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl truncate transition-colors ${
                      active
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {isOwner && (
                      <span title="You own this group" aria-label="Owner">
                        👑
                      </span>
                    )}
                    <span className="truncate">{group.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
