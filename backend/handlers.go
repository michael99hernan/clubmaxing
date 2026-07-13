package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	sqlcdb "github.com/michael99hernan/clubmax/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

// isOwner checks the X-User-Id header (set by the frontend to whichever
// user is currently "logged in") against a resource's owner. This is NOT
// real authentication — there's no password or token proving the header is
// telling the truth, anyone could send any ID. It's a documented, known-weak
// step up from "hidden in the UI only": it at least means a client can't
// edit/delete something server-side just by hiding a button.
func isOwner(r *http.Request, ownerID pgtype.UUID) bool {
	headerID := r.Header.Get("X-User-Id")
	if headerID == "" {
		return false
	}
	var requester pgtype.UUID
	if err := requester.Scan(headerID); err != nil {
		return false
	}
	return requester.Valid && ownerID.Valid && requester.Bytes == ownerID.Bytes
}

// requesterUUID pulls the X-User-Id header into a pgtype.UUID. Returns
// (zero value, false) if it's missing or malformed.
func requesterUUID(r *http.Request) (pgtype.UUID, bool) {
	var id pgtype.UUID
	headerID := r.Header.Get("X-User-Id")
	if headerID == "" {
		return id, false
	}
	if err := id.Scan(headerID); err != nil {
		return id, false
	}
	return id, true
}

// isEventManager is isOwner extended to also allow co-hosts (event_hosts
// table) — used everywhere a single "only the creator" check used to be
// the whole story: edit, delete, approve/decline RSVPs, and invites under
// the host_only invite policy.
func isEventManager(r *http.Request, ctx context.Context, eventID pgtype.UUID, owner pgtype.UUID) bool {
	if isOwner(r, owner) {
		return true
	}
	requester, ok := requesterUUID(r)
	if !ok {
		return false
	}
	_, err := queries.GetEventHost(ctx, sqlcdb.GetEventHostParams{EventID: eventID, UserID: requester})
	return err == nil
}

// createEventRequest is the shape we accept over the wire.
// Plain Go types here, because JSON decoding doesn't know about pgtype.
type createEventRequest struct {
	Title           string    `json:"title"`
	Description     *string   `json:"description"`
	Latitude        float64   `json:"latitude"`
	Longitude       float64   `json:"longitude"`
	StartsAt        time.Time `json:"starts_at"`
	CreatedBy       string    `json:"created_by"`
	AccessTier      string    `json:"access_tier"`
	CapacityMax     *int32    `json:"capacity_max"`
	GroupID         *string   `json:"group_id"`
	Category        *string   `json:"category"`
	InvitePolicy    string    `json:"invite_policy"`
	Discoverability string    `json:"discoverability"`
	CoverPhotoUrl   *string   `json:"cover_photo_url"`
	AutoAccept      bool      `json:"auto_accept"`
}

