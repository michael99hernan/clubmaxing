"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "../../CurrentUserContext";
import EventCard, { type CardEvent } from "../EventCard";

type Group = {
  id: string;
  name: string;
  access_tier: string;
};

type GroupWithEvents = Group & { events: CardEvent[] };

export default function EventsByGroupPage() {
  const { currentUser } = useCurrentUser();
  const [groups, setGroups] = useState<GroupWithEvents[]>([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setGroups([]);
      setFetched(true);
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups`)
      .then((res) => res.json())
      .then(async (allGroups: Group[]) => {
        const withEvents = await Promise.all(
          allGroups.map(async (g) => {
            // Only groups the current user is actually an active member of
            // — regardless of the group's own access tier.
            const membersRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/groups/${g.id}/members`
            );
            if (!membersRes.ok) return null;
            const members: { user_id: string; status: string }[] = await membersRes.json();
            const isMember = members.some(
              (m) => m.user_id === currentUser.id && m.status === "active"
            );
            if (!isMember) return null;

            const eventsRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/groups/${g.id}/events`
            );
            const events: CardEvent[] = eventsRes.ok ? await eventsRes.json() : [];
            return { ...g, events };
          })
        );
        setGroups(withEvents.filter((g): g is GroupWithEvents => !!g && g.events.length > 0));
      })
      .catch(() => setGroups([]))
      .finally(() => setFetched(true));
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
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
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Events by Group</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Upcoming events from groups you&rsquo;re a member of.
        </p>
      </div>

      {fetched && groups.length === 0 && (
        <p className="text-neutral-500">
          No events from your groups right now — join a group to see its events here.
        </p>
      )}

      <div className="flex flex-col gap-10">
        {groups.map((group) => (
          <div key={group.id}>
            <div className="flex items-center gap-2 mb-3">
              <Link
                href={`/groups/${group.id}`}
                className="font-medium text-lg hover:underline"
              >
                {group.name}
              </Link>
              <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 border border-neutral-200 rounded-full px-2 py-0.5">
                {group.access_tier}
              </span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
