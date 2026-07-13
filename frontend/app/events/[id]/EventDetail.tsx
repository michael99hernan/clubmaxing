"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "../../CurrentUserContext";
import type { Event, RSVP } from "./page";
import {
  normalizeUUID,
  formatText,
  capacityNumber,
  coverGradient,
  initials,
  getOrderedHostIds,
  splitRsvps,
  STATUS_STYLES,
  STATUS_MESSAGES,
} from "./eventDetailLogic";

type User = {
  id: string;
  name: string;
  email: string;
};

export default function EventDetail({ event, rsvps }: { event: Event; rsvps: RSVP[] }) {
  const router = useRouter();
  const { currentUser, loading } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [hostIds, setHostIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [groupName, setGroupName] = useState<string | null>(null);

  const ownerId = normalizeUUID(event.created_by);
  const groupId = normalizeUUID(event.group_id);
  const isOwner = !loading && !!currentUser && currentUser.id === ownerId;
  const isCoHost = !!currentUser && hostIds.includes(currentUser.id);
  // "Manager" = owner or co-host — same powers everywhere: edit, delete,
  // approve/decline RSVPs, manage co-hosts, and (under host_only) invites.
  const isManager = isOwner || isCoHost;

  // Anyone who's actually RSVP'd (joined/maybe/waitlisted/pending) gets to
  // see who else is going, same as managers — only people with zero
  // relationship to the event don't.
  const myRSVPStatus = currentUser
    ? rsvps.find((r) => r.user_id === currentUser.id)?.status
    : undefined;
  const canSeeRSVPs = isManager || !!myRSVPStatus;

  // Group-hosted events only carry the group's id — fetch its name once
  // so the "Hosted by" link has something readable to show.
  useEffect(() => {
    if (!groupId) {
      setGroupName(null);
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups/${groupId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((g: { name: string } | null) => setGroupName(g?.name ?? null))
      .catch(() => setGroupName(null));
  }, [groupId]);

  // Fetch the user list (needed to show names in the RSVP list) once we
  // know we're allowed to see it — people with no relationship to the
  // event never see this data at all.
  useEffect(() => {
    if (!canSeeRSVPs) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`)
      .then((res) => res.json())
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [canSeeRSVPs]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${event.id}/hosts`)
      .then((res) => res.json())
      .then((hosts: { user_id: string }[]) => setHostIds(hosts.map((h) => h.user_id)))
      .catch(() => setHostIds([]));
  }, [event.id]);

  useEffect(() => {
    if (!currentUser) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/friends`, {
      headers: { "X-User-Id": currentUser.id },
    })
      .then((res) => res.json())
      .then(setFriends)
      .catch(() => setFriends([]));

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${event.id}/invites`)
      .then((res) => res.json())
      .then((invites: { user_id: string }[]) => setInvitedIds(invites.map((i) => i.user_id)))
      .catch(() => setInvitedIds([]));
  }, [currentUser, event.id]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  function duplicateEvent() {
    const params = new URLSearchParams();
    params.set("title", `${event.title} (copy)`);
    const description = formatText(event.description);
    if (description) params.set("description", description);
    params.set("latitude", String(event.latitude));
    params.set("longitude", String(event.longitude));
    params.set("access_tier", event.access_tier);
    const category = formatText(event.category);
    if (category) params.set("category", category);
    if (event.invite_policy) params.set("invite_policy", event.invite_policy);
    if (event.discoverability) params.set("discoverability", event.discoverability);
    const coverPhotoUrl = formatText(event.cover_photo_url);
    if (coverPhotoUrl) params.set("cover_photo_url", coverPhotoUrl);
    if (event.auto_accept) params.set("auto_accept", "true");
    const capacity = event.capacity_max;
    const capacityValue =
      typeof capacity === "number" ? capacity : capacity && capacity.Valid ? capacity.Int32 : null;
    if (capacityValue !== null) params.set("capacity_max", String(capacityValue));
    // Carry over which group hosted the original event, so duplicating a
    // group event doesn't silently reset it to a personal event.
    if (groupId) params.set("group_id", groupId);
    router.push(`/events/new?${params.toString()}`);
  }

  async function inviteFriend(friendId: string) {
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/events/${event.id}/invites`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": currentUser.id,
          },
          body: JSON.stringify({ user_id: friendId }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setInvitedIds((prev) => [...prev, friendId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function addCoHost(friendId: string) {
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${event.id}/hosts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.id,
        },
        body: JSON.stringify({ user_id: friendId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setHostIds((prev) => [...prev, friendId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id.slice(0, 8);

  const myRSVP = currentUser ? rsvps.find((r) => r.user_id === currentUser.id) : undefined;
  const canLeave = myRSVP && myRSVP.status !== "declined";

  // Private events can only be joined via an invite (or group membership,
  // checked server-side) — showing "Join" to someone who isn't invited
  // would just 403. Only show it once they're either invited or already
  // have some RSVP row (e.g. re-joining after declining).
  const isInvited = !!currentUser && invitedIds.includes(currentUser.id);
  const canJoin = event.access_tier !== "private" || isInvited || !!myRSVP;

  // Invite button visibility follows the host's invite_policy: managers can
  // always invite; under "attendees" policy, anyone actually joined can too.
  const canInvite =
    isManager || (event.invite_policy === "attendees" && myRSVP?.status === "joined");

  async function call(path: string, method: string = "POST", withUserHeader = true) {
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
        body: method === "POST" && (path.includes("/join") || path.includes("/leave") || path.includes("/rsvp"))
          ? JSON.stringify({ user_id: currentUser.id })
          : undefined,
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

  async function setMaybe() {
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${event.id}/maybe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.id,
        },
        body: JSON.stringify({ user_id: currentUser.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this event? This can't be undone.")) return;
    if (!currentUser) return;
    setBusy(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${event.id}`, {
        method: "DELETE",
        headers: { "X-User-Id": currentUser.id },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }
      router.push("/events");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  // Hosts (owner + co-hosts) show up at the top of the RSVPs list
  // separately, owner first with a crown. splitRsvps excludes them from
  // the regular list (and applies the declined-visibility rule) — see
  // eventDetailLogic.ts for the actual business rules.
  const hostIds_ordered = getOrderedHostIds(ownerId, hostIds);
  const { pending, others } = splitRsvps(rsvps, hostIds_ordered, isOwner);
  const joinedCount = rsvps.filter((r) => r.status === "joined").length;
  const capacity = capacityNumber(event.capacity_max);
  const category = formatText(event.category);
  const coverPhotoUrl = formatText(event.cover_photo_url);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
    <div>
      <div
        className="relative w-full h-56 rounded-2xl mb-6 border border-neutral-200/60 overflow-hidden shadow-sm"
        style={
          coverPhotoUrl
            ? { backgroundImage: `url(${coverPhotoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { backgroundImage: coverGradient(category) }
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
        <div className="absolute bottom-3 left-4 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white bg-black/35 backdrop-blur-sm rounded-full px-2.5 py-1">
            {event.access_tier}
          </span>
          {category && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-white bg-black/35 backdrop-blur-sm rounded-full px-2.5 py-1">
              {category}
            </span>
          )}
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
            <p className="text-neutral-500 text-sm mt-1">
              {new Date(event.starts_at).toLocaleString()}
            </p>
            {groupId && groupName && (
              <Link
                href={`/groups/${groupId}`}
                className="inline-block text-sm text-neutral-500 hover:text-neutral-900 underline underline-offset-2 mt-1"
              >
                Hosted by {groupName}
              </Link>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={copyLink}
              className="text-sm border border-neutral-300 bg-white/70 px-3 py-1.5 rounded-full hover:bg-white transition-colors"
            >
              {linkCopied ? "Copied!" : "Copy Link"}
            </button>
            {currentUser && (
              <button
                onClick={duplicateEvent}
                className="text-sm border border-neutral-300 bg-white/70 px-3 py-1.5 rounded-full hover:bg-white transition-colors"
              >
                Duplicate
              </button>
            )}
            {isManager && (
              <>
                <button
                  onClick={() => router.push(`/events/${event.id}/edit`)}
                  className="text-sm border border-neutral-300 bg-white/70 px-3 py-1.5 rounded-full hover:bg-white transition-colors"
                >
                  Edit
                </button>
                <button
                  disabled={busy}
                  onClick={handleDelete}
                  className="text-sm border border-red-200 text-red-600 px-3 py-1.5 rounded-full hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {formatText(event.description) && (
          <p className="text-sm text-neutral-700 mt-3 whitespace-pre-wrap">
            {formatText(event.description)}
          </p>
        )}
      </div>

      {!loading && !currentUser && (
        <p className="text-sm text-neutral-500 mb-6">
          <a href="/login" className="underline">
            Log in
          </a>{" "}
          to join this event.
        </p>
      )}

      {/* Managers (owner or co-host) are implicitly attending their own
          event — they never see Join/Leave here. They show up at the top
          of the RSVPs card in the right column instead (with a crown for
          the owner), rather than a separate "you're hosting" message. */}
      {currentUser && isManager && error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-6">
          {error}
        </p>
      )}

      {currentUser && !isManager && !myRSVP && (
        <div className="border border-neutral-200 rounded-2xl p-4 bg-white shadow-sm mb-6">
          <div className="flex gap-2 flex-wrap">
            {canJoin && (
              <button
                disabled={busy}
                onClick={() => call(`/events/${event.id}/join`)}
                className="btn-gradient text-sm px-4 py-1.5 disabled:opacity-50"
              >
                Join
              </button>
            )}
            {canJoin && (
              <button
                disabled={busy}
                onClick={setMaybe}
                className="border border-neutral-300 text-sm px-4 py-1.5 rounded-full hover:bg-neutral-50 disabled:opacity-50 transition-colors"
              >
                Maybe
              </button>
            )}
            {!canJoin && (
              <p className="text-sm text-neutral-500">
                This is a private event — you need an invite to join.
              </p>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-3">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Already RSVP'd: a single clean status banner (colored accent bar +
          friendly label) with Leave as an inline text action, instead of a
          separate uppercase status pill plus a boxed Leave button. */}
      {currentUser && !isManager && myRSVP && (
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white shadow-sm mb-6 overflow-hidden">
          <span className={`self-stretch w-1.5 shrink-0 ${STATUS_MESSAGES[myRSVP.status]?.bar ?? "bg-neutral-300"}`} />
          <div className="flex items-center justify-between flex-1 py-3 pr-4">
            <p className="text-sm font-medium text-neutral-800">
              {STATUS_MESSAGES[myRSVP.status]?.label ?? myRSVP.status}
            </p>
            {canLeave && (
              <button
                disabled={busy}
                onClick={() => call(`/events/${event.id}/leave`)}
                className="text-sm text-neutral-500 hover:text-red-600 underline underline-offset-2 disabled:opacity-50 transition-colors"
              >
                Leave
              </button>
            )}
          </div>
        </div>
      )}
      {currentUser && !isManager && myRSVP && error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 -mt-4 mb-6">
          {error}
        </p>
      )}

      {currentUser && friends.length > 0 && (canInvite || isManager) && (
        <div className="mb-6">
          <div className="relative inline-block">
            <button
              onClick={() => setInviteOpen((open) => !open)}
              aria-label="Invite people"
              title="Invite people"
              className="w-8 h-8 flex items-center justify-center rounded-full border border-neutral-300 bg-white/70 hover:bg-white text-lg leading-none transition-colors"
            >
              +
            </button>

            {inviteOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setInviteOpen(false)} />
                <div className="absolute left-0 top-full mt-2 w-72 border border-neutral-200 rounded-2xl bg-white shadow-lg z-20 p-2">
                  <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                    Friends
                  </p>
                  <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                    {friends.map((f) => {
                      const alreadyInvited = invitedIds.includes(f.id);
                      const alreadyHost = hostIds.includes(f.id) || f.id === ownerId;
                      return (
                        <div
                          key={f.id}
                          className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-neutral-50"
                        >
                          <span className="truncate">{f.name}</span>
                          <div className="flex gap-1.5 shrink-0">
                            {canInvite && (
                              <button
                                disabled={busy || alreadyInvited}
                                onClick={() => inviteFriend(f.id)}
                                className="text-xs border border-neutral-300 px-2 py-1 rounded hover:bg-neutral-100 disabled:opacity-50"
                              >
                                {alreadyInvited ? "Invited" : "Invite"}
                              </button>
                            )}
                            {isManager && (
                              <button
                                disabled={busy || alreadyHost}
                                onClick={() => addCoHost(f.id)}
                                className="text-xs border border-neutral-300 px-2 py-1 rounded hover:bg-neutral-100 disabled:opacity-50"
                              >
                                {alreadyHost ? "Co-host" : "Co-host?"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>

    {/* Right column: pending requests (managers only) + RSVPs (anyone
        who's actually RSVP'd, plus managers), styled to match the group
        page's member/pending-request cards. */}
    {canSeeRSVPs && (
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        {isManager && pending.length > 0 && (
          <div className="border border-blue-200 bg-white rounded-2xl shadow-sm p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-3">
              Pending requests ({pending.length})
            </h2>
            <div className="flex flex-col gap-1.5">
              {pending.map((r) => (
                <div
                  key={r.user_id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-blue-50/60 border border-blue-100"
                >
                  <span className="gradient-ring inline-flex shrink-0">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white text-[10px] font-semibold text-neutral-800">
                      {initials(userName(r.user_id))}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{userName(r.user_id)}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      disabled={busy}
                      onClick={() =>
                        call(`/events/${event.id}/rsvps/${r.user_id}/approve`, "POST")
                      }
                      className="text-[10px] bg-green-600 text-white px-2 py-1 rounded-full hover:bg-green-500 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        call(`/events/${event.id}/rsvps/${r.user_id}/decline`, "POST")
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

        <div className="border border-neutral-200 rounded-2xl bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              RSVPs ({hostIds_ordered.length + others.length})
            </h2>
            <span className="text-[10px] font-medium text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5">
              {capacity !== null ? `${joinedCount}/${capacity} spots` : `${joinedCount} joined`}
            </span>
          </div>
          {hostIds_ordered.length === 0 && others.length === 0 && (
            <p className="text-sm text-neutral-500">No RSVPs yet.</p>
          )}
          <div className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto">
            {hostIds_ordered.map((id) => (
              <div
                key={id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-amber-50/60 hover:bg-amber-50"
              >
                <span className="gradient-ring inline-flex shrink-0">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white text-[10px] font-semibold text-neutral-800">
                    {initials(userName(id))}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate flex items-center gap-1">
                    {id === ownerId && (
                      <span title="Owner" aria-label="Owner">
                        👑
                      </span>
                    )}
                    <span className="truncate">{userName(id)}</span>
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-amber-700 shrink-0">
                  {id === ownerId ? "Owner" : "Co-host"}
                </span>
              </div>
            ))}
            {others.map((r) => (
              <div
                key={r.user_id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-neutral-50"
              >
                <span className="gradient-ring inline-flex shrink-0">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white text-[10px] font-semibold text-neutral-800">
                    {initials(userName(r.user_id))}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{userName(r.user_id)}</p>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wide rounded-full border px-2 py-0.5 shrink-0 ${STATUS_STYLES[r.status] ?? ""}`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    </div>
    </div>
  );
}
