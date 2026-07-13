package main

import (
	"encoding/json"
	"net/http"

	sqlcdb "github.com/michael99hernan/clubmax/internal/db"
)

// listMyEventsHandler: GET /events/mine  (X-User-Id identifies who "mine" is)
// Events the caller created or co-hosts.
func listMyEventsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := requesterUUID(r)
	if !ok {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}
	events, err := queries.ListHostedEventsForUser(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if events == nil {
		events = []sqlcdb.Event{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

// listInvitedEventsHandler: GET /events/invited
// Every event the caller has been invited to — the "where do I see my
// invites" view that didn't exist before.
func listInvitedEventsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := requesterUUID(r)
	if !ok {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}
	events, err := queries.ListInvitedEventsForUser(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if events == nil {
		events = []sqlcdb.Event{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

// listGoingEventsHandler: GET /events/going
// Every event the caller has any RSVP row for (joined, maybe, pending,
// waitlisted, declined), each tagged with that RSVP's status.
func listGoingEventsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := requesterUUID(r)
	if !ok {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}
	rows, err := queries.ListRSVPdEventsForUser(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if rows == nil {
		rows = []sqlcdb.ListRSVPdEventsForUserRow{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rows)
}