func createEventHandler(w http.ResponseWriter, r *http.Request) {
	var req createEventRequest

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.AccessTier == "" {
		req.AccessTier = "open"
	}
	if req.InvitePolicy == "" {
		req.InvitePolicy = "host_only"
	}
	if req.Discoverability == "" {
		req.Discoverability = "public"
	}

	// pgtype.UUID and pgtype.Timestamptz aren't plain strings/times,
	// so we convert the request's plain values into them explicitly.
	var createdBy pgtype.UUID
	err = createdBy.Scan(req.CreatedBy)
	if err != nil {
		http.Error(w, "invalid created_by: "+err.Error(), http.StatusBadRequest)
		return
	}

	// capacity_max is optional (*int32) — nil means unlimited, matching
	// the nullable capacity_max column. pgtype.Int4's Valid field is what
	// actually represents that NULL-ness once it reaches Postgres.
	var capacityMax pgtype.Int4
	if req.CapacityMax != nil {
		capacityMax = pgtype.Int4{Int32: *req.CapacityMax, Valid: true}
	}

	var groupID pgtype.UUID
	if req.GroupID != nil && *req.GroupID != "" {
		if err := groupID.Scan(*req.GroupID); err != nil {
			http.Error(w, "invalid group_id: "+err.Error(), http.StatusBadRequest)
			return
		}
		// A group-hosted event can only be created by someone who's
		// actually an active member of that group — otherwise anyone could
		// attach any group to an event they host.
		member, err := queries.GetGroupMember(r.Context(), sqlcdb.GetGroupMemberParams{
			GroupID: groupID,
			UserID:  createdBy,
		})
		if err != nil || member.Status != "active" {
			http.Error(w, "you must be a member of this group to host an event under it", http.StatusForbidden)
			return
		}
	}

	var description pgtype.Text
	if req.Description != nil && *req.Description != "" {
		description = pgtype.Text{String: *req.Description, Valid: true}
	}

	var category pgtype.Text
	if req.Category != nil && *req.Category != "" {
		category = pgtype.Text{String: *req.Category, Valid: true}
	}

	var coverPhotoURL pgtype.Text
	if req.CoverPhotoUrl != nil && *req.CoverPhotoUrl != "" {
		coverPhotoURL = pgtype.Text{String: *req.CoverPhotoUrl, Valid: true}
	}

	event, err := queries.CreateEvent(r.Context(), sqlcdb.CreateEventParams{
		Title:           req.Title,
		Description:     description,
		Latitude:        req.Latitude,
		Longitude:       req.Longitude,
		StartsAt:        pgtype.Timestamptz{Time: req.StartsAt, Valid: true},
		CreatedBy:       createdBy,
		AccessTier:      req.AccessTier,
		CapacityMax:     capacityMax,
		GroupID:         groupID,
		Category:        category,
		InvitePolicy:    req.InvitePolicy,
		Discoverability: req.Discoverability,
		CoverPhotoUrl:   coverPhotoURL,
		AutoAccept:      req.AutoAccept,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// The host is implicitly attending their own event — auto-create a
	// 'joined' RSVP so they show up in the attendee list and count toward
	// capacity, without ever having to click "Join" on something they made.
	if _, err := queries.UpsertRSVP(r.Context(), sqlcdb.UpsertRSVPParams{
		EventID: event.ID,
		UserID:  createdBy,
		Status:  "joined",
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(event)
}

type createUserRequest struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

func createUserHandler(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	user, err := queries.CreateUser(r.Context(), sqlcdb.CreateUserParams{
		Email: req.Email,
		Name:  req.Name,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

func getEventHandler(w http.ResponseWriter, r *http.Request) {
	// r.PathValue reads the {id} segment out of the URL,
	// matched by the "GET /events/{id}" pattern registered in main.go.
	var id pgtype.UUID
	err := id.Scan(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid id: "+err.Error(), http.StatusBadRequest)
		return
	}

	event, err := queries.GetEvent(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(event)
}

func getUserHandler(w http.ResponseWriter, r *http.Request) {
	var id pgtype.UUID
	err := id.Scan(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid id: "+err.Error(), http.StatusBadRequest)
		return
	}

	user, err := queries.GetUser(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func getUserByEmailHandler(w http.ResponseWriter, r *http.Request) {
	// r.URL.Query().Get reads a ?key=value pair off the URL's query string,
	// as opposed to r.PathValue which reads a {segment} from the path itself.
	email := r.URL.Query().Get("email")
	if email == "" {
		http.Error(w, "missing email query param", http.StatusBadRequest)
		return
	}

	user, err := queries.GetUserByEmail(r.Context(), email)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func getUserByNameHandler(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		http.Error(w, "missing name query param", http.StatusBadRequest)
		return
	}

	user, err := queries.GetUserByName(r.Context(), name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func listUsersHandler(w http.ResponseWriter, r *http.Request) {
	users, err := queries.ListUsers(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// A nil slice encodes as JSON `null`, not `[]` — force an empty slice
	// so clients always get a real (possibly empty) array to work with.
	if users == nil {
		users = []sqlcdb.User{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func listEventsHandler(w http.ResponseWriter, r *http.Request) {
	events, err := queries.ListEvents(r.Context())
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

func deleteUserHandler(w http.ResponseWriter, r *http.Request) {
	var id pgtype.UUID
	if err := id.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid id: "+err.Error(), http.StatusBadRequest)
		return
	}
	if err := queries.DeleteUser(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func deleteEventHandler(w http.ResponseWriter, r *http.Request) {
	var id pgtype.UUID
	if err := id.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid id: "+err.Error(), http.StatusBadRequest)
		return
	}

	owner, err := queries.GetEventOwner(r.Context(), id)
	if err != nil {
		http.Error(w, "event not found", http.StatusNotFound)
		return
	}
	if !isEventManager(r, r.Context(), id, owner) {
		http.Error(w, "only the event host or a co-host can do this", http.StatusForbidden)
		return
	}

	if err := queries.DeleteEvent(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type updateEventRequest struct {
	Title           string    `json:"title"`
	Description     *string   `json:"description"`
	Latitude        float64   `json:"latitude"`
	Longitude       float64   `json:"longitude"`
	StartsAt        time.Time `json:"starts_at"`
	AccessTier      string    `json:"access_tier"`
	CapacityMax     *int32    `json:"capacity_max"`
	GroupID         *string   `json:"group_id"`
	Category        *string   `json:"category"`
	InvitePolicy    string    `json:"invite_policy"`
	Discoverability string    `json:"discoverability"`
	CoverPhotoUrl   *string   `json:"cover_photo_url"`
	AutoAccept      bool      `json:"auto_accept"`
}

func updateEventHandler(w http.ResponseWriter, r *http.Request) {
	var id pgtype.UUID
	if err := id.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid id: "+err.Error(), http.StatusBadRequest)
		return
	}

	owner, err := queries.GetEventOwner(r.Context(), id)
	if err != nil {
		http.Error(w, "event not found", http.StatusNotFound)
		return
	}
	if !isEventManager(r, r.Context(), id, owner) {
		http.Error(w, "only the event host or a co-host can do this", http.StatusForbidden)
		return
	}

	var req updateEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.InvitePolicy == "" {
		req.InvitePolicy = "host_only"
	}
	if req.Discoverability == "" {
		req.Discoverability = "public"
	}

	var capacityMax pgtype.Int4
	if req.CapacityMax != nil {
		capacityMax = pgtype.Int4{Int32: *req.CapacityMax, Valid: true}
	}

	var description pgtype.Text
	if req.Description != nil && *req.Description != "" {
		description = pgtype.Text{String: *req.Description, Valid: true}
	}

	var category pgtype.Text
	if req.Category != nil && *req.Category != "" {
		category = pgtype.Text{String: *req.Category, Valid: true}
	}

	var coverPhotoURL pgtype.Text
	if req.CoverPhotoUrl != nil && *req.CoverPhotoUrl != "" {
		coverPhotoURL = pgtype.Text{String: *req.CoverPhotoUrl, Valid: true}
	}

	// Changing which group hosts this event follows the same rule as
	// creating it under a group in the first place: the person making the
	// change must be an active member of the target group. requesterUUID
	// falls back to the owner check already done above via isEventManager,
	// but we still need *some* user id here to check group membership —
	// use whichever manager (owner or co-host) is making this request.
	var groupID pgtype.UUID
	if req.GroupID != nil && *req.GroupID != "" {
		if err := groupID.Scan(*req.GroupID); err != nil {
			http.Error(w, "invalid group_id: "+err.Error(), http.StatusBadRequest)
			return
		}
		requesterID, ok := requesterUUID(r)
		if !ok {
			http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
			return
		}
		member, err := queries.GetGroupMember(r.Context(), sqlcdb.GetGroupMemberParams{
			GroupID: groupID,
			UserID:  requesterID,
		})
		if err != nil || member.Status != "active" {
			http.Error(w, "you must be a member of this group to host an event under it", http.StatusForbidden)
			return
		}
	}

	event, err := queries.UpdateEvent(r.Context(), sqlcdb.UpdateEventParams{
		ID:              id,
		Title:           req.Title,
		Description:     description,
		Latitude:        req.Latitude,
		Longitude:       req.Longitude,
		StartsAt:        pgtype.Timestamptz{Time: req.StartsAt, Valid: true},
		AccessTier:      req.AccessTier,
		CapacityMax:     capacityMax,
		Category:        category,
		InvitePolicy:    req.InvitePolicy,
		Discoverability: req.Discoverability,
		CoverPhotoUrl:   coverPhotoURL,
		AutoAccept:      req.AutoAccept,
		GroupID:         groupID,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(event)
}

func listRSVPsHandler(w http.ResponseWriter, r *http.Request) {
	var eventID pgtype.UUID
	if err := eventID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid event id: "+err.Error(), http.StatusBadRequest)
		return
	}
	rsvps, err := queries.ListRSVPsForEvent(r.Context(), eventID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if rsvps == nil {
		rsvps = []sqlcdb.EventRsvp{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rsvps)
}
