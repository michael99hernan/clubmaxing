import EventDetail from "./EventDetail";

type PgText = { String: string; Valid: boolean };

export type Event = {
  id: string;
  title: string;
  description?: string | null | PgText;
  latitude: number;
  longitude: number;
  starts_at: string;
  access_tier: string;
  auto_accept: boolean;
  capacity_max: number | null | { Int32: number; Valid: boolean };
  category?: string | null | PgText;
  invite_policy?: string;
  discoverability?: string;
  cover_photo_url?: string | null | PgText;
  group_id?: unknown;
  // Shape unconfirmed — pgtype.UUID may serialize as a plain string or as
  // {Bytes, Valid}. normalizeUUID in EventDetail.tsx handles both.
  created_by: unknown;
};

export type RSVP = {
  event_id: string;
  user_id: string;
  status: string;
  requested_at: string;
};

async function getEvent(id: string): Promise<Event> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch event: ${res.status}`);
  return res.json();
}

async function getRSVPs(id: string): Promise<RSVP[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${id}/rsvps`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch RSVPs: ${res.status}`);
  return res.json();
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [event, rsvps] = await Promise.all([getEvent(id), getRSVPs(id)]);

  return <EventDetail event={event} rsvps={rsvps} />;
}
