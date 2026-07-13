#!/bin/bash
# Wipes all data in the clubmax DB and reseeds it with a realistic month's
# worth of activity:
#   - 25 users: 8 "power users" (heavy hosts/joiners, lots of friends) and
#     17 "example users" (a handful of RSVPs each, some pending friend
#     requests) — including Isaac and Michael as the two power hosts
#   - 4 groups spanning all three access tiers (open/request/private)
#   - 18 events spread over ~6 weeks (some already past, some upcoming),
#     spanning all 6 categories, mixing open/request/private, some with
#     small capacities so waitlisting actually triggers
#   - RSVPs in every status (joined, maybe, pending, waitlisted, declined)
#   - a realistic friend graph, including a few still-pending requests
#
# Requires: the Postgres container ("clubmax-db") running, the API server
# running on localhost:8080, and jq installed (brew install jq if needed).
#
# Usage: ./reset_and_seed.sh

set -e

BASE_URL="http://localhost:8080"
DB_CONTAINER="clubmax-db"

echo "== Wiping all data =="
docker exec -i "$DB_CONTAINER" psql -U postgres -d clubmax -c \
  "TRUNCATE TABLE event_hosts, event_invites, event_rsvps, events, group_invites, group_members, groups, friendships, users RESTART IDENTITY CASCADE;"

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

create_user() {
  local email="$1"
  local name="$2"
  curl -s -X POST "$BASE_URL/users" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"name\": \"$name\"}" | jq -r '.id'
}

echo "== Creating power users (heavy hosts/joiners) =="
MICHAEL_ID=$(create_user "michael@example.com" "Michael")
ISAAC_ID=$(create_user "isaac@example.com" "Isaac")
SARAH_ID=$(create_user "sarah.chen@example.com" "Sarah Chen")
MARCUS_ID=$(create_user "marcus.johnson@example.com" "Marcus Johnson")
PRIYA_ID=$(create_user "priya.patel@example.com" "Priya Patel")
DAVID_ID=$(create_user "david.kim@example.com" "David Kim")
EMMA_ID=$(create_user "emma.rodriguez@example.com" "Emma Rodriguez")
JAMES_ID=$(create_user "james.wilson@example.com" "James Wilson")
echo "Power users created: Michael, Isaac, Sarah, Marcus, Priya, David, Emma, James"

echo "== Creating example users (light activity) =="
OLIVIA_ID=$(create_user "olivia.martinez@example.com" "Olivia Martinez")
NOAH_ID=$(create_user "noah.thompson@example.com" "Noah Thompson")
AVA_ID=$(create_user "ava.nguyen@example.com" "Ava Nguyen")
ETHAN_ID=$(create_user "ethan.brooks@example.com" "Ethan Brooks")
SOPHIA_ID=$(create_user "sophia.lee@example.com" "Sophia Lee")
LIAM_ID=$(create_user "liam.oconnor@example.com" "Liam O'Connor")
ISABELLA_ID=$(create_user "isabella.garcia@example.com" "Isabella Garcia")
MASON_ID=$(create_user "mason.clark@example.com" "Mason Clark")
MIA_ID=$(create_user "mia.anderson@example.com" "Mia Anderson")
LUCAS_ID=$(create_user "lucas.ferreira@example.com" "Lucas Ferreira")
CHARLOTTE_ID=$(create_user "charlotte.davis@example.com" "Charlotte Davis")
BENJAMIN_ID=$(create_user "benjamin.cohen@example.com" "Benjamin Cohen")
AMELIA_ID=$(create_user "amelia.foster@example.com" "Amelia Foster")
HENRY_ID=$(create_user "henry.nakamura@example.com" "Henry Nakamura")
GRACE_ID=$(create_user "grace.sullivan@example.com" "Grace Sullivan")
DANIEL_ID=$(create_user "daniel.osei@example.com" "Daniel Osei")
ZOE_ID=$(create_user "zoe.bennett@example.com" "Zoe Bennett")
echo "Example users created: 17 total"

# ---------------------------------------------------------------------------
# Friend graph — power users are all mutual friends with each other and with
# several example users; a few requests are left pending on purpose.
# ---------------------------------------------------------------------------

