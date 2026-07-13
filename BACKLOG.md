# ClubMaxing — Feature Backlog

Running list of things flagged during the build but deliberately not implemented yet. Nothing here should be started without confirming scope first.

## UX polish (near-term)

- **Invite flow feedback**: after inviting a friend to an event, show a confirmation message ("Invite sent") instead of just silently disabling the button.
- **Pending invites section**: an invited user currently has no way to see "events I've been invited to" anywhere in the UI — invites only work if you already have the direct link. Needs a list (e.g. on `/events` or a new `/invites` page) showing events you've been invited to but haven't joined yet.
- **Maybe RSVP status**: backend already supports a `maybe` status on `event_rsvps`, but the frontend only exposes Join/Leave — no "Maybe" button anywhere.
- **Auto-accept toggle**: `events.auto_accept` exists in the schema and is checked in `joinEventHandler`, but no form (create or edit) lets a host actually turn it on — every `request`-tier event currently requires manual approval.
- **Event description & location name**: both columns exist on `events` but aren't in the create/edit forms — every event is currently just lat/lng with no human-readable place name or description.
- **Waitlist promotion notification**: when someone leaves and the next waitlisted person is auto-promoted to `joined`, there's no notification — they'd only find out by revisiting the event page.
- **Group roles**: only `owner` (set automatically at group creation) and default `member` exist in practice — no UI to promote/demote members to `admin`, even though the schema and `CHECK` constraint support it.
- **Delete confirmations**: currently using the browser's native `confirm()` for event deletion — fine for now, but a real modal would match the rest of the UI.
- **Map/location picker**: latitude/longitude are manually typed numbers right now — no actual map UI to drop a pin.

## Real requirements-doc features not yet built

- **Discovery feed**: the core "what's happening near me" browsing experience from the original vision doc. Currently `/events` is a flat list, no map view, no filtering by category/distance/time.
- **Chat**: both group-level and event-level chat from the vision doc — not started. This is also Phase 2 of the technical roadmap (introduces WebSockets/real-time).
- **Notifications**: event-driven notifications (RSVP updates, event starting soon, friend request received) — not started. Phase 3 of the technical roadmap (introduces an event bus — Kafka/Redis Streams).
- **Category field**: `events.category` exists in the schema but nothing sets or filters by it yet.

## Known, documented gaps (not bugs — deliberate deferrals)

- **No real authentication.** Login is "pick a user from a list," no passwords. The `X-User-Id` header used for ownership checks (edit/delete event, friend actions, invites) is spoofable — anyone can claim to be any user ID. Documented from the start as a trust-and-safety gap to revisit.
- **No identity verification / reputation / check-in safety features** for the "meet a stranger in public" use case — explicitly deferred in the original vision doc.
- **No rate limiting or abuse prevention** anywhere.

## Infrastructure / not-yet-productionized

- Hardcoded `localhost` URLs (`NEXT_PUBLIC_API_URL`, CORS origin, Postgres connection string) — fine for local dev, would need real environment-based config to deploy anywhere.
- No automated tests (unit or integration) anywhere in the backend or frontend.
- No pagination — `/events`, `/users`, `/groups` all fetch everything in one request. Fine at current scale (dozens of rows), would break down with real data volume.
- Phase 4/5 of the technical roadmap (splitting the monolith into services, Docker/Kubernetes deployment, geospatial sharding) — not started, intentionally deferred until there's a real reason to split (per the "don't start distributed" teaching principle from early in the build).

## Uncertainties still worth locking down

- `pgtype.UUID` / `pgtype.Int4` / `pgtype.Text` JSON shapes were never definitively confirmed — several frontend components (`EventDetail.tsx`'s `normalizeUUID`, `formatCapacity` in a couple places, `formatDescription` for groups) defensively handle multiple possible shapes instead of relying on one confirmed shape. Worth testing directly and simplifying once confirmed.
