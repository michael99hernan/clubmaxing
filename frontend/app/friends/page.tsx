"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useCurrentUser } from "../CurrentUserContext";

type User = {
  id: string;
  name: string;
  email: string;
};

type PendingRequest = {
  requester_id: string;
  name: string;
  email: string;
  created_at: string;
};

export default function FriendsPage() {
  const { currentUser, loading } = useCurrentUser();
  const [friends, setFriends] = useState<User[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    const [friendsRes, pendingRes, usersRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/friends`, {
        headers: { "X-User-Id": currentUser.id },
      }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/friends/requests`, {
        headers: { "X-User-Id": currentUser.id },
      }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`),
    ]);
    setFriends(await friendsRes.json());
    setPending(await pendingRes.json());
    setAllUsers(await usersRes.json());
  }, [currentUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !currentUser) return [];
    const friendIds = new Set(friends.map((f) => f.id));
    return allUsers
      .filter(
        (u) =>
          u.id !== currentUser.id &&
          !friendIds.has(u.id) &&
          (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [query, allUsers, friends, currentUser]);

  async function sendRequest(addresseeId: string) {
    if (!currentUser) return;
    setBusy(true);
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
      setQuery("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function respond(requesterId: string, accept: boolean) {
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/friends/requests/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": currentUser.id,
          },
          body: JSON.stringify({ requester_id: requesterId, accept }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function unfriend(otherId: string) {
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/friends/${otherId}`, {
        method: "DELETE",
        headers: { "X-User-Id": currentUser.id },
      });
      if (!res.ok) throw new Error(await res.text());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <p className="text-sm text-neutral-500">
          You need to{" "}
          <a href="/login" className="underline">
            log in
          </a>{" "}
          first.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-8">Friends</h1>

      <div className="relative mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email to add a friend..."
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
        {searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full border border-neutral-200 rounded-md bg-white shadow-lg">
            {searchResults.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-neutral-500">{u.email}</p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => sendRequest(u.id)}
                  className="text-xs bg-neutral-900 text-white px-2 py-1 rounded hover:bg-neutral-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-6">
          {error}
        </p>
      )}

      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium mb-2">Friend requests</h2>
          <div className="flex flex-col gap-2">
            {pending.map((p) => (
              <div
                key={p.requester_id}
                className="flex items-center justify-between border border-blue-200 bg-blue-50 rounded-md px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-neutral-500">{p.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => respond(p.requester_id, true)}
                    className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-500 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => respond(p.requester_id, false)}
                    className="text-xs bg-neutral-200 text-neutral-700 px-2 py-1 rounded hover:bg-neutral-300 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium mb-2">Your friends ({friends.length})</h2>
        {friends.length === 0 && (
          <p className="text-sm text-neutral-500">No friends yet — search above to add some.</p>
        )}
        <div className="flex flex-col gap-2">
          {friends.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between border border-neutral-200 rounded-md px-3 py-2 bg-white"
            >
              <div>
                <p className="text-sm font-medium">{f.name}</p>
                <p className="text-xs text-neutral-500">{f.email}</p>
              </div>
              <button
                disabled={busy}
                onClick={() => unfriend(f.id)}
                className="text-xs text-neutral-500 hover:text-red-600 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
