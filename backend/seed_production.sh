#!/bin/bash
# Seeds the LIVE production API (Railway) with a real friend group's worth
# of data: 22 users (7 "core" users who host/organize things, 15 lighter
# "example" users), a friend graph, 4 groups across all access tiers, ~14
# events spanning categories/tiers/capacities, RSVPs in every status, a
# few co-hosts, and event invites — so everyone has something to look at
# from day one.
#
# Unlike reset_and_seed.sh, this does NOT truncate anything first — it's
# meant to run once against a fresh, empty production database (just the
# schema loaded, no data yet). It only talks to the public API, so no
# direct Postgres access is needed.
#
# Usage: BASE_URL=https://your-backend.up.railway.app ./seed_production.sh
# (defaults to the current Railway URL if BASE_URL isn't set)

set -e

BASE_URL="${BASE_URL:-https://clubmaxing-production.up.railway.app}"
echo "Seeding against: $BASE_URL"

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

echo "== Creating core users =="
MICHAEL_ID=$(create_user "michael@example.com" "Michael")
OMER_ID=$(create_user "omer@example.com" "Omer")
BLAKE_ID=$(create_user "blake@example.com" "Blake")
ISAAC_ID=$(create_user "isaac@example.com" "Isaac")
RICHIE_ID=$(create_user "richie@example.com" "Richie")
SHANE_ID=$(create_user "shane@example.com" "Shane")
CONNOR_ID=$(create_user "connor@example.com" "Connor")
echo "Core users created: Michael, Omer, Blake, Isaac, Richie, Shane, Connor"

echo "== Creating example users =="
MAYA_ID=$(create_user "maya.torres@example.com" "Maya Torres")
DEREK_ID=$(create_user "derek.chan@example.com" "Derek Chan")
PRIYA_ID=$(create_user "priya.shah@example.com" "Priya Shah")
LOGAN_ID=$(create_user "logan.reyes@example.com" "Logan Reyes")
AVA_ID=$(create_user "ava.whitfield@example.com" "Ava Whitfield")
TYLER_ID=$(create_user "tyler.brooks@example.com" "Tyler Brooks")
NINA_ID=$(create_user "nina.volkov@example.com" "Nina Volkov")
JORDAN_ID=$(create_user "jordan.reeves@example.com" "Jordan Reeves")
SASHA_ID=$(create_user "sasha.kim@example.com" "Sasha Kim")
MARCUS_ID=$(create_user "marcus.webb@example.com" "Marcus Webb")
CHLOE_ID=$(create_user "chloe.bennett@example.com" "Chloe Bennett")
DIEGO_ID=$(create_user "diego.fuentes@example.com" "Diego Fuentes")
HANNAH_ID=$(create_user "hannah.cole@example.com" "Hannah Cole")
ELLIOT_ID=$(create_user "elliot.park@example.com" "Elliot Park")
RUBY_ID=$(create_user "ruby.simmons@example.com" "Ruby Simmons")
echo "Example users created: 15 total"

# ---------------------------------------------------------------------------
# Friend graph — the 7 core users are all mutual friends with each other,
# plus each befriends a couple of example users. A few requests are left
# pending on purpose so "Request sent" / incoming requests show up too.
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

CORE_IDS=("$MICHAEL_ID" "$OMER_ID" "$BLAKE_ID" "$ISAAC_ID" "$RICHIE_ID" "$SHANE_ID" "$CONNOR_ID")
for i in "${!CORE_IDS[@]}"; do
  for j in "${!CORE_IDS[@]}"; do
    if [ "$i" -lt "$j" ]; then
      befriend "${CORE_IDS[$i]}" "${CORE_IDS[$j]}"
    fi
  done
done

befriend "$MICHAEL_ID" "$MAYA_ID"
befriend "$MICHAEL_ID" "$DEREK_ID"
befriend "$OMER_ID" "$PRIYA_ID"
befriend "$OMER_ID" "$LOGAN_ID"
befriend "$BLAKE_ID" "$AVA_ID"
befriend "$BLAKE_ID" "$TYLER_ID"
befriend "$ISAAC_ID" "$NINA_ID"
befriend "$ISAAC_ID" "$JORDAN_ID"
befriend "$RICHIE_ID" "$SASHA_ID"
befriend "$RICHIE_ID" "$MARCUS_ID"
befriend "$SHANE_ID" "$CHLOE_ID"
befriend "$SHANE_ID" "$DIEGO_ID"
befriend "$CONNOR_ID" "$HANNAH_ID"
befriend "$CONNOR_ID" "$ELLIOT_ID"
befriend "$CONNOR_ID" "$RUBY_ID"

