package main

import (
	"encoding/json"
	"errors"
	"net/http"

	sqlcdb "github.com/michael99hernan/clubmax/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type createInviteRequest struct {
	UserID string `json:"user_id"`
}

// createInviteHandler: POST /events/{id}/invites
// Who can invite is host-configurable via events.invite_policy:
//   - "host_only": only the event's owner or a co-host
//   - "attendees": the above, plus anyone with an active ('joined') RSVP
//
// This replaces the old "anyone logged in can invite anyone" behavior,
// which was a real bug — invites weren't gated by the inviter having any
// actual relationship to the event at all.
func createInviteHandler(w http.ResponseWriter, r *http.Request) {
	var eventID pgtype.UUID
	if err := eventID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid event id: "+err.Error(), http.StatusBadRequest)
		return
	}

	var invitedBy pgtype.UUID
	if err := invitedBy.Scan(r.Header.Get("X-User-Id")); err != nil {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}

	event, err := queries.GetEvent(r.Context(), eventID)
	if err != nil {
		http.Error(w, "event not found", http.StatusNotFound)
		return
	}

	allowed := isEventManager(r, r.Context(), eventID, event.CreatedBy)
	if !allowed && event.InvitePolicy == "attendees" {
		rsvp, err := queries.ListRSVPsForEvent(r.Context(), eventID)
		if err == nil {
			for _, rr := range rsvp {
				if rr.UserID == invitedBy && rr.Status == "joined" {
					allowed = true
					break
				}
			}
		}
	}
	if !allowed {
		http.Error(w, "you don't have permission to invite people to this event", http.StatusForbidden)
		return
	}

	var req createInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var userID pgtype.UUID
	if err := userID.Scan(req.UserID); err != nil {
		http.Error(w, "invalid user_id: "+err.Error(), http.StatusBadRequest)
		return
	}

	invite, err := queries.CreateEventInvite(r.Context(), sqlcdb.CreateEventInviteParams{
		EventID:   eventID,
		UserID:    userID,
		InvitedBy: invitedBy,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// ON CONFLICT DO NOTHING means "already invited" — idempotent,
		// not a real failure, so respond success with no body.
		w.WriteHeader(http.StatusOK)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(invite)
}

func listEventInvitesHandler(w http.ResponseWriter, r *http.Request) {
	var eventID pgtype.UUID
	if err := eventID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid event id: "+err.Error(), http.StatusBadRequest)
		return
	}
	invites, err := queries.ListEventInvites(r.Context(), eventID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if invites == nil {
		invites = []sqlcdb.EventInvite{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invites)
}
