"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrentUser } from "../../CurrentUserContext";
import { showToast } from "../../Toast";

type Group = {
  id: string;
  name: string;
};

const CATEGORIES = ["Sports", "Social", "Learning", "Outdoors", "Music", "Other"];

export default function NewEventForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, loading } = useCurrentUser();

  // "Duplicate event" support: EventDetail links here with these query params
  // pre-filled from an existing event. Nothing changes about creation itself —
  // this just seeds the same form a normal create would use.
  const [title, setTitle] = useState(searchParams.get("title") ?? "");
  const [description, setDescription] = useState(searchParams.get("description") ?? "");
  const [latitude, setLatitude] = useState(searchParams.get("latitude") ?? "37.7749");
  const [longitude, setLongitude] = useState(searchParams.get("longitude") ?? "-122.4194");
  const [startsAt, setStartsAt] = useState("");
  const [groupId, setGroupId] = useState(searchParams.get("group_id") ?? "");
  const [capacityMax, setCapacityMax] = useState(searchParams.get("capacity_max") ?? "");
  const [accessTier, setAccessTier] = useState(searchParams.get("access_tier") ?? "open");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [invitePolicy, setInvitePolicy] = useState(searchParams.get("invite_policy") ?? "host_only");
  const [discoverability, setDiscoverability] = useState(searchParams.get("discoverability") ?? "public");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(searchParams.get("cover_photo_url") ?? "");
  const [autoAccept, setAutoAccept] = useState(searchParams.get("auto_accept") === "true");
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch the group list once we know who's logged in — a group-hosted
  // event just sets group_id on an otherwise-normal event, per the object
  // model: "group vs. individual" and "public vs. private" are independent.
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups`)
      .then((res) => res.json())
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events`, {
        method: "POST",
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
          created_by: currentUser.id,
          capacity_max: capacityMax ? parseInt(capacityMax, 10) : null,
          access_tier: accessTier,
          group_id: groupId || null,
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

      showToast("Event created!");
      router.push("/events");
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
      <p className="text-sm text-neutral-500">
        Hosting as <span className="font-medium text-neutral-900">{currentUser.name}</span>
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          placeholder="Beach Day"
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
          placeholder="What's this event about?"
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
        <label className="block text-sm font-medium mb-1">
          Hosted by group <span className="text-neutral-400">(optional)</span>
        </label>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Just me (personal event)</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-neutral-400 mt-1">
          You must be a member of a group to host an event under it.
          {groupId && " This event's visibility in listings will follow the group's access setting, not the option below."}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Access</label>
        <select
          value={accessTier}
          onChange={(e) => setAccessTier(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="open">Open — anyone can join instantly</option>
          <option value="request">Request to join — host must approve</option>
          <option value="private">Private — invite only (or via a member group)</option>
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

      {groupId ? (
        <p className="text-sm text-neutral-500 -mt-1">
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
          placeholder="e.g. 2"
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
        {submitting ? "Creating..." : "Create Event"}
      </button>
    </form>
  );
}
