#!/bin/bash
# Helper functions for hitting the local clubmax API.
# Usage: source commands.sh   (run this once per terminal session)
# Then call e.g.: create_user "you@example.com" "Michael"

BASE_URL="http://localhost:8080"

create_user() {
    local email="$1"
    local name="$2"
    curl -s -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"$email\", \"name\": \"$name\"}"
    echo
}

create_event() {
    local title="$1"
    local lat="$2"
    local lng="$3"
    local starts_at="$4"
    local created_by="$5"
    local capacity_max="$6"    # optional — omit for unlimited capacity
    local access_tier="$7"     # optional — "open" (default), "request", or "private"

    local capacity_json="null"
    if [ -n "$capacity_max" ]; then
        capacity_json="$capacity_max"
    fi

    local tier="${access_tier:-open}"

    curl -s -X POST "$BASE_URL/events" \
        -H "Content-Type: application/json" \
        -d "{\"title\": \"$title\", \"latitude\": $lat, \"longitude\": $lng, \"starts_at\": \"$starts_at\", \"created_by\": \"$created_by\", \"capacity_max\": $capacity_json, \"access_tier\": \"$tier\"}"
    echo
}

health() {
    curl -s "$BASE_URL/health"
    echo
}

get_event() {
    local id="$1"
    curl -s "$BASE_URL/events/$id"
    echo
}

get_user() {
    local id="$1"
    curl -s "$BASE_URL/users/$id"
    echo
}

get_user_by_email() {
    local email="$1"
    curl -s "$BASE_URL/users/lookup/email?email=$email"
    echo
}

get_user_by_name() {
    local name="$1"
    curl -s "$BASE_URL/users/lookup/name?name=$name"
    echo
}

join_event() {
    local event_id="$1"
    local user_id="$2"
    curl -s -X POST "$BASE_URL/events/$event_id/join" \
        -H "Content-Type: application/json" \
        -d "{\"user_id\": \"$user_id\"}"
    echo
}

leave_event() {
    local event_id="$1"
    local user_id="$2"
    curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/events/$event_id/leave" \
        -H "Content-Type: application/json" \
        -d "{\"user_id\": \"$user_id\"}"
}

list_users() {
    curl -s "$BASE_URL/users"
    echo
}

list_events() {
    curl -s "$BASE_URL/events"
    echo
}

delete_user() {
    local id="$1"
    curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$BASE_URL/users/$id"
}

delete_event() {
    local id="$1"
    curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$BASE_URL/events/$id"
}

list_rsvps() {
    local event_id="$1"
    curl -s "$BASE_URL/events/$event_id/rsvps"
    echo
}

approve_rsvp() {
    local event_id="$1"
    local user_id="$2"
    curl -s -X POST "$BASE_URL/events/$event_id/rsvps/$user_id/approve"
    echo
}

decline_rsvp() {
    local event_id="$1"
    local user_id="$2"
    curl -s -X POST "$BASE_URL/events/$event_id/rsvps/$user_id/decline"
    echo
}

create_group() {
    local name="$1"
    local description="$2"
    local created_by="$3"
    curl -s -X POST "$BASE_URL/groups" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$name\", \"description\": \"$description\", \"created_by\": \"$created_by\"}"
    echo
}

list_groups() {
    curl -s "$BASE_URL/groups"
    echo
}

get_group() {
    local id="$1"
    curl -s "$BASE_URL/groups/$id"
    echo
}

delete_group() {
    local id="$1"
    curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$BASE_URL/groups/$id"
}

join_group() {
    local group_id="$1"
    local user_id="$2"
    curl -s -X POST "$BASE_URL/groups/$group_id/join" \
        -H "Content-Type: application/json" \
        -d "{\"user_id\": \"$user_id\"}"
    echo
}

leave_group() {
    local group_id="$1"
    local user_id="$2"
    curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/groups/$group_id/leave" \
        -H "Content-Type: application/json" \
        -d "{\"user_id\": \"$user_id\"}"
}

list_group_members() {
    local group_id="$1"
    curl -s "$BASE_URL/groups/$group_id/members"
    echo
}

send_friend_request() {
    local user_id="$1"
    local addressee_id="$2"
    curl -s -X POST "$BASE_URL/friends/requests" \
        -H "Content-Type: application/json" \
        -H "X-User-Id: $user_id" \
        -d "{\"addressee_id\": \"$addressee_id\"}"
    echo
}

respond_friend_request() {
    local user_id="$1"      # the person accepting/declining
    local requester_id="$2"
    local accept="$3"       # "true" or "false"
    curl -s -X POST "$BASE_URL/friends/requests/respond" \
        -H "Content-Type: application/json" \
        -H "X-User-Id: $user_id" \
        -d "{\"requester_id\": \"$requester_id\", \"accept\": $accept}"
    echo
}

list_friends() {
    local user_id="$1"
    curl -s "$BASE_URL/friends" -H "X-User-Id: $user_id"
    echo
}

list_pending_friend_requests() {
    local user_id="$1"
    curl -s "$BASE_URL/friends/requests" -H "X-User-Id: $user_id"
    echo
}

remove_friend() {
    local user_id="$1"
    local other_id="$2"
    curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$BASE_URL/friends/$other_id" \
        -H "X-User-Id: $user_id"
}

invite_to_event() {
    local event_id="$1"
    local inviter_id="$2"
    local invitee_id="$3"
    curl -s -X POST "$BASE_URL/events/$event_id/invites" \
        -H "Content-Type: application/json" \
        -H "X-User-Id: $inviter_id" \
        -d "{\"user_id\": \"$invitee_id\"}"
    echo
}

list_event_invites() {
    local event_id="$1"
    curl -s "$BASE_URL/events/$event_id/invites"
    echo
}
