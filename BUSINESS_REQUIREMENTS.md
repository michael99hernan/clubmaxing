# ClubMaxing — Business Requirements & Feature List

Consolidated from the current codebase (schema, handlers, frontend), `BACKLOG.md`, and
issues found during use. This is the master list to work from before building anything
new — nothing below should be started without confirming priority and exact behavior
first.

Status tags: **Done** (works today), **Partial** (exists but incomplete/inconsistent),
**Missing** (not built), **Bug** (built but behaves wrong).

---

## 1. Identity & Access

| # | Requirement | Status |
|---|---|---|
| 1.1 | Users can be created with an email + name | Done |
| 1.2 | Users can log in by picking themselves from a list | Done (no real auth) |
| 1.3 | Requests are attributed via an `X-User-Id` header | Bug/Partial — spoofable, anyone can claim any user ID |
| 1.4 | Real authentication (passwords, sessions/tokens) | Missing |
| 1.5 | Authorization is enforced server-side for every mutating action, not just hidden in the UI | Partial — enforced for event edit/delete, **not** enforced for group edit/delete, RSVP approve/decline, or any invite action |
| 1.6 | Identity verification / reputation / check-in safety for meeting strangers in person | Missing — explicitly deferred, revisit before any real-world "meet a stranger" use case ships |
| 1.7 | Rate limiting / abuse prevention | Missing |

## 2. Groups

| # | Requirement | Status |
|---|---|---|
| 2.1 | Create a group (name, description, owner) | Done |
| 2.2 | Anyone can join any group, no approval | Done — **is this correct?** Groups currently have no privacy concept at all (no `open`/`request`/`private` tier the way events do) |
| 2.3 | Anyone can leave a group | Done |
| 2.4 | Group roles: owner (auto at creation) vs. member | Partial — schema/CHECK constraint also allows `admin`, but no UI or logic ever sets or uses it |
| 2.5 | View group members, and events hosted by a group | Done |
| 2.6 | Delete a group | Partial — **no ownership check at all** (`deleteGroupHandler` doesn't verify caller is the owner; also doesn't verify caller is even logged in) |
| 2.7 | Invite someone to a group | **Missing entirely** — no `group_invites` table, no endpoint, no UI. Every group is join-by-anyone today. |
| 2.8 | **Bug reported:** a user was able to invite a friend to an event hosted by a group they themselves could not join / were not a member of | **Bug** — see §6 "Permission model gaps" below for the actual mechanism and the decision this needs |

**Open question for 2.2/2.7:** should groups support a private tier (invite-only, like private events), or should "anyone can join any group" remain by design? This decision blocks 2.7 and the bug fix in 2.8.

## 3. Events

| # | Requirement | Status |
|---|---|---|
| 3.1 | Create an event: title, description, location (lat/lng + optional location name), start/end time, capacity, access tier, optional host group | Done |
| 3.2 | Three access tiers: `open` (join instantly), `request` (host approves), `private` (invite-only) | Done |
| 3.3 | Edit / delete an event | Done, owner-only (server-enforced via `X-User-Id` match) |
| 3.4 | Host auto-attends their own event (no manual "Join" needed) | Done (just added) |
| 3.5 | Owner sees a distinct view (host banner, pending requests, full RSVP list with names); non-owners see a simpler join/status view | Done (just added) |
| 3.6 | Non-invited users can't see a Join button on a private event | Done (just added) |
| 3.7 | Capacity limits with automatic waitlisting, and promotion off the waitlist when someone leaves | Done |
| 3.8 | "Maybe" RSVP status | Bug/Partial — backend supports it (`event_rsvps.status` allows `maybe`), no button anywhere in the UI |
| 3.9 | Auto-accept toggle for `request`-tier events | Bug/Partial — `auto_accept` column and backend check exist, no form lets a host turn it on; every request-tier event requires manual approval today regardless of intent |
| 3.10 | Category field for filtering | Bug/Partial — `category` column exists, nothing sets or reads it |
| 3.11 | Map / location picker instead of typed lat/lng | Missing |
| 3.12 | Delete confirmation uses a real modal instead of the browser's native `confirm()` | Missing (cosmetic) |
| 3.13 | Waitlist promotion notifies the promoted user | Missing — they only find out by revisiting the event page |

## 4. RSVPs & Attendance