# A few example users friend each other directly too.
befriend "$MAYA_ID" "$DEREK_ID"
befriend "$PRIYA_ID" "$LOGAN_ID"
befriend "$AVA_ID" "$TYLER_ID"

# Left pending on purpose.
send_friend_request "$NINA_ID" "$JORDAN_ID"
send_friend_request "$SASHA_ID" "$MARCUS_ID"
send_friend_request "$CHLOE_ID" "$DIEGO_ID"
send_friend_request "$HANNAH_ID" "$ELLIOT_ID"

echo "Friend graph built"

# ---------------------------------------------------------------------------
# Groups
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

CREW_GROUP_ID=$(create_group "The Crew" "Shared group for the core crew" "$MICHAEL_ID" "open")
join_group "$CREW_GROUP_ID" "$OMER_ID"
join_group "$CREW_GROUP_ID" "$BLAKE_ID"
join_group "$CREW_GROUP_ID" "$ISAAC_ID"
join_group "$CREW_GROUP_ID" "$MAYA_ID"
join_group "$CREW_GROUP_ID" "$DEREK_ID"
echo "Created The Crew (open): $CREW_GROUP_ID"

WARRIORS_GROUP_ID=$(create_group "Weekend Warriors" "Request-to-join sports & social crew" "$ISAAC_ID" "request")
join_group "$WARRIORS_GROUP_ID" "$PRIYA_ID"
join_group "$WARRIORS_GROUP_ID" "$LOGAN_ID"
join_group "$WARRIORS_GROUP_ID" "$AVA_ID"
curl -s -X POST "$BASE_URL/groups/$WARRIORS_GROUP_ID/members/$PRIYA_ID/approve" -H "X-User-Id: $ISAAC_ID" > /dev/null
curl -s -X POST "$BASE_URL/groups/$WARRIORS_GROUP_ID/members/$LOGAN_ID/approve" -H "X-User-Id: $ISAAC_ID" > /dev/null
# AVA_ID left pending on purpose
echo "Created Weekend Warriors (request): $WARRIORS_GROUP_ID"

BOOKCLUB_GROUP_ID=$(create_group "Book Club" "Private monthly book discussion" "$RICHIE_ID" "private")
curl -s -X POST "$BASE_URL/groups/$BOOKCLUB_GROUP_ID/invites" \
  -H "Content-Type: application/json" -H "X-User-Id: $RICHIE_ID" \
  -d "{\"user_id\": \"$NINA_ID\"}" > /dev/null
curl -s -X POST "$BASE_URL/groups/$BOOKCLUB_GROUP_ID/invites" \
  -H "Content-Type: application/json" -H "X-User-Id: $RICHIE_ID" \
  -d "{\"user_id\": \"$JORDAN_ID\"}" > /dev/null
join_group "$BOOKCLUB_GROUP_ID" "$NINA_ID"
# JORDAN_ID invited but hasn't joined yet
echo "Created Book Club (private): $BOOKCLUB_GROUP_ID"

FOODIES_GROUP_ID=$(create_group "Foodies" "Everything food, all are welcome" "$SHANE_ID" "open")
join_group "$FOODIES_GROUP_ID" "$CONNOR_ID"
join_group "$FOODIES_GROUP_ID" "$SASHA_ID"
join_group "$FOODIES_GROUP_ID" "$MARCUS_ID"
join_group "$FOODIES_GROUP_ID" "$CHLOE_ID"
echo "Created Foodies (open): $FOODIES_GROUP_ID"

# Round out membership for the rest of the example users so everyone lands
# in at least one group.
join_group "$CREW_GROUP_ID" "$DIEGO_ID"
join_group "$CREW_GROUP_ID" "$HANNAH_ID"
join_group "$FOODIES_GROUP_ID" "$ELLIOT_ID"
join_group "$FOODIES_GROUP_ID" "$RUBY_ID"
join_group "$FOODIES_GROUP_ID" "$TYLER_ID"

# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

echo "== Creating events =="

