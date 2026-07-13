#!/bin/bash
# Creates 100 test users by hitting the running API 100 times.
# Usage: ./seed_users.sh   (make sure the server is running first)

BASE_URL="http://localhost:8080"

for i in $(seq 1 100); do
    curl -s -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"user$i@example.com\", \"name\": \"User $i\"}" \
        > /dev/null
    echo "Created user $i"
done

echo "Done. Verify with: curl -s $BASE_URL/users | jq length"
