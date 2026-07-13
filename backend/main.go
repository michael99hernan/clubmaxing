package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	connectDB()
	defer pool.Close()

	mux := http.NewServeMux()

	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("POST /events", createEventHandler)
	mux.HandleFunc("POST /users", createUserHandler)
	mux.HandleFunc("GET /events", listEventsHandler)
	mux.HandleFunc("GET /events/mine", listMyEventsHandler)
	mux.HandleFunc("GET /events/invited", listInvitedEventsHandler)
	mux.HandleFunc("GET /events/going", listGoingEventsHandler)
	mux.HandleFunc("GET /users", listUsersHandler)
	mux.HandleFunc("GET /events/{id}", getEventHandler)
	mux.HandleFunc("GET /users/{id}", getUserHandler)
	mux.HandleFunc("DELETE /events/{id}", deleteEventHandler)
	mux.HandleFunc("PATCH /events/{id}", updateEventHandler)
	mux.HandleFunc("DELETE /users/{id}", deleteUserHandler)
	mux.HandleFunc("GET /users/lookup/email", getUserByEmailHandler)
	mux.HandleFunc("GET /users/lookup/name", getUserByNameHandler)
	mux.HandleFunc("POST /events/{id}/join", joinEventHandler)
	mux.HandleFunc("POST /events/{id}/leave", leaveEventHandler)
	mux.HandleFunc("POST /events/{id}/maybe", setMaybeHandler)
	mux.HandleFunc("GET /events/{id}/rsvps", listRSVPsHandler)
	mux.HandleFunc("POST /events/{id}/rsvps/{userId}/approve", approveRSVPHandler)
	mux.HandleFunc("POST /events/{id}/rsvps/{userId}/decline", declineRSVPHandler)

	mux.HandleFunc("POST /groups", createGroupHandler)
	mux.HandleFunc("GET /groups", listGroupsHandler)
	mux.HandleFunc("GET /groups/mine", listMyGroupsHandler)
	mux.HandleFunc("GET /groups/{id}", getGroupHandler)
	mux.HandleFunc("DELETE /groups/{id}", deleteGroupHandler)
	mux.HandleFunc("POST /groups/{id}/join", joinGroupHandler)
	mux.HandleFunc("POST /groups/{id}/leave", leaveGroupHandler)
	mux.HandleFunc("GET /groups/{id}/members", listGroupMembersHandler)
	mux.HandleFunc("GET /groups/{id}/members/pending", listPendingGroupMembersHandler)
	mux.HandleFunc("POST /groups/{id}/members/{userId}/approve", approveGroupMemberHandler)
	mux.HandleFunc("POST /groups/{id}/members/{userId}/decline", declineGroupMemberHandler)
	mux.HandleFunc("GET /groups/{id}/events", listGroupEventsHandler)
	mux.HandleFunc("POST /groups/{id}/invites", createGroupInviteHandler)
	mux.HandleFunc("GET /groups/{id}/invites", listGroupInvitesHandler)

	mux.HandleFunc("POST /friends/requests", sendFriendRequestHandler)
	mux.HandleFunc("POST /friends/requests/respond", respondFriendRequestHandler)
	mux.HandleFunc("GET /friends/requests", listPendingFriendRequestsHandler)
	mux.HandleFunc("GET /friends/requests/sent", listSentFriendRequestsHandler)
	mux.HandleFunc("GET /friends", listFriendsHandler)
	mux.HandleFunc("DELETE /friends/{userId}", removeFriendHandler)

	mux.HandleFunc("POST /events/{id}/invites", createInviteHandler)
	mux.HandleFunc("GET /events/{id}/invites", listEventInvitesHandler)

	mux.HandleFunc("POST /events/{id}/hosts", addEventHostHandler)
	mux.HandleFunc("GET /events/{id}/hosts", listEventHostsHandler)
	mux.HandleFunc("DELETE /events/{id}/hosts/{userId}", removeEventHostHandler)

	fmt.Println("Server starting on :8080")
	err := http.ListenAndServe(":8080", withCORS(mux))
	if err != nil {
		log.Fatal(err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "ok")
}

// withCORS wraps every route with the headers browsers require before
// they'll let JavaScript running on one origin (localhost:3000) read a
// response from a different origin (localhost:8080). Without this, the
// browser blocks the response before your Next.js code ever sees it —
// the server would actually run the request, but the browser throws
// the response away.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Id")

		// Browsers send a "preflight" OPTIONS request before certain real
		// requests (e.g. any POST with a JSON body), just to check whether
		// CORS allows it, before sending the actual request. We respond
		// immediately with just the headers above and no body.
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
