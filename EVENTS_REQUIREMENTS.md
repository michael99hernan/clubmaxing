# Events — Requirements (from Q&A pass)

Decisions locked in from the 25-question pass on 2026-07-11. This supersedes the
relevant open questions in `BUSINESS_REQUIREMENTS.md` §2, §3, §4, §6, §8. Nothing
here is built yet — this is the spec to implement against.

---

## 1. Groups get privacy tiers

- Groups adopt the same `open` / `request` / `private` model events already have
  (schema: add `access_tier` to `groups`, mirroring `events.access_tier`).
- **Group membership grants automatic access to that group's private events** —
  no separate per-event invite needed once you're a member. A private event
  hosted by a group you belong to should just work for you.

## 2. Group invites — build now

- New `group_invites` table (mirrors `event_invites`: `group_id`, `user_id`,
  `invited_by`, `created_at`).
- For `private`/`request` tier groups, an invite is the way in, same pattern as
  private events.
- Needs its own endpoint(s): `POST /groups/{id}/invites`, `GET /groups/{id}/invites`.

## 3. Event invite permissions — host setting

- Invite permission is **configurable per event by the host**, not a single
  global rule. Add a field (e.g. `events.invite_policy`) with at least:
  - `host_only` — only the creator/co-hosts can invite
  - `attendees` — anyone joined can invite others
  - (keep `open` — anyone logged in — as a legacy/default option if useful)
- Host picks this at creation, editable later like other event settings.
- This directly fixes the reported bug: today anyone can invite anyone to
  anything, with no gate at all.

## 4. Co-hosts

- Add a co-host role to events (not just single `created_by` owner).
- Co-hosts get the same powers as the primary host: edit, delete, approve/decline
  RSVPs, manage invites, per invite-policy rules above.
- Needs a join table, e.g. `event_hosts (event_id, user_id, added_by, created_at)`,
  separate from `event_rsvps` (a co-host isn't necessarily "attending" via RSVP
  status, though in practice they will be).

## 5. RSVP approve/decline permissions

- Lock down server-side: only the host **or co-hosts** can approve/decline a
  pending RSVP. Today `approveRSVPHandler`/`declineRSVPHandler` have no check
  at all — this is a real bug to close, not just a nice-to-have.

## 6. Group-hosted events require membership

- A user can only attach a group to an event they're creating if they are a
  **member** of that group (owner/admin/member all count — not restricted to
  admin-only). Enforce server-side in `createEventHandler`/`updateEventHandler`.

## 7. Maybe RSVP

- Add a "Maybe" button next to Join/Leave on the event page for all tiers
  (backend `event_rsvps.status` already supports `maybe`, just needs the UI
  and the corresponding call).

## 8. Auto-accept toggle

- Add to both `NewEventForm` and `EditEventForm`: a checkbox for
  `auto_accept`, shown when access tier is `request`. Wire into the existing
  `create`/`update` request bodies (backend already reads this column).

## 9. Categories

- Event category becomes both a filter and a visible badge:
  - Add a category select to create/edit forms.
  - Show the category as a small tag on the event card and event detail page
    (similar styling to the existing access-tier badge).
  - Add category filtering to the `/events` list.
- Needs an agreed category list (e.g. Sports, Social, Learning, Outdoors,
  Music, Other) — confirm exact set before building.

## 10. Waitlist

- Keep waitlist status as-is (no queue position shown — just "waitlisted").
- Add promotion notification eventually, both in-app and email — not blocking,
  can be sequenced after the notification system exists (Phase 3 per
  `BACKLOG.md`). Track as a follow-up, not part of this batch.

## 11. Editing after RSVPs exist

- No restrictions — a host can edit any field (including lowering capacity
  below current attendance) at any time. No warning needed.

## 12. Cancelling an event

- Deleting an event with active attendees must **notify everyone who was
  joined/waitlisted/pending/invited** that it was cancelled. This depends on
  a notification mechanism existing — at minimum, needs an in-app "your event
  was cancelled" surface (e.g. a banner or list somewhere) since full
  notifications (Phase 3) aren't built yet. Scope the simplest version that
  satisfies this without waiting on the full notification system.

## 13. Location

- Map picker for lat/lng: nice-to-have, not urgent — keep manual entry for now,
  revisit later.
- Location should eventually support real "near me" distance search, not just
  cosmetic display — sequence after/alongside the discovery feed work.

## 14. Duplicate event (instead of full recurrence)

- No recurring-event engine. Instead, add a **"Duplicate event"** action
  (nice-to-have, not blocking): clones an existing event's fields (title,
  description, location, capacity, access tier, category, group) into a new
  create-event form pre-filled, with a fresh date/time to set. Simpler than
  true recurrence and covers the "weekly meetup" use case well enough.

## 15. Discoverability — needs an option

- Open-tier events should have a **host-configurable discoverability setting**,
  not a single hardcoded rule. At minimum:
  - Public (visible in the flat `/events` list / future discovery feed to
    anyone)
  - Friends/group-only (only visible to the host's friends or fellow group
    members)
- Confirm exact field name/values before building — likely lives alongside
  `access_tier` but is a distinct concept (access tier = can you join; this =
  can you even see it in a list).

## 16. RSVP re-request after decline

- Final — if a host declines someone, that user cannot re-request. Only the
  host can bring them back in (re-invite).

## 17. Cover photo

- Events get a single cover photo (not a full gallery). Needs image upload/
  storage — currently nothing in this app handles file uploads, so this
  requires picking a storage approach (local disk vs. S3-compatible bucket)
  before implementation.

## 18. Event chat (future, when built)

- Scoped to **joined attendees only** — pending, waitlisted, declined, and
  merely-invited users don't see it. Not being built now; just locking the
  access model for when it is (Phase 2 per `BACKLOG.md`).

## 19. Reminders

- Host-configurable (not a fixed 24h/1h schedule) — host picks when reminders
  fire. Depends on the notification system (email or in-app); sequence after
  that exists.

## 20. Reporting/moderation

- Not needed yet. Explicitly deferred, consistent with the trust & safety
  deferrals already logged in `BACKLOG.md`.

## 21. Host analytics

- Not needed now, maybe later. No action for this batch.

## 22. Default capacity

- Stays unlimited by default — no change to current behavior.

---

## Suggested build order

1. **Bug fixes / security (no new schema beyond what's listed):** RSVP
   approve/decline ownership check (§5).
2. **Foundational schema changes** (do these together since several features
   depend on them): group `access_tier` + `group_invites` (§1, §2), event
   `invite_policy` (§3), `event_hosts` co-host table (§4), group-membership
   check on event creation (§6).
3. **Frontend feature completion on existing columns:** Maybe RSVP (§7),
   auto-accept toggle (§8), category filter + badge (§9 — pending category
   list confirmation).
4. **New but scoped features:** discoverability setting (§15), duplicate
   event (§14), cover photo (§17 — pending storage decision).
5. **Depends on notification system existing first:** cancellation notice
   (§12), waitlist promotion notice (§10), reminders (§19), event chat (§18).

Confirm this order works before I start on any specific item — happy to take
these one at a time.