| # | Requirement | Status |
|---|---|---|
| 4.1 | Join / Leave an event | Done |
| 4.2 | Host approve/decline pending join requests | Partial — works, but **no server-side check that the caller is actually the host** (`approveRSVPHandler`/`declineRSVPHandler` don't call `isOwner`) — currently anyone can approve/decline anyone's request on any event |
| 4.3 | See who's attending (owner-only) | Done |
| 4.4 | See your own RSVP status | Done |

## 5. Friends

| # | Requirement | Status |
|---|---|---|
| 5.1 | Send a friend request | Done |
| 5.2 | Accept / decline a friend request | Done |
| 5.3 | Remove a friend | Done |
| 5.4 | List friends / pending requests | Done |
| 5.5 | Block a user | Missing |

## 6. Invites (event + group) — Permission model gaps

This is the section directly relevant to the reported bug.

| # | Requirement | Status |
|---|---|---|
| 6.1 | Invite a friend to an event | Done, but **unrestricted**: `createInviteHandler` explicitly allows "anyone logged in [to] invite anyone to an event," documented in code as "a deliberate simplification for now, not an oversight" |
| 6.2 | Inviter should only be able to invite people to things they themselves have access to | **Missing / Bug** — nothing today checks that the inviter is the host, an attendee, or even a member of the group hosting the event. This is exactly how a user can invite someone to a group-hosted event without being in that group at all — there's no group-membership check anywhere in the invite path, and no group-invite concept to compare it against. |
| 6.3 | Invited user has a way to see "events I've been invited to" | Missing — invites only work if the invited person already has the direct link. Needs a list, e.g. on `/events` or a new `/invites` page. |
| 6.4 | Confirmation feedback after sending an invite | Missing/Partial — button just disables to "Invited," no toast/confirmation message |
| 6.5 | Group invites (invite someone to join a group, as distinct from inviting them to one event) | Missing entirely — see §2.7 |

**Decision needed before implementing a fix:** should invite permissions be:
- **(a)** Host-only (only the event's creator can invite people), or
- **(b)** Attendee-gated (only people who are already `joined`/invited to the event, or members of its host group, can invite others), or
- **(c)** Something tier-dependent (e.g. open events: anyone can invite; private events: only host or existing attendees can invite)?

This also determines whether "invite to a group" needs its own permission rule (e.g. only group members can invite new members) once group invites are built.

## 7. Discovery & Browsing

| # | Requirement | Status |
|---|---|---|
| 7.1 | Flat list of all events (`/events`) | Done |
| 7.2 | "What's happening near me" discovery feed — map view, filter by category/distance/time | Missing — core piece of the original product vision, not started |
| 7.3 | Pagination on list endpoints (`/events`, `/users`, `/groups`) | Missing — fine at current scale, will break down with real data volume |

## 8. Chat & Notifications

| # | Requirement | Status |
|---|---|---|
| 8.1 | Event-level and group-level chat | Missing — Phase 2 of the technical roadmap (introduces WebSockets/real-time) |
| 8.2 | Event-driven notifications (RSVP updates, event starting soon, friend request received, waitlist promotion) | Missing — Phase 3 of the technical roadmap (introduces an event bus — Kafka/Redis Streams) |

## 9. Infrastructure / Non-Functional

| # | Requirement | Status |
|---|---|---|
| 9.1 | Environment-based config (currently hardcoded `localhost` URLs, CORS origin, Postgres connection string) | Missing — fine for local dev, needed before any real deployment |
| 9.2 | Automated tests (unit or integration), backend or frontend | Missing entirely |
| 9.3 | Splitting the monolith into services, containerization/orchestration, geospatial sharding | Deliberately deferred (Phase 4/5) — not needed until there's a real scale reason |
| 9.4 | Confirm `pgtype.UUID` / `pgtype.Int4` / `pgtype.Text` JSON shapes and simplify the defensive frontend handling (`normalizeUUID`, `formatCapacity`, `formatDescription`) once confirmed | Missing — currently handling multiple possible shapes defensively instead of one confirmed shape |

---

## Suggested priority for next work (not yet confirmed with you)

1. **P0 — Security/consistency bugs:** 4.2 (approve/decline has no owner check), 2.6 (group delete has no owner check), 6.2 (invite permission model — the bug you just found).
2. **P1 — Feature completeness:** 6.3 (pending invites view), 3.8 (Maybe RSVP), 3.9 (auto-accept toggle), 2.7 (group invites, pending the privacy-tier decision).
3. **P2 — Polish:** 6.4 (invite confirmation), 3.12 (real delete modal), 3.11 (map picker).
4. **P3 — Bigger bets:** 7.2 (discovery feed), 8.1 (chat), 8.2 (notifications), 1.4 (real auth) — each is a significant scope increase and probably deserves its own planning pass.

Nothing in this list should be started without picking a specific item and confirming the exact intended behavior first — especially §6, since the permission model decision there affects several other rows.
