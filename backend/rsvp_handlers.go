package main

import (
	"encoding/json"
	"net/http"

	sqlcdb "github.com/michael99hernan/clubmax/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

type rsvpRequest struct {
	UserID string `json:"user_id"`
}

type setMaybeRequest struct {
	UserID string `json:"user_id"`
}

// setMaybeHandler: POST /events/{id}/maybe
// A narrow endpoint just for the "Maybe" RSVP status — unlike join/leave,
// "maybe" doesn't affect capacity/waitlist accounting at all, so it skips
// all of joinEventHandler's locking/capacity logic and just upserts the
// status directly.
func setMaybeHandler(w http.ResponseWriter, r *http.Request) {
	var eventID pgtype.UUID
	if err := eventID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid event id: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req setMaybeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var userID pgtype.UUID
	if err := userID.Scan(req.UserID); err != nil {
		http.Error(w, "invalid user_id: "+err.Error(), http.StatusBadRequest)
		return
	}

	rsvp, err := queries.UpsertRSVP(r.Context(), sqlcdb.UpsertRSVPParams{
		EventID: eventID,
		UserID:  userID,
		Status:  "maybe",
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rsvp)
}

func joinEventHandler(w http.ResponseWriter, r *http.Request) {
	var eventID pgtype.UUID
	if err := eventID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid event id: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req rsvpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var userID pgtype.UUID
	if err := userID.Scan(req.UserID); err != nil {
		http.Error(w, "invalid user_id: "+err.Error(), http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Begin a transaction. Everything from here until Commit/Rollback
	// happens atomically as far as other transactions are concerned.
	tx, err := pool.Begin(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// If we return early for any reason without committing, Rollback undoes
	// everything done so far in this transaction. Calling Rollback after a
	// successful Commit is a harmless no-op, which is why defer is safe here.
	defer tx.Rollback(ctx)

	qtx := queries.WithTx(tx)

	// FOR UPDATE locks this event's row. If two requests hit this handler
	// for the same event at the same instant, the second one blocks here
	// until the first one's transaction commits or rolls back — that's
	// what prevents both from reading "3 of 5 spots taken" simultaneously
	// and both deciding there's room.
	event, err := qtx.GetEventForUpdate(ctx, eventID)
	if err != nil {
		http.Error(w, "event not found: "+err.Error(), http.StatusNotFound)
		return
	}

	// Private events normally require an individual invite. Exception: if
	// the event is hosted by a group, being an active member of that group
	// grants access automatically — no separate invite needed.
	if event.AccessTier == "private" {
		hasGroupAccess := false
		if event.GroupID.Valid {
			member, err := qtx.GetGroupMember(ctx, sqlcdb.GetGroupMemberParams{
				GroupID: event.GroupID,
				UserID:  userID,
			})
			hasGroupAccess = err == nil && member.Status == "active"
		}
		if !hasGroupAccess {
			_, err := qtx.GetEventInvite(ctx, sqlcdb.GetEventInviteParams{
				EventID: eventID,
				UserID:  userID,
			})
			if err != nil {
				http.Error(w, "this event is private — you need an invite", http.StatusForbidden)
				return
			}
		}
	}

	// request-tier events without auto_accept go to 'pending' and don't
	// consume a capacity slot until the host approves them. Everything else
	// (open events, or request-tier with auto_accept on) behaves like the
	// original open-tier logic: joined if there's room, waitlisted if not.
	needsApproval := event.AccessTier == "request" && !event.AutoAccept

	status := "joined"

	if needsApproval {
		status = "pending"
	} else if event.CapacityMax.Valid {
		count, err := qtx.CountJoinedRSVPs(ctx, eventID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if count >= int64(event.CapacityMax.Int32) {
			status = "waitlisted"
		}
	}

	rsvp, err := qtx.UpsertRSVP(ctx, sqlcdb.UpsertRSVPParams{
		EventID: eventID,
		UserID:  userID,
		Status:  status,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(rsvp)
}

func leaveEventHandler(w http.ResponseWriter, r *http.Request) {
	var eventID pgtype.UUID
	if err := eventID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid event id: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req rsvpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var userID pgtype.UUID
	if err := userID.Scan(req.UserID); err != nil {
		http.Error(w, "invalid user_id: "+err.Error(), http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	tx, err := pool.Begin(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	qtx := queries.WithTx(tx)

	// Lock the event row for the same reason as joinEventHandler: leaving
	// and promoting someone off the waitlist needs to be atomic too, or two
	// people could get promoted into the one newly-opened spot.
	_, err = qtx.GetEventForUpdate(ctx, eventID)
	if err != nil {
		http.Error(w, "event not found: "+err.Error(), http.StatusNotFound)
		return
	}

	if err := qtx.DeleteRSVP(ctx, sqlcdb.DeleteRSVPParams{
		EventID: eventID,
		UserID:  userID,
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Promote the longest-waiting person on the waitlist, if anyone's there.
	promoted, err := qtx.GetOldestWaitlisted(ctx, eventID)
	if err == nil {
		_, err = qtx.UpsertRSVP(ctx, sqlcdb.UpsertRSVPParams{
			EventID: eventID,
			UserID:  promoted.UserID,
			Status:  "joined",
		})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	// If err != nil here, it just means nobody was waitlisted — GetOldestWaitlisted
	// returns pgx.ErrNoRows in that case, which is expected, not a real failure.

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// approveRSVPHandler moves a 'pending' RSVP to 'joined', for the host (or a
// co-host) of a request-tier event to call. Enforced server-side via
// isEventManager — this used to be wide open, which was a real bug.
func approveRSVPHandler(w http.ResponseWriter, r *http.Request) {
	var eventID pgtype.UUID
	if err := eventID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid event id: "+err.Error(), http.StatusBadRequest)
		return
	}
	var userID pgtype.UUID
	if err := userID.Scan(r.PathValue("userId")); err != nil {
		http.Error(w, "invalid user id: "+err.Error(), http.StatusBadRequest)
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

	ctx := r.Context()

	tx, err := pool.Begin(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	qtx := queries.WithTx(tx)

	// Same locking reasoning as joinEventHandler: approving someone needs to
	// check capacity atomically too, or two approvals could both succeed
	// into what's actually only one remaining spot.
	event, err := qtx.GetEventForUpdate(ctx, eventID)
	if err != nil {
		http.Error(w, "event not found: "+err.Error(), http.StatusNotFound)
		return
	}

	status := "joined"
	if event.CapacityMax.Valid {
		count, err := qtx.CountJoinedRSVPs(ctx, eventID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if count >= int64(event.CapacityMax.Int32) {
			status = "waitlisted"
		}
	}

	rsvp, err := qtx.UpsertRSVP(ctx, sqlcdb.UpsertRSVPParams{
		EventID: eventID,
		UserID:  userID,
		Status:  status,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rsvp)
}

func declineRSVPHandler(w http.ResponseWriter, r *http.Request) {
	var eventID pgtype.UUID
	if err := eventID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid event id: "+err.Error(), http.StatusBadRequest)
		return
	}
	var userID pgtype.UUID
	if err := userID.Scan(r.PathValue("userId")); err != nil {
		http.Error(w, "invalid user id: "+err.Error(), http.StatusBadRequest)
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

	rsvp, err := queries.UpsertRSVP(r.Context(), sqlcdb.UpsertRSVPParams{
		EventID: eventID,
		UserID:  userID,
		Status:  "declined",
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rsvp)
}
