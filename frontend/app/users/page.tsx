"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "../CurrentUserContext";

type User = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function UsersPage() {
  const { currentUser, loading } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [receivedIds, setReceivedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const usersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`);
    setUsers(await usersRes.json());

    if (!currentUser) {
      setFriendIds([]);
      setSentIds([]);
      setReceivedIds([]);
      return;
    }

    const [friendsRes, sentRes, receivedRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/friends`, {
        headers: { "X-User-Id": currentUser.id },
      }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/friends/requests/sent`, {
        headers: { "X-User-Id": currentUser.id },
      }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/friends/requests`, {
        headers: { "X-User-Id": currentUser.id },
      }),
    ]);
    const friends: User[] = await friendsRes.json();
    const sent: { addressee_id: string }[] = await sentRes.json();
    const received: { requester_id: string }[] = await receivedRes.json();
    setFriendIds(friends.map((f) => f.id));
    setSentIds(sent.map((s) => s.addressee_id));
    setReceivedIds(received.map((r) => r.requester_id));
  }, [currentUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function sendRequest(addresseeId: string) {
    if (!currentUser) return;
    setBusyId(addresseeId);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/friends/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.id,
        },
        body: JSON.stringify({ addressee_id: addresseeId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSentIds((prev) => [...prev, addresseeId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight mb-8">Users</h1>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-6">
          {error}
        </p>
      )}

      {users.length === 0 && <p className="text-neutral-500">No users yet.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {users.map((user) => {
          const isSelf = currentUser?.id === user.id;
          const isFriend = friendIds.includes(user.id);
          const requestSent = sentIds.includes(user.id);
          const requestReceived = receivedIds.includes(user.id);

          return (
            <div
              key={user.id}
              className="flex items-center justify-between border border-neutral-200 rounded-2xl p-4 bg-white shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="gradient-ring inline-flex shrink-0">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-white text-xs font-semibold text-neutral-800">
                    {initials(user.name)}
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="font-medium truncate">{user.name}</p>
                  <p className="text-sm text-neutral-500 truncate">{user.email}</p>
                </div>
              </div>

              {!isSelf && currentUser && (
                <div className="shrink-0 ml-3">
                  {isFriend && (
                    <span className="text-xs font-medium uppercase tracking-wide text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                      Friends
                    </span>
                  )}
                  {!isFriend && requestSent && (
                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-500 bg-neutral-100 border border-neutral-200 rounded-full px-2.5 py-1">
                      Request sent
                    </span>
                  )}
                  {!isFriend && !requestSent && requestReceived && (
                    <Link
                      href="/friends"
                      className="text-xs font-medium uppercase tracking-wide text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1 hover:bg-blue-100"
                    >
                      Requested you
                    </Link>
                  )}
                  {!isFriend && !requestSent && !requestReceived && (
                    <button
                      disabled={busyId === user.id}
                      onClick={() => sendRequest(user.id)}
                      className="text-xs border border-neutral-300 bg-white/70 px-3 py-1.5 rounded-full hover:bg-white transition-colors disabled:opacity-50"
                    >
                      Add Friend
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
