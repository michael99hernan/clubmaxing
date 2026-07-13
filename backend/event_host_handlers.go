package main

import (
	"encoding/json"
	"net/http"

	sqlcdb "github.com/michael99hernan/clubmax/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

type addEventHostRequest struct {
	UserID string `json:"user_id"`
}

// addEventHostHandler: POST /events/{id}/hosts
// Only the primary owner or an existing co-host can add another co-host —
// co-hosts get the same powers as the owner (edit, delete, approve/decline
// RSVPs, invite per invite_policy), so adding one is itself a host action.
func addEventHostHandler(w http.ResponseWriter, r *http.Request) {
	var eventID pgtype.UUID
	if err := eventID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid event id: "+err.Error(), http.StatusBadRequest)
		return
	}

	owner, err := queries.GetEventOwner(r.Context(), eventID)
	if err != nil {
		http.Error(w, "event not found", http.StatusNotFound)
		return
	}
	if !isEventManager(r, r.Context(), eventID, owner) {
		http.Error(w, "only the event host or a co-host can do this", http.StatusForbidden)
		return
	}

	var req addEventHostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var userID pgtype.UUID
	if err := userID.Scan(req.UserID); err != nil {
		http.Error(w, "invalid user_id: "+err.Error(), http.StatusBadRequest)
		return
	}

	addedBy, _ := requesterUUID(r)

	host, err := queries.CreateEventHost(r.Context(), sqlcdb.CreateEventHostParams{
		EventID: eventID,
		UserID:  userID,
		AddedBy: addedBy,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(host)
}

// removeEventHostHandler: DELETE /events/{id}/hosts/{userId}
func removeEventHostHandler(w http.ResponseWriter, r *http.Request) {
	var eventID pgtype.UUID
	if err := eventID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid event id: "+err.Error(), http.StatusBadRequest)
		return
	}

	owner, err := queries.GetEventOwner(r.Context(), eventID)
	if err != nil {
		http.Error(w, "event not found", http.StatusNotFound)
		return
	}
	if !isEventManager(r, r.Context(), eventID, owner) {
		http.Error(w, "only the event host or a co-host can do this", http.StatusForbidden)
		return
	}

	var userID pgtype.UUID
	if err := userID.Scan(r.PathValue("userId")); err != nil {
		http.Error(w, "invalid user id: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := queries.RemoveEventHost(r.Context(), sqlcdb.RemoveEventHostParams{
		EventID: eventID,
		UserID:  userID,
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func listEventHostsHandler(w http.ResponseWriter, r *http.Request) {
	var eventID pgtype.UUID
	if err := eventID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid event id: "+err.Error(), http.StatusBadRequest)
		return
	}
	hosts, err := queries.ListEventHosts(r.Context(), eventID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if hosts == nil {
		hosts = []sqlcdb.EventHost{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(hosts)
}
