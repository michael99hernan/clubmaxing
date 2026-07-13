"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "../../CurrentUserContext";
import EventCard, { type CardEvent } from "../EventCard";

export default function InvitedEventsPage() {
  const { currentUser, loading } = useCurrentUser();
  const [events, setEvents] = useState<CardEvent[]>([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/invited`, {
      headers: { "X-User-Id": currentUser.id },
    })
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setFetched(true));
  }, [currentUser]);

  if (loading) return null;

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
        <h1 className="text-3xl font-semibold tracking-tight">Invited</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Events people have invited you to.
        </p>
      </div>

      {fetched && events.length === 0 && (
        <p className="text-neutral-500">No invites right now.</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} statusBadge="Invited" />
        ))}
      </div>
    </div>
  );
}
