// Pure helpers for the event detail page — formatting, pgtype-shape
// handling, and RSVP-list business rules. Pulled out of EventDetail.tsx so
// that file can stay focused on rendering; these have no React/JSX in them
// and can be unit tested or reused on their own.

import type { Event, RSVP } from "./page";

// pgtype.UUID's exact JSON shape wasn't confirmed when this was written —
// handles both a plain string and pgtype's {Bytes, Valid} struct form so
// ownership comparisons don't silently break either way.
export function normalizeUUID(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "Bytes" in value) {
    const bytes = (value as { Bytes: number[] }).Bytes;
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return null;
}

export function formatText(value: Event["description"]): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value || null;
  if (typeof value === "object") return value.Valid ? value.String : null;
  return null;
}

export function capacityNumber(capacity: Event["capacity_max"]): number | null {
  if (capacity === null || capacity === undefined) return null;
  if (typeof capacity === "number") return capacity;
  if (typeof capacity === "object") return capacity.Valid ? capacity.Int32 : null;
  return null;
}

export const STATUS_STYLES: Record<string, string> = {
  joined: "bg-green-50 text-green-700 border-green-200",
  maybe: "bg-purple-50 text-purple-700 border-purple-200",
  waitlisted: "bg-yellow-50 text-yellow-700 border-yellow-200",
  pending: "bg-blue-50 text-blue-700 border-blue-200",
  declined: "bg-neutral-50 text-neutral-500 border-neutral-200",
};

// Friendlier copy + accent bar color for the "you're already RSVP'd" card —
// keyed the same way as STATUS_STYLES.
export const STATUS_MESSAGES: Record<string, { label: string; bar: string }> = {
  joined: { label: "You’re going", bar: "bg-green-500" },
  maybe: { label: "You might go", bar: "bg-purple-500" },
  waitlisted: { label: "You’re on the waitlist", bar: "bg-yellow-500" },
  pending: { label: "Awaiting host approval", bar: "bg-blue-500" },
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  Sports: "linear-gradient(135deg,#f97316,#db2777)",
  Social: "linear-gradient(135deg,#db2777,#7c3aed)",
  Learning: "linear-gradient(135deg,#7c3aed,#4f46e5)",
  Outdoors: "linear-gradient(135deg,#16a34a,#0ea5e9)",
  Music: "linear-gradient(135deg,#f97316,#7c3aed)",
  Other: "linear-gradient(135deg,#64748b,#334155)",
};

export function coverGradient(category: string | null): string {
  return CATEGORY_GRADIENTS[category ?? ""] ?? "linear-gradient(135deg,#a855f7,#ec4899,#f97316)";
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Owner first, then co-hosts — hosts don't have their own RSVP row, so they
// render as a separate block above the RSVP list rather than inside it.
export function getOrderedHostIds(ownerId: string | null, hostIds: string[]): string[] {
  return ownerId ? [ownerId, ...hostIds.filter((id) => id !== ownerId)] : hostIds;
}

export type SplitRsvps = { pending: RSVP[]; others: RSVP[] };

// Splits the raw RSVP list into "pending" (awaiting approve/decline) and
// "others" (joined/maybe/waitlisted/declined), applying two visibility
// rules along the way:
//   - hosts are excluded entirely (they're shown separately, and someone
//     who joined before becoming a co-host shouldn't appear twice)
//   - declined RSVPs are only visible to the actual event creator, not
//     co-hosts
export function splitRsvps(rsvps: RSVP[], hostIds: string[], isOwner: boolean): SplitRsvps {
  const hostIdSet = new Set(hostIds);
  const pending = rsvps.filter((r) => r.status === "pending" && !hostIdSet.has(r.user_id));
  const others = rsvps.filter(
    (r) =>
      r.status !== "pending" &&
      (r.status !== "declined" || isOwner) &&
      !hostIdSet.has(r.user_id)
  );
  return { pending, others };
}