echo "== Building friend graph =="

send_friend_request() {
  local from="$1"
  local to="$2"
  curl -s -X POST "$BASE_URL/friends/requests" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: $from" \
    -d "{\"addressee_id\": \"$to\"}" > /dev/null
}

accept_friend_request() {
  local addressee="$1"
  local requester="$2"
  curl -s -X POST "$BASE_URL/friends/requests/respond" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: $addressee" \
    -d "{\"requester_id\": \"$requester\", \"accept\": true}" > /dev/null
}

befriend() {
  send_friend_request "$1" "$2"
  accept_friend_request "$2" "$1"
}

# Power users: all mutual friends with each other.
POWER_IDS=("$MICHAEL_ID" "$ISAAC_ID" "$SARAH_ID" "$MARCUS_ID" "$PRIYA_ID" "$DAVID_ID" "$EMMA_ID" "$JAMES_ID")
for i in "${!POWER_IDS[@]}"; do
  for j in "${!POWER_IDS[@]}"; do
    if [ "$i" -lt "$j" ]; then
      befriend "${POWER_IDS[$i]}" "${POWER_IDS[$j]}"
    fi
  done
done

# Each power user befriends a few example users, spreading the load around.
befriend "$MICHAEL_ID" "$OLIVIA_ID"
befriend "$MICHAEL_ID" "$NOAH_ID"
befriend "$MICHAEL_ID" "$AVA_ID"
befriend "$ISAAC_ID" "$ETHAN_ID"
befriend "$ISAAC_ID" "$SOPHIA_ID"
befriend "$ISAAC_ID" "$LIAM_ID"
befriend "$SARAH_ID" "$ISABELLA_ID"
befriend "$SARAH_ID" "$MASON_ID"
befriend "$MARCUS_ID" "$MIA_ID"
befriend "$MARCUS_ID" "$LUCAS_ID"
befriend "$PRIYA_ID" "$CHARLOTTE_ID"
befriend "$PRIYA_ID" "$BENJAMIN_ID"
befriend "$DAVID_ID" "$AMELIA_ID"
befriend "$DAVID_ID" "$HENRY_ID"
befriend "$EMMA_ID" "$GRACE_ID"
befriend "$JAMES_ID" "$DANIEL_ID"
befriend "$JAMES_ID" "$ZOE_ID"

# A few example users friend each other directly too.
befriend "$OLIVIA_ID" "$NOAH_ID"
befriend "$ETHAN_ID" "$SOPHIA_ID"
befriend "$ISABELLA_ID" "$MASON_ID"

# Some requests left pending on purpose (never accepted) — realistic
# "still waiting" state to look at in the UI.
send_friend_request "$AVA_ID" "$ETHAN_ID"
send_friend_request "$MIA_ID" "$LUCAS_ID"
send_friend_request "$CHARLOTTE_ID" "$BENJAMIN_ID"
send_friend_request "$GRACE_ID" "$DANIEL_ID"

echo "Friend graph built (mutual power-user friendships, spread-out example friendships, a few pending requests)"

# ---------------------------------------------------------------------------
# Groups — one of each access tier, plus the open Michael/Isaac crew group.
# ---------------------------------------------------------------------------

echo "== Creating groups =="

create_group() {
  local name="$1"
  local description="$2"
  local created_by="$3"
  local access_tier="$4"
  curl -s -X POST "$BASE_URL/groups" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$name\", \"description\": \"$description\", \"created_by\": \"$created_by\", \"access_tier\": \"$access_tier\"}" \
    | jq -r '.id'
}

join_group() {
  local group_id="$1"
  local user_id="$2"
  curl -s -X POST "$BASE_URL/groups/$group_id/join" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\": \"$user_id\"}" > /dev/null
}

CREW_GROUP_ID=$(create_group "Michael & Isaac's Crew" "Shared group hosted by Michael and Isaac" "$MICHAEL_ID" "open")
join_group "$CREW_GROUP_ID" "$ISAAC_ID"
join_group "$CREW_GROUP_ID" "$SARAH_ID"
join_group "$CREW_GROUP_ID" "$DAVID_ID"
join_group "$CREW_GROUP_ID" "$OLIVIA_ID"
echo "Created Crew group (open): $CREW_GROUP_ID"

WARRIORS_GROUP_ID=$(create_group "Weekend Warriors" "Request-to-join sports & social crew" "$SARAH_ID" "request")
join_group "$WARRIORS_GROUP_ID" "$EMMA_ID"       # active tier default for owner-added isn't relevant; join goes pending
join_group "$WARRIORS_GROUP_ID" "$JAMES_ID"
join_group "$WARRIORS_GROUP_ID" "$MASON_ID"      # left pending on purpose
echo "Created Weekend Warriors group (request): $WARRIORS_GROUP_ID"
# Sarah (owner) approves Emma and James, leaves Mason pending.
curl -s -X POST "$BASE_URL/groups/$WARRIORS_GROUP_ID/members/$EMMA_ID/approve" -H "X-User-Id: $SARAH_ID" > /dev/null
curl -s -X POST "$BASE_URL/groups/$WARRIORS_GROUP_ID/members/$JAMES_ID/approve" -H "X-User-Id: $SARAH_ID" > /dev/null

BOOKCLUB_GROUP_ID=$(create_group "Book Club" "Private monthly book discussion" "$PRIYA_ID" "private")
curl -s -X POST "$BASE_URL/groups/$BOOKCLUB_GROUP_ID/invites" \
  -H "Content-Type: application/json" -H "X-User-Id: $PRIYA_ID" \
  -d "{\"user_id\": \"$CHARLOTTE_ID\"}" > /dev/null
curl -s -X POST "$BASE_URL/groups/$BOOKCLUB_GROUP_ID/invites" \
  -H "Content-Type: application/json" -H "X-User-Id: $PRIYA_ID" \
  -d "{\"user_id\": \"$BENJAMIN_ID\"}" > /dev/null
join_group "$BOOKCLUB_GROUP_ID" "$CHARLOTTE_ID"  # invited, so joins straight to active
echo "Created Book Club group (private): $BOOKCLUB_GROUP_ID (Benjamin invited but hasn't joined yet)"

FOODIES_GROUP_ID=$(create_group "Foodies United" "Everything food, all are welcome" "$MARCUS_ID" "open")
join_group "$FOODIES_GROUP_ID" "$PRIYA_ID"
join_group "$FOODIES_GROUP_ID" "$JAMES_ID"
join_group "$FOODIES_GROUP_ID" "$EMMA_ID"
echo "Created Foodies United group (open): $FOODIES_GROUP_ID"

# ---------------------------------------------------------------------------
# Events — spread over ~6 weeks, mixing category/access tier/capacity/group.
# ---------------------------------------------------------------------------

echo "== Creating events =="

create_event() {
  local title="$1"
  local description="$2"
  local starts_at="$3"
  local created_by="$4"
  local access_tier="$5"
  local capacity="$6"        # empty string = unlimited
  local category="$7"
  local group_id="$8"        # empty string = personal event
  local invite_policy="$9"
  local discoverability="${10}"

  local capacity_json="null"
  if [ -n "$capacity" ]; then capacity_json="$capacity"; fi
  local group_json="null"
  if [ -n "$group_id" ]; then group_json="\"$group_id\""; fi

  curl -s -X POST "$BASE_URL/events" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: $created_by" \
    -d "{\"title\": \"$title\", \"description\": \"$description\", \"latitude\": 37.7749, \"longitude\": -122.4194, \"starts_at\": \"$starts_at\", \"created_by\": \"$created_by\", \"access_tier\": \"$access_tier\", \"capacity_max\": $capacity_json, \"category\": \"$category\", \"group_id\": $group_json, \"invite_policy\": \"$invite_policy\", \"discoverability\": \"$discoverability\"}" \
    | jq -r '.id'
}

E1=$(create_event "Morning Run Club" "5k loop through the park, all paces welcome" "2026-06-20T07:00:00Z" "$ISAAC_ID" "open" "" "Sports" "$CREW_GROUP_ID" "attendees" "public")
E2=$(create_event "Trivia Night" "Teams of 4, prizes for the top 2" "2026-06-22T19:00:00Z" "$SARAH_ID" "request" "10" "Social" "$WARRIORS_GROUP_ID" "host_only" "public")
E3=$(create_event "Book Club: Sci-Fi Picks" "Discussing Project Hail Mary" "2026-06-25T18:00:00Z" "$PRIYA_ID" "private" "8" "Learning" "$BOOKCLUB_GROUP_ID" "host_only" "network")
E4=$(create_event "Taco Tuesday Meetup" "Best taco truck in the city, meet there" "2026-06-30T18:30:00Z" "$MARCUS_ID" "open" "6" "Social" "$FOODIES_GROUP_ID" "attendees" "public")
E5=$(create_event "Sunrise Hike" "Moderate 4-mile trail, bring water" "2026-07-02T06:30:00Z" "$MICHAEL_ID" "open" "" "Outdoors" "$CREW_GROUP_ID" "attendees" "public")
E6=$(create_event "Vinyl & Chill Listening Party" "Bring a record, we'll take turns" "2026-07-04T20:00:00Z" "$JAMES_ID" "open" "12" "Music" "" "host_only" "public")
E7=$(create_event "Pickup Basketball" "Full court, 5-on-5" "2026-07-05T17:00:00Z" "$DAVID_ID" "open" "10" "Sports" "" "attendees" "public")
E8=$(create_event "Cooking Class: Pasta from Scratch" "Hands-on, all ingredients provided" "2026-07-06T18:00:00Z" "$PRIYA_ID" "request" "8" "Learning" "$FOODIES_GROUP_ID" "host_only" "public")
E9=$(create_event "Board Game Night" "Catan, Wingspan, and more" "2026-07-08T19:00:00Z" "$EMMA_ID" "open" "8" "Social" "" "attendees" "public")
E10=$(create_event "Weekend Farmers Market Walk" "Casual stroll, coffee after" "2026-07-10T09:00:00Z" "$ISAAC_ID" "open" "" "Outdoors" "$CREW_GROUP_ID" "attendees" "public")
E11=$(create_event "Trivia Night Round 2" "Rematch — same teams welcome" "2026-07-12T19:00:00Z" "$SARAH_ID" "request" "10" "Social" "$WARRIORS_GROUP_ID" "host_only" "public")
E12=$(create_event "Beach Cleanup + BBQ" "Cleanup at 11, BBQ after at 1" "2026-07-15T11:00:00Z" "$MICHAEL_ID" "open" "" "Outdoors" "$CREW_GROUP_ID" "attendees" "public")
E13=$(create_event "Live Jazz Night" "Local trio, small cover at the door" "2026-07-18T20:00:00Z" "$JAMES_ID" "open" "15" "Music" "" "host_only" "public")
E14=$(create_event "Startup Founders Meetup" "Invite-only, DM for details" "2026-07-20T18:00:00Z" "$DAVID_ID" "private" "10" "Learning" "" "host_only" "network")
E15=$(create_event "Soccer Scrimmage" "5-a-side, bring a light/dark shirt" "2026-07-22T16:00:00Z" "$ISAAC_ID" "open" "12" "Sports" "$CREW_GROUP_ID" "attendees" "public")
E16=$(create_event "Wine & Cheese Social" "Approval needed, limited spots" "2026-07-25T19:00:00Z" "$PRIYA_ID" "request" "8" "Social" "$FOODIES_GROUP_ID" "host_only" "public")
E17=$(create_event "Kayaking Trip" "Rentals available, arrive 30 min early" "2026-07-28T09:00:00Z" "$MICHAEL_ID" "open" "6" "Outdoors" "" "attendees" "public")
E18=$(create_event "Karaoke Night" "Private room booked, snacks provided" "2026-08-01T20:00:00Z" "$MARCUS_ID" "open" "" "Music" "$FOODIES_GROUP_ID" "attendees" "public")

echo "Created 18 events"

# ---------------------------------------------------------------------------
# Co-hosts — Michael and Isaac co-host each other's Crew-group events.
# ---------------------------------------------------------------------------

echo "== Adding co-hosts on Crew events =="
add_cohost() {
  local event_id="$1"
  local owner_id="$2"
  local cohost_id="$3"
  curl -s -X POST "$BASE_URL/events/$event_id/hosts" \
    -H "Content-Type: application/json" -H "X-User-Id: $owner_id" \
    -d "{\"user_id\": \"$cohost_id\"}" > /dev/null
}
add_cohost "$E1" "$ISAAC_ID" "$MICHAEL_ID"
add_cohost "$E5" "$MICHAEL_ID" "$ISAAC_ID"
add_cohost "$E10" "$ISAAC_ID" "$MICHAEL_ID"
add_cohost "$E12" "$MICHAEL_ID" "$ISAAC_ID"
add_cohost "$E15" "$ISAAC_ID" "$MICHAEL_ID"

# ---------------------------------------------------------------------------
# RSVPs — join/maybe across the board, plus approve/decline on request-tier
# events so pending/joined/waitlisted/declined all actually show up.
# ---------------------------------------------------------------------------

echo "== Adding RSVPs =="

join_event() {
  local event_id="$1"
  local user_id="$2"
  curl -s -X POST "$BASE_URL/events/$event_id/join" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\": \"$user_id\"}" > /dev/null
}

maybe_event() {
  local event_id="$1"
  local user_id="$2"
  curl -s -X POST "$BASE_URL/events/$event_id/maybe" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\": \"$user_id\"}" > /dev/null
}

approve_rsvp() {
  local event_id="$1"
  local user_id="$2"
  local host_id="$3"
  curl -s -X POST "$BASE_URL/events/$event_id/rsvps/$user_id/approve" -H "X-User-Id: $host_id" > /dev/null
}

decline_rsvp() {
  local event_id="$1"
  local user_id="$2"
  local host_id="$3"
  curl -s -X POST "$BASE_URL/events/$event_id/rsvps/$user_id/decline" -H "X-User-Id: $host_id" > /dev/null
}

# E1 Morning Run Club (open, unlimited) — big turnout
for uid in "$SARAH_ID" "$DAVID_ID" "$OLIVIA_ID" "$NOAH_ID" "$AVA_ID" "$ETHAN_ID"; do join_event "$E1" "$uid"; done
maybe_event "$E1" "$SOPHIA_ID"

# E2 Trivia Night (request, capacity 10) — some approved, one declined
for uid in "$MARCUS_ID" "$EMMA_ID" "$JAMES_ID" "$MASON_ID" "$ISABELLA_ID"; do join_event "$E2" "$uid"; done
approve_rsvp "$E2" "$MARCUS_ID" "$SARAH_ID"
approve_rsvp "$E2" "$EMMA_ID" "$SARAH_ID"
approve_rsvp "$E2" "$JAMES_ID" "$SARAH_ID"
decline_rsvp "$E2" "$MASON_ID" "$SARAH_ID"
# ISABELLA_ID left pending on purpose

# E3 Book Club (private, capacity 8) — only invited/group members can join
join_event "$E3" "$CHARLOTTE_ID"

# E4 Taco Tuesday (open, capacity 6) — oversubscribed on purpose to trigger waitlisting
for uid in "$JAMES_ID" "$EMMA_ID" "$MICHAEL_ID" "$ISAAC_ID" "$SARAH_ID" "$DAVID_ID" "$OLIVIA_ID" "$NOAH_ID"; do join_event "$E4" "$uid"; done

# E5 Sunrise Hike (open, unlimited)
for uid in "$SARAH_ID" "$EMMA_ID" "$AVA_ID" "$LIAM_ID"; do join_event "$E5" "$uid"; done
maybe_event "$E5" "$ETHAN_ID"

# E6 Vinyl & Chill (open, capacity 12)
for uid in "$MICHAEL_ID" "$ISAAC_ID" "$DAVID_ID" "$DANIEL_ID" "$ZOE_ID"; do join_event "$E6" "$uid"; done

# E7 Pickup Basketball (open, capacity 10)
for uid in "$MARCUS_ID" "$JAMES_ID" "$MASON_ID" "$LUCAS_ID" "$HENRY_ID"; do join_event "$E7" "$uid"; done
maybe_event "$E7" "$BENJAMIN_ID"

# E8 Cooking Class (request, capacity 8)
for uid in "$MARCUS_ID" "$JAMES_ID" "$EMMA_ID" "$CHARLOTTE_ID"; do join_event "$E8" "$uid"; done
approve_rsvp "$E8" "$MARCUS_ID" "$PRIYA_ID"
approve_rsvp "$E8" "$JAMES_ID" "$PRIYA_ID"
decline_rsvp "$E8" "$EMMA_ID" "$PRIYA_ID"
# CHARLOTTE_ID left pending on purpose

# E9 Board Game Night (open, capacity 8)
for uid in "$MICHAEL_ID" "$ISAAC_ID" "$GRACE_ID" "$AMELIA_ID"; do join_event "$E9" "$uid"; done

# E10 Farmers Market Walk (open, unlimited) — recent/past relative to "today"
for uid in "$MICHAEL_ID" "$SARAH_ID" "$DAVID_ID" "$OLIVIA_ID"; do join_event "$E10" "$uid"; done

# E11 Trivia Night Round 2 (request, capacity 10) — upcoming
for uid in "$MARCUS_ID" "$EMMA_ID" "$JAMES_ID"; do join_event "$E11" "$uid"; done
approve_rsvp "$E11" "$MARCUS_ID" "$SARAH_ID"
approve_rsvp "$E11" "$EMMA_ID" "$SARAH_ID"
# JAMES_ID left pending on purpose

# E12 Beach Cleanup + BBQ (open, unlimited) — upcoming, big group
for uid in "$SARAH_ID" "$DAVID_ID" "$EMMA_ID" "$JAMES_ID" "$OLIVIA_ID" "$NOAH_ID" "$AVA_ID"; do join_event "$E12" "$uid"; done

# E13 Live Jazz Night (open, capacity 15)
for uid in "$MICHAEL_ID" "$ISAAC_ID" "$SARAH_ID" "$SOPHIA_ID" "$LIAM_ID"; do join_event "$E13" "$uid"; done

# E14 Startup Founders Meetup (private, capacity 10)
join_event "$E14" "$MARCUS_ID"
join_event "$E14" "$PRIYA_ID"

# E15 Soccer Scrimmage (open, capacity 12)
for uid in "$SARAH_ID" "$EMMA_ID" "$JAMES_ID" "$MASON_ID" "$LUCAS_ID" "$HENRY_ID"; do join_event "$E15" "$uid"; done

# E16 Wine & Cheese Social (request, capacity 8)
for uid in "$MARCUS_ID" "$JAMES_ID" "$BENJAMIN_ID"; do join_event "$E16" "$uid"; done
approve_rsvp "$E16" "$MARCUS_ID" "$PRIYA_ID"
# JAMES_ID and BENJAMIN_ID left pending on purpose

# E17 Kayaking Trip (open, capacity 6) — oversubscribed on purpose
for uid in "$ISAAC_ID" "$SARAH_ID" "$DAVID_ID" "$EMMA_ID" "$JAMES_ID" "$OLIVIA_ID" "$NOAH_ID"; do join_event "$E17" "$uid"; done

# E18 Karaoke Night (open, unlimited)
for uid in "$PRIYA_ID" "$JAMES_ID" "$EMMA_ID" "$ZOE_ID" "$DANIEL_ID"; do join_event "$E18" "$uid"; done
maybe_event "$E18" "$GRACE_ID"

# ---------------------------------------------------------------------------
# Fill remaining gaps — every user should end up with at least one group,
# one event invite, and one RSVP, not just the power users and whoever
# happened to get pulled in above.
# ---------------------------------------------------------------------------

echo "== Filling gaps so every user has groups / invites / RSVPs =="

# Group-less example users get spread across the open groups (Crew, Foodies)
# so they land as active members immediately, no approval needed.
join_group "$CREW_GROUP_ID" "$NOAH_ID"
join_group "$CREW_GROUP_ID" "$AVA_ID"
join_group "$CREW_GROUP_ID" "$ETHAN_ID"
join_group "$FOODIES_GROUP_ID" "$SOPHIA_ID"
join_group "$FOODIES_GROUP_ID" "$LIAM_ID"
join_group "$FOODIES_GROUP_ID" "$ISABELLA_ID"
join_group "$CREW_GROUP_ID" "$MIA_ID"
join_group "$CREW_GROUP_ID" "$LUCAS_ID"
join_group "$FOODIES_GROUP_ID" "$BENJAMIN_ID"
join_group "$FOODIES_GROUP_ID" "$AMELIA_ID"
join_group "$CREW_GROUP_ID" "$HENRY_ID"
join_group "$CREW_GROUP_ID" "$GRACE_ID"
join_group "$FOODIES_GROUP_ID" "$DANIEL_ID"
join_group "$FOODIES_GROUP_ID" "$ZOE_ID"

# A couple land in the request-tier Weekend Warriors group too — one
# approved, one left pending — so that state stays visible for more than
# just Mason.
join_group "$WARRIORS_GROUP_ID" "$NOAH_ID"
curl -s -X POST "$BASE_URL/groups/$WARRIORS_GROUP_ID/members/$NOAH_ID/approve" -H "X-User-Id: $SARAH_ID" > /dev/null
join_group "$WARRIORS_GROUP_ID" "$AMELIA_ID"   # left pending on purpose

# Mia was the one user with zero event activity — give her some.
join_event "$E9" "$MIA_ID"
maybe_event "$E7" "$MIA_ID"

# Event invites — nobody was actually invite()'d anywhere before this; give
# every example user at least one invite so "Invited" isn't empty for them.
invite_to_event() {
  local event_id="$1"
  local host_id="$2"
  local invitee_id="$3"
  curl -s -X POST "$BASE_URL/events/$event_id/invites" \
    -H "Content-Type: application/json" -H "X-User-Id: $host_id" \
    -d "{\"user_id\": \"$invitee_id\"}" > /dev/null
}

invite_to_event "$E1" "$ISAAC_ID" "$SOPHIA_ID"
invite_to_event "$E1" "$ISAAC_ID" "$LIAM_ID"
invite_to_event "$E4" "$MARCUS_ID" "$BENJAMIN_ID"
invite_to_event "$E4" "$MARCUS_ID" "$AMELIA_ID"
invite_to_event "$E6" "$JAMES_ID" "$HENRY_ID"
invite_to_event "$E6" "$JAMES_ID" "$GRACE_ID"
invite_to_event "$E9" "$EMMA_ID" "$ISABELLA_ID"
invite_to_event "$E9" "$EMMA_ID" "$MASON_ID"
invite_to_event "$E13" "$JAMES_ID" "$NOAH_ID"
invite_to_event "$E13" "$JAMES_ID" "$AVA_ID"
invite_to_event "$E17" "$MICHAEL_ID" "$MIA_ID"
invite_to_event "$E17" "$MICHAEL_ID" "$LUCAS_ID"
invite_to_event "$E18" "$MARCUS_ID" "$ETHAN_ID"
invite_to_event "$E18" "$MARCUS_ID" "$CHARLOTTE_ID"
invite_to_event "$E12" "$MICHAEL_ID" "$DANIEL_ID"
invite_to_event "$E12" "$MICHAEL_ID" "$ZOE_ID"
invite_to_event "$E2" "$SARAH_ID" "$BENJAMIN_ID"
invite_to_event "$E16" "$PRIYA_ID" "$HENRY_ID"

echo "Gap-filling complete: every user now has at least one group, invite, and RSVP"

echo "== Done =="
echo "Power users: Michael=$MICHAEL_ID Isaac=$ISAAC_ID Sarah=$SARAH_ID Marcus=$MARCUS_ID Priya=$PRIYA_ID David=$DAVID_ID Emma=$EMMA_ID James=$JAMES_ID"
echo "Groups: Crew=$CREW_GROUP_ID Warriors=$WARRIORS_GROUP_ID BookClub=$BOOKCLUB_GROUP_ID Foodies=$FOODIES_GROUP_ID"
echo "Events: $E1 $E2 $E3 $E4 $E5 $E6 $E7 $E8 $E9 $E10 $E11 $E12 $E13 $E14 $E15 $E16 $E17 $E18"
