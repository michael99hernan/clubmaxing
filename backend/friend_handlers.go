package main

import (
	"encoding/json"
	"net/http"

	sqlcdb "github.com/michael99hernan/clubmax/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

type friendRequestBody struct {
	AddresseeID string `json:"addressee_id"`
}

// sendFriendRequestHandler: POST /friends/requests
// The requester is whoever's in X-User-Id — same lightweight, spoofable
// "identity" convention as event ownership checks elsewhere in this app.
func sendFriendRequestHandler(w http.ResponseWriter, r *http.Request) {
	var requesterID pgtype.UUID
	if err := requesterID.Scan(r.Header.Get("X-User-Id")); err != nil {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}

	var req friendRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var addresseeID pgtype.UUID
	if err := addresseeID.Scan(req.AddresseeID); err != nil {
		http.Error(w, "invalid addressee_id: "+err.Error(), http.StatusBadRequest)
		return
	}

	friendship, err := queries.SendFriendRequest(r.Context(), sqlcdb.SendFriendRequestParams{
		RequesterID: requesterID,
		AddresseeID: addresseeID,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(friendship)
}

type respondFriendRequestBody struct {
	RequesterID string `json:"requester_id"`
	Accept      bool   `json:"accept"`
}

// respondFriendRequestHandler: POST /friends/requests/respond
// Only the addressee (whoever received the request) should be able to
// accept/decline — X-User-Id must match the addressee side, not the requester.
func respondFriendRequestHandler(w http.ResponseWriter, r *http.Request) {
	var addresseeID pgtype.UUID
	if err := addresseeID.Scan(r.Header.Get("X-User-Id")); err != nil {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}

	var req respondFriendRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var requesterID pgtype.UUID
	if err := requesterID.Scan(req.RequesterID); err != nil {
		http.Error(w, "invalid requester_id: "+err.Error(), http.StatusBadRequest)
		return
	}

	status := "declined"
	if req.Accept {
		status = "accepted"
	}

	friendship, err := queries.RespondToFriendRequest(r.Context(), sqlcdb.RespondToFriendRequestParams{
		RequesterID: requesterID,
		AddresseeID: addresseeID,
		Status:      status,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(friendship)
}

// removeFriendHandler: DELETE /friends/{userId}
// Removes the friendship between the caller (X-User-Id) and {userId},
// regardless of who originally sent the request.
func removeFriendHandler(w http.ResponseWriter, r *http.Request) {
	var meID pgtype.UUID
	if err := meID.Scan(r.Header.Get("X-User-Id")); err != nil {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}
	var otherID pgtype.UUID
	if err := otherID.Scan(r.PathValue("userId")); err != nil {
		http.Error(w, "invalid user id: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := queries.RemoveFriendship(r.Context(), sqlcdb.RemoveFriendshipParams{
		RequesterID: meID,
		AddresseeID: otherID,
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listFriendsHandler: GET /friends  (X-User-Id identifies whose list this is)
func listFriendsHandler(w http.ResponseWriter, r *http.Request) {
	var userID pgtype.UUID
	if err := userID.Scan(r.Header.Get("X-User-Id")); err != nil {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}

	friends, err := queries.ListFriends(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if friends == nil {
		friends = []sqlcdb.User{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(friends)
}

// listPendingFriendRequestsHandler: GET /friends/requests
func listPendingFriendRequestsHandler(w http.ResponseWriter, r *http.Request) {
	var userID pgtype.UUID
	if err := userID.Scan(r.Header.Get("X-User-Id")); err != nil {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}

	requests, err := queries.ListPendingFriendRequests(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if requests == nil {
		requests = []sqlcdb.ListPendingFriendRequestsRow{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}

// listSentFriendRequestsHandler: GET /friends/requests/sent
// Requests this user sent that haven't been accepted/declined yet — used
// by the Users page to show "Request sent" instead of "Add friend".
func listSentFriendRequestsHandler(w http.ResponseWriter, r *http.Request) {
	var userID pgtype.UUID
	if err := userID.Scan(r.Header.Get("X-User-Id")); err != nil {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}

	requests, err := queries.ListSentFriendRequests(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if requests == nil {
		requests = []sqlcdb.ListSentFriendRequestsRow{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}
