import Link from "next/link";
import EventsList from "./EventsList";

type PgText = { String: string; Valid: boolean };

type Event = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  starts_at: string;
  access_tier: string;
  category?: string | null | PgText;
  discoverability?: string;
  cover_photo_url?: string | null | PgText;
  created_by?: unknown;
  group_id?: unknown;
  // Shape unconfirmed — could be a plain number/null, or pgtype's
  // {Int32, Valid} struct form. Handled defensively in EventsList.
  capacity_max: number | null | { Int32: number; Valid: boolean };
};

async function getEvents(): Promise<Event[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch events: ${res.status}`);
  }
  return res.json();
}

export default async function EventsPage() {
  const events = await getEvents();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Events</h1>
          <p className="text-neutral-500 text-sm mt-1">
            What&rsquo;s happening near you.
          </p>
        </div>
        <Link href="/events/new" className="btn-gradient text-sm px-4 py-2 shadow-sm">
          + New Event
        </Link>
      </div>

      <EventsList events={events} />
    </div>
  );
}
