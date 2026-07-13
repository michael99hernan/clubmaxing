import Link from "next/link";

export type PgText = { String: string; Valid: boolean };

export type CardEvent = {
  id: string;
  title: string;
  starts_at: string;
  access_tier: string;
  category?: string | null | PgText;
  cover_photo_url?: string | null | PgText;
  capacity_max: number | null | { Int32: number; Valid: boolean };
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  Sports: "linear-gradient(135deg,#f97316,#db2777)",
  Social: "linear-gradient(135deg,#db2777,#7c3aed)",
  Learning: "linear-gradient(135deg,#7c3aed,#4f46e5)",
  Outdoors: "linear-gradient(135deg,#16a34a,#0ea5e9)",
  Music: "linear-gradient(135deg,#f97316,#7c3aed)",
  Other: "linear-gradient(135deg,#64748b,#334155)",
};

function coverGradient(category: string | null): string {
  return CATEGORY_GRADIENTS[category ?? ""] ?? "linear-gradient(135deg,#a855f7,#ec4899,#f97316)";
}

export function formatCapacity(capacity: CardEvent["capacity_max"]): string {
  if (capacity === null || capacity === undefined) return "Unlimited";
  if (typeof capacity === "number") return `${capacity} spots`;
  if (typeof capacity === "object") {
    return capacity.Valid ? `${capacity.Int32} spots` : "Unlimited";
  }
  return "Unlimited";
}

export function formatText(value: string | null | undefined | PgText): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value || null;
  if (typeof value === "object") return value.Valid ? value.String : null;
  return null;
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  joined: "bg-green-600",
  maybe: "bg-purple-600",
  waitlisted: "bg-yellow-600",
  pending: "bg-blue-600",
  declined: "bg-neutral-500",
  invited: "bg-fuchsia-600",
  hosting: "bg-orange-500",
};

export default function EventCard({
  event,
  statusBadge,
}: {
  event: CardEvent;
  statusBadge?: string;
}) {
  const eventCategory = formatText(event.category);
  const coverPhotoUrl = formatText(event.cover_photo_url);

  return (
    <Link
      href={`/events/${event.id}`}
      className="card-hover group block rounded-2xl bg-white border border-neutral-200/80 shadow-sm overflow-hidden"
    >
      <div
        className="relative h-36 w-full"
        style={
          coverPhotoUrl
            ? { backgroundImage: `url(${coverPhotoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { backgroundImage: coverGradient(eventCategory) }
        }
      >
        <span className="absolute top-2.5 right-2.5 text-[10px] font-medium uppercase tracking-wide text-white bg-black/35 backdrop-blur-sm rounded-full px-2.5 py-1">
          {event.access_tier}
        </span>
        {eventCategory && (
          <span className="absolute bottom-2.5 left-2.5 text-[10px] font-medium uppercase tracking-wide text-white bg-black/35 backdrop-blur-sm rounded-full px-2.5 py-1">
            {eventCategory}
          </span>
        )}
        {statusBadge && (
          <span
            className={`absolute top-2.5 left-2.5 text-[10px] font-medium uppercase tracking-wide text-white rounded-full px-2.5 py-1 ${
              STATUS_BADGE_STYLES[statusBadge.toLowerCase()] ?? "bg-neutral-700"
            }`}
          >
            {statusBadge}
          </span>
        )}
      </div>
      <div className="p-4">
        <h2 className="font-medium leading-snug group-hover:text-neutral-950">{event.title}</h2>
        <p className="text-sm text-neutral-500 mt-1.5">
          {new Date(event.starts_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
        <p className="text-xs text-neutral-400 mt-1">{formatCapacity(event.capacity_max)}</p>
      </div>
    </Link>
  );
}
