"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "../CurrentUserContext";
import EventCard, { formatText, type CardEvent } from "./EventCard";

type Event = CardEvent & {
  discoverability?: string;
  created_by?: unknown;
  group_id?: unknown;
};

const CATEGORIES = ["Sports", "Social", "Learning", "Outdoors", "Music", "Other"];

function normalizeUUID(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "Bytes" in value) {
    const bytes = (value as { Bytes: number[] }).Bytes;
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return null;
}

export default function EventsList({ events }: { events: Event[] }) {
  const { currentUser } = useCurrentUser();
  const [category, setCategory] = useState("");
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [groupAccessTiers, setGroupAccessTiers] = useState<Record<string, string>>({});

  useEffect(() => {
    // Group access tiers are needed regardless of login state — an open
    // group's events are public to everyone, logged in or not.
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups`)
      .then((res) => res.json())
      .then(async (groups: { id: string; access_tier: string }[]) => {
        setGroupAccessTiers(
          Object.fromEntries(groups.map((g) => [g.id, g.access_tier]))
        );

        if (!currentUser) {
          setGroupIds([]);
          return;
        }
        // No "my groups" endpoint exists, so this checks membership per
        // group — fine at today's scale, would need a dedicated endpoint
        // if the group list grows large.
        const results = await Promise.all(
          groups.map(async (g) => {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/groups/${g.id}/members`
            );
            if (!res.ok) return null;
            const members: { user_id: string; status: string }[] = await res.json();
            const isMember = members.some(
              (m) => m.user_id === currentUser.id && m.status === "active"
            );
            return isMember ? g.id : null;
          })
        );
        setGroupIds(results.filter((id): id is string => !!id));
      })
      .catch(() => {
        setGroupAccessTiers({});
        setGroupIds([]);
      });

    if (!currentUser) {
      setFriendIds([]);
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/friends`, {
      headers: { "X-User-Id": currentUser.id },
    })
      .then((res) => res.json())
      .then((friends: { id: string }[]) => setFriendIds(friends.map((f) => f.id)))
      .catch(() => setFriendIds([]));
  }, [currentUser]);

  const visibleEvents = useMemo(() => {
    return events.filter((event) => {
      const groupId = normalizeUUID(event.group_id);
      if (groupId) {
        // Group-hosted events: visibility follows the GROUP's access tier,
        // not the event's own discoverability field. An open group's events
        // are visible to everyone; a request/private group's events are
        // only visible to that group's active members.
        const groupTier = groupAccessTiers[groupId];
        const groupIsRestricted = groupTier === "request" || groupTier === "private";
        if (groupIsRestricted && !groupIds.includes(groupId)) return false;
      } else if (event.discoverability === "network") {
        // Personal (non-group) events still use the host's own
        // public/network choice, based on friendship with the host.
        const creatorId = normalizeUUID(event.created_by);
        const inNetwork = !!creatorId && friendIds.includes(creatorId);
        if (!inNetwork) return false;
      }
      if (category && formatText(event.category) !== category) return false;
      return true;
    });
  }, [events, category, friendIds, groupIds, groupAccessTiers]);

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setCategory("")}
          className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
            category === ""
              ? "bg-neutral-900 text-white border-neutral-900"
              : "border-neutral-300 bg-white/70 text-neutral-600 hover:bg-white"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c === category ? "" : c)}
            className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
              category === c
                ? "bg-neutral-900 text-white border-neutral-900"
                : "border-neutral-300 bg-white/70 text-neutral-600 hover:bg-white"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {visibleEvents.length === 0 && (
        <p className="text-neutral-500">No events to show.</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </>
  );
}
