// Pure helpers for the group detail page — formatting, pgtype-shape
// handling, and membership/invite business rules. Pulled out of
// GroupDetail.tsx so that file can stay focused on rendering.

import type { Group, GroupMember, User } from "./page";

export function formatDescription(desc: Group["description"]): string {
  if (typeof desc === "string") return desc;
  if (desc && typeof desc === "object") return desc.Valid ? desc.String : "";
  return "";
}

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

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function getMemberIds(members: GroupMember[]): Set<string> {
  return new Set(members.map((m) => m.user_id));
}

// Invited users who haven't joined yet — once they join they show up in
// `members` instead, so this is naturally just the still-pending ones.
export function getPendingInviteIds(invitedIds: string[], memberIds: Set<string>): string[] {
  return invitedIds.filter((id) => !memberIds.has(id));
}

// Friends who can actually still be invited to the group — excludes anyone
// who's already a member, since inviting an existing member doesn't mean
// anything.
export function getInvitableFriends(friends: User[], memberIds: Set<string>): User[] {
  return friends.filter((f) => !memberIds.has(f.id));
}
