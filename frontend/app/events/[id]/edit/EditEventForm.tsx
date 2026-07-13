"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../../CurrentUserContext";
import { showToast } from "../../../Toast";

type PgText = { String: string; Valid: boolean };

type Event = {
  id: string;
  title: string;
  description?: string | null | PgText;
  latitude: number;
  longitude: number;
  starts_at: string;
  access_tier: string;
  capacity_max: number | null | { Int32: number; Valid: boolean };
  category?: string | null | PgText;
  invite_policy?: string;
  discoverability?: string;
  cover_photo_url?: string | null | PgText;
  auto_accept?: boolean;
  group_id?: unknown;
};

function hasGroup(groupId: Event["group_id"]): boolean {
  if (groupId === null || groupId === undefined) return false;
  if (typeof groupId === "string") return true;
  if (typeof groupId === "object" && "Valid" in groupId) {
    return (groupId as { Valid: boolean }).Valid;
  }
  return true;
}

const CATEGORIES = ["Sports", "Social", "Learning", "Outdoors", "Music", "Other"];

function textToInput(value: string | null | undefined | PgText): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.Valid ? value.String : "";
  return "";
}

function capacityToInput(capacity: Event["capacity_max"]): string {
  if (capacity === null || capacity === undefined) return "";
  if (typeof capacity === "number") return String(capacity);
  if (typeof capacity === "object") return capacity.Valid ? String(capacity.Int32) : "";
  return "";
}

// datetime-local inputs need "YYYY-MM-DDTHH:mm" with no timezone suffix.
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventForm({ event }: { event: Event }) {
  const router = useRouter();
  const { currentUser, loading } = useCurrentUser();

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(textToInput(event.description));
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(textToInput(event.cover_photo_url));
  const [category, setCategory] = useState(textToInput(event.category));
  const [latitude, setLatitude] = useState(String(event.latitude));
  const [longitude, setLongitude] = useState(String(event.longitude));
  const [startsAt, setStartsAt] = useState(toLocalInputValue(event.starts_at));
  const [accessTier, setAccessTier] = useState(event.access_tier);
  const [invitePolicy, setInvitePolicy] = useState(event.invite_policy ?? "host_only");
  const [discoverability, setDiscoverability] = useState(event.discoverability ?? "public");
  const [autoAccept, setAutoAccept] = useState(event.auto_accept ?? false);
  const [capacityMax, setCapacityMax] = useState(capacityToInput(event.capacity_max));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${event.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.id,
        },
        body: JSON.stringify({
          title,
          description: description || null,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          starts_at: new Date(startsAt).toISOString(),
          access_tier: accessTier,
          capacity_max: capacityMax ? parseInt(capacityMax, 10) : null,
          category: category || null,
          invite_policy: invitePolicy,
          discoverability,
          cover_photo_url: coverPhotoUrl || null,
          auto_accept: autoAccept,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }

      showToast("Event saved!");
      router.push(`/events/${event.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  if (!currentUser) {
    return (
      <p className="text-sm text-neutral-500">
        You need to{" "}
        <a href="/login" className="underline">
          log in
        </a>{" "}
        first.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Description <span className="text-neutral-400">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Cover photo URL <span className="text-neutral-400">(optional)</span>
        </label>
        <input
          value={coverPhotoUrl}
          onChange={(e) => setCoverPhotoUrl(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          placeholder="https://..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Category <span className="text-neutral-400">(optional)</span>
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">No category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Latitude</label>
          <input
            required
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Longitude</label>
          <input
            required
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Starts At</label>
        <input
          required
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Access</label>
        <select
          value={accessTier}
          onChange={(e) => setAccessTier(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="open">Open</option>
          <option value="request">Request to join</option>
          <option value="private">Private</option>
        </select>
      </div>

      {accessTier === "request" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoAccept}
            onChange={(e) => setAutoAccept(e.target.checked)}
          />
          Auto-accept join requests (skip manual approval)
        </label>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Who can invite people</label>
        <select
          value={invitePolicy}
          onChange={(e) => setInvitePolicy(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="host_only">Host (and co-hosts) only</option>
          <option value="attendees">Host, co-hosts, and anyone who's joined</option>
        </select>
      </div>

      {hasGroup(event.group_id) ? (
        <p className="text-sm text-neutral-500">
          Who can see this in event lists is determined by the group&rsquo;s access
          setting: open groups are public, request/private groups are members-only.
        </p>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1">Who can see this in event lists</label>
          <select
            value={discoverability}
            onChange={(e) => setDiscoverability(e.target.value)}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="public">Public — anyone browsing events</option>
            <option value="network">My network — friends only</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">
          Capacity <span className="text-neutral-400">(leave blank for unlimited)</span>
        </label>
        <input
          type="number"
          min="1"
          value={capacityMax}
          onChange={(e) => setCapacityMax(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="btn-gradient py-2.5 text-sm disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
