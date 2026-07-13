import EditEventForm from "./EditEventForm";

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

async function getEvent(id: string): Promise<Event> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch event: ${res.status}`);
  return res.json();
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);

  return (
    <div className="max-w-md mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-8">Edit Event</h1>
      <EditEventForm event={event} />
    </div>
  );
}
