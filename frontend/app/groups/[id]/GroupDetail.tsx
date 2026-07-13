"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../CurrentUserContext";
import EventCard from "../../events/EventCard";
import type { Group, GroupMember, Event, User } from "./page";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDescription(desc: Group["description"]): string {
  if (typeof desc === "string") return desc;
  if (desc && typeof desc === "object") return desc.Valid ? desc.String : "";
  return "";
}

function normalizeUUID(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "Bytes" in value) {
    const bytes = (value as { Bytes: number[] }).Bytes;
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return null;
}

export default function GroupDetail({
  group,
  members,
  events,
  users,
}: {
  group: Group;
  members: GroupMember[];
  events: Event[];
  users: User[];
}) {
  const router = useRouter();
  const { currentUser, loading } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id.slice(0, 8);
  const myMembership = currentUser ? members.find((m) => m.user_id === currentUser.id) : undefined;
  const isActiveMember = myMembership?.status === "active";
  const isPendingMember = myMembership?.status === "pending";
  const isManager =
    isActiveMember && (myMembership?.role === "owner" || myMembership?.role === "admin");

  const activeMembers = members.filter((m) => m.status === "active");
  const pendingMembers = members.filter((m) => m.status === "pending");
  const memberIds = new Set(members.map((m) => m.user_id));
  // Invited users who haven't joined yet — once they join they show up in
  // `members` instead, so this is naturally just the still-pending ones.
  const pendingInviteIds = invitedIds.filter((id) => !memberIds.has(id));

  useEffect(() => {
    if (!currentUser) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/friends`, {
      headers: { "X-User-Id": currentUser.id },
    })
      .then((res) => res.json())
      .then(setFriends)
      .catch(() => setFriends([]));

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups/${group.id}/invites`)
      .then((res) => res.json())
      .then((invites: { user_id: string }[]) => setInvitedIds(invites.map((i) => i.user_id)))
      .catch(() => setInvitedIds([]));
  }, [currentUser, group.id]);

  async function call(path: string, method: string = "POST", body?: unknown, withUserHeader = false) {
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(withUserHeader ? { "X-User-Id": currentUser.id } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function inviteFriend(friendId: string) {
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups/${group.id}/invites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.id,
        },
        body: JSON.stringify({ user_id: friendId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setInvitedIds((prev) => [...prev, friendId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const ownerId = normalizeUUID(group.created_by);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
        {/* Main column */}
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-3xl font-semibold tracking-tight">{group.name}</h1>
            <span className="text-xs uppercase tracking-wide text-neutral-500 border border-neutral-200 rounded-full px-2.5 py-0.5">
              {group.access_tier}
            </span>
          </div>
          {formatDescription(group.description) && (
            <p className="text-neutral-600 text-sm mb-5">{formatDescription(group.description)}</p>
          )}

          {!loading && currentUser && (
            <div className="mb-8">
              <div className="flex gap-2 flex-wrap">
                {isActiveMember && myMembership?.role !== "owner" && (
                  <button
                    disabled={busy}
                    onClick={() => call(`/groups/${group.id}/leave`, "POST", { user_id: currentUser.id })}
                    className="text-sm border border-neutral-300 bg-white/70 px-3.5 py-1.5 rounded-full hover:bg-white transition-colors disabled:opacity-50"
                  >
                    Leave Group
                  </button>
                )}
                {isPendingMember && (
                  <p className="text-sm text-neutral-500">
                    Your request to join is pending approval.
                  </p>
                )}
                {!myMembership && group.access_tier !== "private" && (
                  <button
                    disabled={busy}
                    onClick={() => call(`/groups/${group.id}/join`, "POST", { user_id: currentUser.id })}
                    className="btn-gradient text-sm px-4 py-1.5 disabled:opacity-50"
                  >
                    {group.access_tier === "request" ? "Request to Join" : "Join Group"}
                  </button>
                )}
                {!myMembership && group.access_tier === "private" && !invitedIds.includes(currentUser.id) && (
                  <p className="text-sm text-neutral-500">
                    This group is private — you need an invite to join.
                  </p>
                )}
                {!myMembership && group.access_tier === "private" && invitedIds.includes(currentUser.id) && (
                  <button
                    disabled={busy}
                    onClick={() => call(`/groups/${group.id}/join`, "POST", { user_id: currentUser.id })}
                    className="btn-gradient text-sm px-4 py-1.5 disabled:opacity-50"
                  >
                    Accept Invite &amp; Join
                  </button>
                )}

                {isActiveMember && friends.filter((f) => !memberIds.has(f.id)).length > 0 && (
                  <div className="relative inline-block">
                    <button
                      onClick={() => setInviteOpen((open) => !open)}
                      className="text-sm border border-neutral-300 px-3.5 py-1.5 rounded-full hover:bg-white bg-white/70 transition-colors"
                    >
                      Invite friends
                    </button>
                    {inviteOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setInviteOpen(false)} />
                        <div className="absolute left-0 top-full mt-2 w-64 border border-neutral-200 rounded-lg bg-white shadow-lg z-20 p-2">
                          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                            {friends
                              .filter((f) => !memberIds.has(f.id))
                              .map((f) => {
                              const alreadyInvited = invitedIds.includes(f.id);
                              return (
                                <div
                                  key={f.id}
                                  className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-neutral-50"
                                >
                                  <span>{f.name}</span>
                                  <button
                                    disabled={busy || alreadyInvited}
                                    onClick={() => inviteFriend(f.id)}
                                    className="text-xs border border-neutral-300 px-2 py-1 rounded hover:bg-neutral-100 disabled:opacity-50"
                                  >
                                    {alreadyInvited ? "Invited" : "Invite"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-3">
                  {error}
                </p>
              )}
            </div>
          )}


          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">
              Events
            </h2>
            {events.length === 0 && <p className="text-sm text-neutral-500">No events yet.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </div>
        </div>

        {/* Right column: pending requests, pending invites, members —
            all styled as matching compact list cards. */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          {isManager && pendingMembers.length > 0 && (
            <div className="border border-blue-200 bg-white rounded-2xl shadow-sm p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-3">
                Pending requests ({pendingMembers.length})
              </h2>
              <div className="flex flex-col gap-1.5">
                {pendingMembers.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-blue-50/60 border border-blue-100"
                  >
                    <span className="gradient-ring inline-flex shrink-0">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white text-[10px] font-semibold text-neutral-800">
                        {initials(userName(m.user_id))}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{userName(m.user_id)}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        disabled={busy}
                        onClick={() =>
                          call(`/groups/${group.id}/members/${m.user_id}/approve`, "POST", undefined, true)
                        }
                        className="text-[10px] bg-green-600 text-white px-2 py-1 rounded-full hover:bg-green-500 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          call(`/groups/${group.id}/members/${m.user_id}/decline`, "POST", undefined, true)
                        }
                        className="text-[10px] bg-neutral-200 text-neutral-700 px-2 py-1 rounded-full hover:bg-neutral-300 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isManager && pendingInviteIds.length > 0 && (
            <div className="border border-fuchsia-200 bg-fuchsia-50/60 rounded-2xl shadow-sm p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-fuchsia-700 mb-3">
                Pending invites ({pendingInviteIds.length})
              </h2>
              <div className="flex flex-col gap-1.5">
                {pendingInviteIds.map((id) => (
                  <div
                    key={id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-white border border-fuchsia-100"
                  >
                    <span className="gradient-ring inline-flex shrink-0">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white text-[10px] font-semibold text-neutral-800">
                        {initials(userName(id))}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{userName(id)}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-fuchsia-600 shrink-0">
                      Invited
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border border-neutral-200 rounded-2xl bg-white shadow-sm p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">
              Members ({activeMembers.length})
            </h2>
            <div className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto">
              {activeMembers.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-neutral-50"
              >
                <span className="gradient-ring inline-flex shrink-0">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white text-[10px] font-semibold text-neutral-800">
                    {initials(userName(m.user_id))}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate flex items-center gap-1">
                    {m.user_id === ownerId && (
                      <span title="Owner" aria-label="Owner">
                        👑
                      </span>
                    )}
                    <span className="truncate">{userName(m.user_id)}</span>
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-neutral-400 shrink-0">
                  {m.role}
                </span>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
