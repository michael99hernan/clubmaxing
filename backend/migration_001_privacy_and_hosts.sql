-- Run this once against your existing local dev DB to bring it in line with
-- the updated schema.sql, without dropping any existing data.
--   psql postgres://postgres:devpass@localhost:5432/clubmax -f migration_001_privacy_and_hosts.sql

ALTER TABLE groups
    ADD COLUMN IF NOT EXISTS access_tier TEXT NOT NULL DEFAULT 'open'
        CHECK (access_tier IN ('open', 'request', 'private'));

ALTER TABLE group_members
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'pending'));

CREATE TABLE IF NOT EXISTS group_invites (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS invite_policy TEXT NOT NULL DEFAULT 'host_only'
        CHECK (invite_policy IN ('host_only', 'attendees')),
    ADD COLUMN IF NOT EXISTS discoverability TEXT NOT NULL DEFAULT 'public'
        CHECK (discoverability IN ('public', 'network')),
    ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

CREATE TABLE IF NOT EXISTS event_hosts (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, user_id)
);
