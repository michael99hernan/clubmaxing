CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    access_tier TEXT NOT NULL DEFAULT 'open' CHECK (access_tier IN ('open', 'request', 'private')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    -- 'pending' is only used for request-tier groups awaiting owner/admin
    -- approval; 'active' members show up everywhere membership is checked
    -- (including "does membership grant access to this group's private
    -- events").
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

-- Invite to join a group. For private-tier groups this is the only way in.
-- For request-tier groups, an invite just skips the pending-approval step
-- (inviter is vouching for them) — see joinGroupHandler.
CREATE TABLE group_invites (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    location_name TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    capacity_max INTEGER,
    access_tier TEXT NOT NULL DEFAULT 'open' CHECK (access_tier IN ('open', 'request', 'private')),
    auto_accept BOOLEAN NOT NULL DEFAULT false,
    category TEXT,
    -- Host-configurable: who besides the host/co-hosts can invite others.
    -- 'host_only' = just the host and co-hosts; 'attendees' = anyone with
    -- an active RSVP (joined) can invite too.
    invite_policy TEXT NOT NULL DEFAULT 'host_only' CHECK (invite_policy IN ('host_only', 'attendees')),
    -- Independent from access_tier: access_tier controls who can JOIN,
    -- discoverability controls who can SEE it in a list/feed at all.
    discoverability TEXT NOT NULL DEFAULT 'public' CHECK (discoverability IN ('public', 'network')),
    cover_photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Co-hosts: users other than event.created_by who get the same management
-- powers (edit, delete, approve/decline RSVPs, invite per invite_policy).
CREATE TABLE event_hosts (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, user_id)
);

CREATE TABLE event_rsvps (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'maybe', 'pending', 'declined', 'waitlisted')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, user_id)
);

-- Mutual friend requests: a row starts 'pending' (requester -> addressee),
-- and only becomes a real friendship once the addressee accepts. Direction
-- matters for who sent the request, but "are these two users friends" has
-- to check both directions once accepted.
CREATE TABLE friendships (
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);

-- An invite to a specific event. For private-tier events, this is the ONLY
-- way in — private events reject direct joins unless an invite row exists.
-- For open/request-tier events, an invite is more of a notification/nudge;
-- joining still follows the normal open/request rules.
CREATE TABLE event_invites (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, user_id)
);
