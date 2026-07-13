"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RSVP = {
  user_id: string;
  status: string;
};

type User = {
  id: string;
  email: string;
  name: string;
};

const STATUS_STYLES: Record<string, string> = {
  joined: "bg-green-50 text-green-700 border-green-200",
  waitlisted: "bg-yellow-50 text-yellow-700 border-yellow-200",
  pending: "bg-blue-50 text-blue-700 border-blue-200",
  declined: "bg-neutral-50 text-neutral-500 border-neutral-200",
};

export default function EventActions({
  eventId,
  rsvps,
  users,
}: {
  eventId: string;
  rsvps: RSVP[];
  users: User[];
}) {
  const router = useRouter();
  const [actingAs, setActingAs] = useState(users[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userName = (id: string) =>
    users.find((u) => u.id === id)?.name ?? id.slice(0, 8);

  async function call(path: string, method: "POST" = "POST") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: path.includes("/approve") || path.includes("/decline")
          ? undefined
          : JSON.stringify({ user_id: actingAs }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const pending = rsvps.filter((r) => r.status === "pending");
  const others = rsvps.filter((r) => r.status !== "pending");

  // Only show "Leave" if the currently-acting-as user actually has an
  // active RSVP (joined/waitlisted/pending) — otherwise there's nothing
  // to leave, and clicking it would just hit a 500 from DeleteRSVP running
  // against a nonexistent row.
  const myRSVP = rsvps.find((r) => r.user_id === actingAs);
  const canLeave = myRSVP && myRSVP.status !== "declined";

  return (
    <div className="flex flex-col gap-6">
      <div className="border border-neutral-200 rounded-lg p-4 bg-white">
        <label className="block text-sm font-medium mb-1">Acting as</label>
        <select
          value={actingAs}
          onChange={(e) => setActingAs(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm mb-3"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            disabled={busy || !actingAs}
            onClick={() => call(`/events/${eventId}/join`)}
            className="bg-neutral-900 text-white text-sm px-3 py-1.5 rounded-md hover:bg-neutral-700 disabled:opacity-50"
          >
            Join
          </button>
          {canLeave && (
            <button
              disabled={busy}
              onClick={() => call(`/events/${eventId}/leave`)}
              className="border border-neutral-300 text-sm px-3 py-1.5 rounded-md hover:bg-neutral-50 disabled:opacity-50"
            >
              Leave
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-3">
            {error}
          </p>
        )}
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-2">
            Pending requests{" "}
            <span className="text-neutral-400 font-normal">
              (no auth yet — anyone can approve/decline)
            </span>
          </h2>
          <div className="flex flex-col gap-2">
            {pending.map((r) => (
              <div
                key={r.user_id}
                className="flex items-center justify-between border border-blue-200 bg-blue-50 rounded-md px-3 py-2"
              >
                <span className="text-sm">{userName(r.user_id)}</span>
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() =>
                      call(`/events/${eventId}/rsvps/${r.user_id}/approve`)
                    }
                    className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-500 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      call(`/events/${eventId}/rsvps/${r.user_id}/decline`)
                    }
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
        <h2 className="text-sm font-medium mb-2">RSVPs</h2>
        {others.length === 0 && (
          <p className="text-sm text-neutral-500">No RSVPs yet.</p>
        )}
        <div className="flex flex-col gap-2">
          {others.map((r) => (
            <div
              key={r.user_id}
              className={`flex items-center justify-between border rounded-md px-3 py-2 text-sm ${STATUS_STYLES[r.status] ?? ""}`}
            >
              <span>{userName(r.user_id)}</span>
              <span className="text-xs uppercase tracking-wide">{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
