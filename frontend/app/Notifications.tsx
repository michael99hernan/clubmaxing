"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "./CurrentUserContext";

type NotificationItem = {
  key: string;
  message: string;
  href: string;
  timestamp: string;
};

type FriendRequestRow = { requester_id: string; name: string; created_at: string };
type GroupInviteRow = { group_id: string; group_name: string; created_at: string };
type InvitedEventRow = { id: string; title: string; starts_at: string };
type GoingEventRow = { id: string; title: string; rsvp_status: string; starts_at: string };

const READ_KEY_PREFIX = "clubmax_notifications_read_";
const RSVP_SNAPSHOT_PREFIX = "clubmax_rsvp_snapshot_";

// Everything here is derived from data that already exists via other
// endpoints — no dedicated "notifications" table on the backend. "Read"
// state lives in localStorage per user, which is consistent with how this
// app already tracks "who's logged in" (no real accounts yet), and RSVP
// status *changes* are detected by diffing against a locally cached
// snapshot from the last time this ran, since the API doesn't track a
// history of status transitions.
export default function Notifications() {
  const { currentUser } = useCurrentUser();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentUser) {
      setItems([]);
      return;
    }
    const headers = { "X-User-Id": currentUser.id };
    const base = process.env.NEXT_PUBLIC_API_URL;

    const [friendReqs, groupInvites, eventInvites, going] = await Promise.all([
      fetch(`${base}/friends/requests`, { headers }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${base}/groups/invites/mine`, { headers }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${base}/events/invited`, { headers }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${base}/events/going`, { headers }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);

    const next: NotificationItem[] = [];

    (friendReqs as FriendRequestRow[]).forEach((f) => {
      next.push({
        key: `friend:${f.requester_id}`,
        message: `${f.name} sent you a friend request`,
        href: "/friends",
        timestamp: f.created_at,
      });
    });

    (groupInvites as GroupInviteRow[]).forEach((g) => {
      next.push({
        key: `groupinvite:${g.group_id}`,
        message: `Invited to join ${g.group_name}`,
        href: `/groups/${g.group_id}`,
        timestamp: g.created_at,
      });
    });

    (eventInvites as InvitedEventRow[]).forEach((e) => {
      next.push({
        key: `eventinvite:${e.id}`,
        message: `Invited to ${e.title}`,
        href: `/events/${e.id}`,
        timestamp: e.starts_at,
      });
    });

    // RSVP status changes: compare against what we saw last time.
    const snapshotKey = `${RSVP_SNAPSHOT_PREFIX}${currentUser.id}`;
    const rawSnapshot = localStorage.getItem(snapshotKey);
    const prevSnapshot: Record<string, string> = rawSnapshot ? JSON.parse(rawSnapshot) : {};
    const hadSnapshot = Object.keys(prevSnapshot).length > 0 || rawSnapshot !== null;
    const nextSnapshot: Record<string, string> = {};

    (going as GoingEventRow[]).forEach((g) => {
      nextSnapshot[g.id] = g.rsvp_status;
      const prevStatus = prevSnapshot[g.id];
      if (hadSnapshot && prevStatus && prevStatus !== g.rsvp_status) {
        next.push({
          key: `rsvp:${g.id}:${g.rsvp_status}`,
          message: `Your RSVP for ${g.title} is now ${g.rsvp_status}`,
          href: `/events/${g.id}`,
          timestamp: new Date().toISOString(),
        });
      }
    });
    localStorage.setItem(snapshotKey, JSON.stringify(nextSnapshot));

    next.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setItems(next);

    const readRaw = localStorage.getItem(`${READ_KEY_PREFIX}${currentUser.id}`);
    setReadKeys(readRaw ? new Set(JSON.parse(readRaw)) : new Set());
  }, [currentUser]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  function markAllRead() {
    if (!currentUser) return;
    const allKeys = new Set([...readKeys, ...items.map((i) => i.key)]);
    setReadKeys(allKeys);
    localStorage.setItem(`${READ_KEY_PREFIX}${currentUser.id}`, JSON.stringify([...allKeys]));
  }

  if (!currentUser) return null;

  const unreadCount = items.filter((i) => !readKeys.has(i.key)).length;

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markAllRead();
        }}
        aria-label="Notifications"
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-900/5 text-neutral-700 shrink-0"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M4 13.5V8a5 5 0 0 1 10 0v5.5l1.2 1.5H2.8L4 13.5Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M7.2 16a1.8 1.8 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium leading-4 text-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-80 border border-neutral-200 rounded-2xl bg-white shadow-lg z-20 overflow-hidden">
            <p className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Notifications
            </p>
            <div className="flex flex-col max-h-96 overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 pb-4 text-sm text-neutral-500">You&rsquo;re all caught up.</p>
              )}
              {items.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`px-4 py-2.5 text-sm hover:bg-neutral-50 border-t border-neutral-100 first:border-t-0 ${
                    readKeys.has(item.key) ? "text-neutral-500" : "text-neutral-900 font-medium"
                  }`}
                >
                  {item.message}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