create_event() {
  local title="$1"
  local description="$2"
  local starts_at="$3"
  local created_by="$4"
  local access_tier="$5"
  local capacity="$6"
  local category="$7"
  local group_id="$8"
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

E1=$(create_event "Morning Run Club" "5k loop through the park, all paces welcome" "2026-07-20T07:00:00Z" "$ISAAC_ID" "open" "" "Sports" "$CREW_GROUP_ID" "attendees" "public")
E2=$(create_event "Trivia Night" "Teams of 4, prizes for the top 2" "2026-07-22T19:00:00Z" "$OMER_ID" "request" "10" "Social" "$WARRIORS_GROUP_ID" "host_only" "public")
E3=$(create_event "Book Club: Sci-Fi Picks" "Discussing Project Hail Mary" "2026-07-25T18:00:00Z" "$RICHIE_ID" "private" "8" "Learning" "$BOOKCLUB_GROUP_ID" "host_only" "network")
E4=$(create_event "Taco Tuesday Meetup" "Best taco truck in the city, meet there" "2026-07-28T18:30:00Z" "$SHANE_ID" "open" "6" "Social" "$FOODIES_GROUP_ID" "attendees" "public")
E5=$(create_event "Sunrise Hike" "Moderate 4-mile trail, bring water" "2026-07-30T06:30:00Z" "$MICHAEL_ID" "open" "" "Outdoors" "$CREW_GROUP_ID" "attendees" "public")
E6=$(create_event "Vinyl & Chill Listening Party" "Bring a record, we'll take turns" "2026-08-01T20:00:00Z" "$CONNOR_ID" "open" "12" "Music" "" "host_only" "public")
E7=$(create_event "Pickup Basketball" "Full court, 5-on-5" "2026-08-03T17:00:00Z" "$BLAKE_ID" "open" "10" "Sports" "" "attendees" "public")
E8=$(create_event "Cooking Class: Pasta from Scratch" "Hands-on, all ingredients provided" "2026-08-05T18:00:00Z" "$SHANE_ID" "request" "8" "Learning" "$FOODIES_GROUP_ID" "host_only" "public")
E9=$(create_event "Board Game Night" "Catan, Wingspan, and more" "2026-08-07T19:00:00Z" "$CONNOR_ID" "open" "8" "Social" "" "attendees" "public")
E10=$(create_event "Weekend Farmers Market Walk" "Casual stroll, coffee after" "2026-08-09T09:00:00Z" "$ISAAC_ID" "open" "" "Outdoors" "$CREW_GROUP_ID" "attendees" "public")
E11=$(create_event "Live Jazz Night" "Local trio, small cover at the door" "2026-08-11T20:00:00Z" "$RICHIE_ID" "open" "15" "Music" "" "host_only" "public")
E12=$(create_event "Startup Founders Meetup" "Invite-only, DM for details" "2026-08-13T18:00:00Z" "$MICHAEL_ID" "private" "10" "Learning" "" "host_only" "network")
E13=$(create_event "Soccer Scrimmage" "5-a-side, bring a light/dark shirt" "2026-08-15T16:00:00Z" "$ISAAC_ID" "open" "12" "Sports" "$CREW_GROUP_ID" "attendees" "public")
E14=$(create_event "Wine & Cheese Social" "Approval needed, limited spots" "2026-08-17T19:00:00Z" "$SHANE_ID" "request" "8" "Social" "$FOODIES_GROUP_ID" "host_only" "public")

echo "Created 14 events"

# ---------------------------------------------------------------------------
# Co-hosts
# ---------------------------------------------------------------------------

echo "== Adding co-hosts =="
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
add_cohost "$E10" "$ISAAC_ID" "$OMER_ID"
add_cohost "$E13" "$ISAAC_ID" "$BLAKE_ID"

# ---------------------------------------------------------------------------
# RSVPs
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

for uid in "$OMER_ID" "$BLAKE_ID" "$MAYA_ID" "$DEREK_ID" "$HANNAH_ID"; do join_event "$E1" "$uid"; done
maya_ignore=1
maybe_event "$E1" "$DIEGO_ID"

for uid in "$SHANE_ID" "$CONNOR_ID" "$PRIYA_ID" "$LOGAN_ID" "$AVA_ID"; do join_event "$E2" "$uid"; done
approve_rsvp "$E2" "$SHANE_ID" "$OMER_ID"
approve_rsvp "$E2" "$CONNOR_ID" "$OMER_ID"
decline_rsvp "$E2" "$PRIYA_ID" "$OMER_ID"
# LOGAN_ID, AVA_ID left pending on purpose

join_event "$E3" "$NINA_ID"

for uid in "$MICHAEL_ID" "$ISAAC_ID" "$RICHIE_ID" "$CONNOR_ID" "$SASHA_ID" "$MARCUS_ID" "$TYLER_ID"; do join_event "$E4" "$uid"; done

for uid in "$OMER_ID" "$BLAKE_ID" "$RICHIE_ID" "$SHANE_ID"; do join_event "$E5" "$uid"; done
maybe_event "$E5" "$ELLIOT_ID"

for uid in "$MICHAEL_ID" "$ISAAC_ID" "$RUBY_ID" "$ELLIOT_ID"; do join_event "$E6" "$uid"; done

for uid in "$OMER_ID" "$RICHIE_ID" "$TYLER_ID" "$HANNAH_ID"; do join_event "$E7" "$uid"; done
maybe_event "$E7" "$DIEGO_ID"

for uid in "$CONNOR_ID" "$SASHA_ID" "$MARCUS_ID" "$CHLOE_ID"; do join_event "$E8" "$uid"; done
approve_rsvp "$E8" "$CONNOR_ID" "$SHANE_ID"
decline_rsvp "$E8" "$SASHA_ID" "$SHANE_ID"
# MARCUS_ID, CHLOE_ID left pending on purpose

for uid in "$MICHAEL_ID" "$ISAAC_ID" "$RUBY_ID"; do join_event "$E9" "$uid"; done

for uid in "$MICHAEL_ID" "$OMER_ID" "$BLAKE_ID" "$MAYA_ID"; do join_event "$E10" "$uid"; done

for uid in "$MICHAEL_ID" "$ISAAC_ID" "$OMER_ID" "$NINA_ID" "$JORDAN_ID"; do join_event "$E11" "$uid"; done

join_event "$E12" "$RICHIE_ID"
join_event "$E12" "$SHANE_ID"

for uid in "$OMER_ID" "$BLAKE_ID" "$MAYA_ID" "$DEREK_ID" "$DIEGO_ID" "$HANNAH_ID"; do join_event "$E13" "$uid"; done

for uid in "$CONNOR_ID" "$SASHA_ID" "$MARCUS_ID"; do join_event "$E14" "$uid"; done
approve_rsvp "$E14" "$CONNOR_ID" "$SHANE_ID"
# SASHA_ID, MARCUS_ID left pending on purpose

# ---------------------------------------------------------------------------
# Event invites — make sure everyone has at least one invite showing up
# under "Invited", not just people who happen to already be attending.
# ---------------------------------------------------------------------------

echo "== Sending event invites =="
invite_to_event() {
  local event_id="$1"
  local host_id="$2"
  local invitee_id="$3"
  curl -s -X POST "$BASE_URL/events/$event_id/invites" \
    -H "Content-Type: application/json" -H "X-User-Id: $host_id" \
    -d "{\"user_id\": \"$invitee_id\"}" > /dev/null
}

invite_to_event "$E1" "$ISAAC_ID" "$JORDAN_ID"
invite_to_event "$E4" "$SHANE_ID" "$RUBY_ID"
invite_to_event "$E6" "$CONNOR_ID" "$LOGAN_ID"
invite_to_event "$E7" "$BLAKE_ID" "$AVA_ID"
invite_to_event "$E9" "$CONNOR_ID" "$CHLOE_ID"
invite_to_event "$E11" "$RICHIE_ID" "$PRIYA_ID"
invite_to_event "$E13" "$ISAAC_ID" "$SASHA_ID"
invite_to_event "$E14" "$SHANE_ID" "$MARCUS_ID"

echo "== Done =="
echo "Core users: Michael=$MICHAEL_ID Omer=$OMER_ID Blake=$BLAKE_ID Isaac=$ISAAC_ID Richie=$RICHIE_ID Shane=$SHANE_ID Connor=$CONNOR_ID"
echo "Groups: Crew=$CREW_GROUP_ID Warriors=$WARRIORS_GROUP_ID BookClub=$BOOKCLUB_GROUP_ID Foodies=$FOODIES_GROUP_ID"
echo "Events: $E1 $E2 $E3 $E4 $E5 $E6 $E7 $E8 $E9 $E10 $E11 $E12 $E13 $E14"
