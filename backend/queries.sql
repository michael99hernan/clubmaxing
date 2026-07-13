-- name: CreateUser :one
INSERT INTO users (email, name)
VALUES ($1, $2)
RETURNING *;

-- name: CreateEvent :one
INSERT INTO events (
    title, description, latitude, longitude, starts_at, created_by, access_tier,
    capacity_max, group_id, category, invite_policy, discoverability, cover_photo_url, auto_accept
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *;

-- name: UpdateEvent :one
UPDATE events
SET title = $2, description = $3, latitude = $4, longitude = $5, starts_at = $6,
    access_tier = $7, capacity_max = $8, category = $9, invite_policy = $10,
    discoverability = $11, cover_photo_url = $12, auto_accept = $13, group_id = $14
WHERE id = $1
RETURNING *;

-- name: GetEventOwner :one
SELECT created_by FROM events WHERE id = $1;

-- name: GetEvent :one
SELECT * FROM events
WHERE id = $1;

-- name: GetUser :one
SELECT * FROM users
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1;

-- name: GetUserByName :one
SELECT * FROM users
WHERE name = $1;

-- name: GetEventForUpdate :one
-- FOR UPDATE locks this row until the enclosing transaction commits or
-- rolls back. Any other transaction trying to lock the same row (via this
-- same query) has to wait its turn — that's what makes capacity checks safe
-- under concurrent requests.
SELECT id, group_id, capacity_max, access_tier, auto_accept FROM events
WHERE id = $1
FOR UPDATE;

-- name: CountJoinedRSVPs :one
SELECT COUNT(*) FROM event_rsvps
WHERE event_id = $1 AND status = 'joined';

-- name: UpsertRSVP :one
-- ON CONFLICT handles a user re-joining/re-leaving an event they already
-- have an RSVP row for, updating their existing row instead of erroring
-- on the (event_id, user_id) primary key collision.
INSERT INTO event_rsvps (event_id, user_id, status)
VALUES ($1, $2, $3)
ON CONFLICT (event_id, user_id)
DO UPDATE SET status = EXCLUDED.status, requested_at = now()
RETURNING *;

-- name: DeleteRSVP :exec
DELETE FROM event_rsvps
WHERE event_id = $1 AND user_id = $2;

-- name: GetOldestWaitlisted :one
-- Used after someone leaves, to find who should be promoted off the waitlist.
SELECT * FROM event_rsvps
WHERE event_id = $1 AND status = 'waitlisted'
ORDER BY requested_at ASC
LIMIT 1;

-- name: ListUsers :many
SELECT * FROM users
ORDER BY created_at DESC;

-- name: ListEvents :many
SELECT * FROM events
ORDER BY starts_at ASC;

-- name: ListHostedEventsForUser :many
-- "My events" — anything the user created OR co-hosts.
SELECT DISTINCT e.* FROM events e
LEFT JOIN event_hosts eh ON eh.event_id = e.id
WHERE e.created_by = $1 OR eh.user_id = $1
ORDER BY e.starts_at ASC;

-- name: ListInvitedEventsForUser :many
-- Events this user has been invited to, regardless of whether they've
-- responded yet — this is the "pending invites" view that never existed
-- before (previously invites only worked if you already had the link).
SELECT e.* FROM events e
JOIN event_invites ei ON ei.event_id = e.id
WHERE ei.user_id = $1
ORDER BY e.starts_at ASC;

-- name: ListRSVPdEventsForUser :many
-- "Going" — every event this user has any RSVP row for, plus that RSVP's
-- status, so the frontend can distinguish joined/maybe/pending/waitlisted.
SELECT e.*, r.status AS rsvp_status FROM events e
JOIN event_rsvps r ON r.event_id = e.id
WHERE r.user_id = $1
ORDER BY e.starts_at ASC;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;

-- name: DeleteEvent :exec
DELETE FROM events WHERE id = $1;

-- name: ListRSVPsForEvent :many
SELECT * FROM event_rsvps WHERE event_id = $1 ORDER BY requested_at ASC;

-- name: CreateGroup :one
INSERT INTO groups (name, description, created_by, access_tier)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetGroup :one
SELECT * FROM groups WHERE id = $1;

-- name: GetGroupOwner :one
SELECT created_by FROM groups WHERE id = $1;

-- name: ListGroups :many
SELECT * FROM groups ORDER BY created_at DESC;

-- name: DeleteGroup :exec
DELETE FROM groups WHERE id = $1;

-- name: AddGroupMember :one
-- Owner is set once at group creation (see createGroupHandler); everyone
-- who joins afterward defaults to 'member'. ON CONFLICT lets someone who
-- left and rejoined get a fresh row instead of erroring on the PK.
INSERT INTO group_members (group_id, user_id, role, status)
VALUES ($1, $2, $3, $4)
ON CONFLICT (group_id, user_id)
DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status
RETURNING *;

-- name: UpdateGroupMemberStatus :one
-- Used to promote a 'pending' request-tier member to 'active' (or decline
-- by just removing the row via RemoveGroupMember instead).
UPDATE group_members
SET status = $3
WHERE group_id = $1 AND user_id = $2
RETURNING *;

-- name: GetGroupMember :one
SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2;

-- name: RemoveGroupMember :exec
DELETE FROM group_members WHERE group_id = $1 AND user_id = $2;

-- name: ListGroupMembers :many
SELECT * FROM group_members WHERE group_id = $1 ORDER BY joined_at ASC;

-- name: ListPendingGroupMembers :many
SELECT * FROM group_members WHERE group_id = $1 AND status = 'pending' ORDER BY joined_at ASC;

-- name: CreateGroupInvite :one
INSERT INTO group_invites (group_id, user_id, invited_by)
VALUES ($1, $2, $3)
ON CONFLICT (group_id, user_id) DO NOTHING
RETURNING *;

-- name: GetGroupInvite :one
SELECT * FROM group_invites WHERE group_id = $1 AND user_id = $2;

-- name: ListGroupInvites :many
SELECT * FROM group_invites WHERE group_id = $1 ORDER BY created_at ASC;

-- name: ListGroupInvitesForUser :many
-- All group invites for this user, across every group — used by the
-- notifications panel so "invited to a group" shows up regardless of
-- which group it was.
SELECT gi.group_id, gi.user_id, gi.invited_by, gi.created_at, g.name AS group_name
FROM group_invites gi
JOIN groups g ON g.id = gi.group_id
WHERE gi.user_id = $1
ORDER BY gi.created_at DESC;

-- name: CreateEventHost :one
INSERT INTO event_hosts (event_id, user_id, added_by)
VALUES ($1, $2, $3)
ON CONFLICT (event_id, user_id) DO NOTHING
RETURNING *;

-- name: GetEventHost :one
SELECT * FROM event_hosts WHERE event_id = $1 AND user_id = $2;

-- name: ListEventHosts :many
SELECT * FROM event_hosts WHERE event_id = $1 ORDER BY created_at ASC;

-- name: RemoveEventHost :exec
DELETE FROM event_hosts WHERE event_id = $1 AND user_id = $2;

-- name: ListGroupsForUser :many
SELECT g.* FROM groups g
JOIN group_members gm ON gm.group_id = g.id
WHERE gm.user_id = $1
ORDER BY g.created_at DESC;

-- name: ListEventsForGroup :many
SELECT * FROM events WHERE group_id = $1 ORDER BY starts_at ASC;

-- name: SendFriendRequest :one
-- ON CONFLICT lets someone re-send after a decline, refreshing it back to
-- pending instead of erroring on the (requester_id, addressee_id) PK.
INSERT INTO friendships (requester_id, addressee_id, status)
VALUES ($1, $2, 'pending')
ON CONFLICT (requester_id, addressee_id)
DO UPDATE SET status = 'pending', created_at = now()
RETURNING *;

-- name: RespondToFriendRequest :one
-- Note the direction: only the addressee (the person who received the
-- request) should be able to accept/decline it — enforced in Go, not SQL.
UPDATE friendships
SET status = $3
WHERE requester_id = $1 AND addressee_id = $2
RETURNING *;

-- name: RemoveFriendship :exec
-- Direction-agnostic: removes the row regardless of who originally sent
-- the request, since "unfriending" should work either way.
DELETE FROM friendships
WHERE (requester_id = $1 AND addressee_id = $2)
   OR (requester_id = $2 AND addressee_id = $1);

-- name: ListFriends :many
-- A friendship is "real" once accepted, and can be stored in either
-- direction, so this checks both and returns whichever side ISN'T $1.
SELECT u.* FROM users u
JOIN friendships f ON (
    (f.requester_id = $1 AND f.addressee_id = u.id) OR
    (f.addressee_id = $1 AND f.requester_id = u.id)
)
WHERE f.status = 'accepted'
ORDER BY u.name ASC;

-- name: ListPendingFriendRequests :many
-- Requests THIS user has received and hasn't responded to yet.
SELECT f.requester_id, u.name, u.email, f.created_at
FROM friendships f
JOIN users u ON u.id = f.requester_id
WHERE f.addressee_id = $1 AND f.status = 'pending'
ORDER BY f.created_at ASC;

-- name: ListSentFriendRequests :many
-- Requests THIS user has sent that the other person hasn't responded to
-- yet — the mirror image of ListPendingFriendRequests, used to show
-- "Request sent" instead of "Add friend" on the Users page.
SELECT f.addressee_id, u.name, u.email, f.created_at
FROM friendships f
JOIN users u ON u.id = f.addressee_id
WHERE f.requester_id = $1 AND f.status = 'pending'
ORDER BY f.created_at ASC;

-- name: GetFriendship :one
SELECT * FROM friendships
WHERE (requester_id = $1 AND addressee_id = $2)
   OR (requester_id = $2 AND addressee_id = $1);

-- name: CreateEventInvite :one
INSERT INTO event_invites (event_id, user_id, invited_by)
VALUES ($1, $2, $3)
ON CONFLICT (event_id, user_id) DO NOTHING
RETURNING *;

-- name: GetEventInvite :one
SELECT * FROM event_invites WHERE event_id = $1 AND user_id = $2;

-- name: ListEventInvites :many
SELECT * FROM event_invites WHERE event_id = $1 ORDER BY created_at ASC;
