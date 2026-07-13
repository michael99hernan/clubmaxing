package main

import (
	"encoding/json"
	"net/http"

	sqlcdb "github.com/michael99hernan/clubmax/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

type createGroupRequest struct {
	Name       string `json:"name"`
	Description string `json:"description"`
	CreatedBy  string `json:"created_by"`
	AccessTier string `json:"access_tier"`
}

func createGroupHandler(w http.ResponseWriter, r *http.Request) {
	var req createGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.AccessTier == "" {
		req.AccessTier = "open"
	}

	var createdBy pgtype.UUID
	if err := createdBy.Scan(req.CreatedBy); err != nil {
		http.Error(w, "invalid created_by: "+err.Error(), http.StatusBadRequest)
		return
	}

	group, err := queries.CreateGroup(r.Context(), sqlcdb.CreateGroupParams{
		Name:        req.Name,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
		CreatedBy:   createdBy,
		AccessTier:  req.AccessTier,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// The creator is automatically an 'owner' member of their own group —
	// otherwise you'd create a group and immediately not belong to it.
	_, err = queries.AddGroupMember(r.Context(), sqlcdb.AddGroupMemberParams{
		GroupID: group.ID,
		UserID:  createdBy,
		Role:    "owner",
		Status:  "active",
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(group)
}

func getGroupHandler(w http.ResponseWriter, r *http.Request) {
	var id pgtype.UUID
	if err := id.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid id: "+err.Error(), http.StatusBadRequest)
		return
	}
	group, err := queries.GetGroup(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(group)
}

func listGroupsHandler(w http.ResponseWriter, r *http.Request) {
	groups, err := queries.ListGroups(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if groups == nil {
		groups = []sqlcdb.Group{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

// listMyGroupsHandler: GET /groups/mine
// Groups the caller (X-User-Id) is an active member of — used by the
// sidebar to list "your" groups under the Groups section.
func listMyGroupsHandler(w http.ResponseWriter, r *http.Request) {
	var userID pgtype.UUID
	if err := userID.Scan(r.Header.Get("X-User-Id")); err != nil {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}

	groups, err := queries.ListGroupsForUser(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if groups == nil {
		groups = []sqlcdb.Group{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

// deleteGroupHandler: DELETE /groups/{id}
// Only the group's owner (created_by) can delete it. This used to have no
// check at all — a real bug, not just a gap.
func deleteGroupHandler(w http.ResponseWriter, r *http.Request) {
	var id pgtype.UUID
	if err := id.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid id: "+err.Error(), http.StatusBadRequest)
		return
	}

	owner, err := queries.GetGroupOwner(r.Context(), id)
	if err != nil {
		http.Error(w, "group not found", http.StatusNotFound)
		return
	}
	if !isOwner(r, owner) {
		http.Error(w, "only the group owner can do this", http.StatusForbidden)
		return
	}

	if err := queries.DeleteGroup(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type groupMembershipRequest struct {
	UserID string `json:"user_id"`
}

// joinGroupHandler: POST /groups/{id}/join
//   - open:    joins immediately as an active member
//   - request: joins as 'pending' unless the user already has an accepted
//     invite, in which case the invite vouches for them and they go
//     straight to active
//   - private: requires an existing invite — no invite, no entry
func joinGroupHandler(w http.ResponseWriter, r *http.Request) {
	var groupID pgtype.UUID
	if err := groupID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid group id: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req groupMembershipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var userID pgtype.UUID
	if err := userID.Scan(req.UserID); err != nil {
		http.Error(w, "invalid user_id: "+err.Error(), http.StatusBadRequest)
		return
	}

	group, err := queries.GetGroup(r.Context(), groupID)
	if err != nil {
		http.Error(w, "group not found", http.StatusNotFound)
		return
	}

	_, hasInvite := invited(r, groupID, userID)

	status := "active"
	if group.AccessTier == "private" && !hasInvite {
		http.Error(w, "this group is private — you need an invite", http.StatusForbidden)
		return
	}
	if group.AccessTier == "request" && !hasInvite {
		status = "pending"
	}

	member, err := queries.AddGroupMember(r.Context(), sqlcdb.AddGroupMemberParams{
		GroupID: groupID,
		UserID:  userID,
		Role:    "member",
		Status:  status,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(member)
}

// invited is a small helper wrapping GetGroupInvite so joinGroupHandler
// reads cleanly — returns (invite, true) if one exists.
func invited(r *http.Request, groupID, userID pgtype.UUID) (sqlcdb.GroupInvite, bool) {
	invite, err := queries.GetGroupInvite(r.Context(), sqlcdb.GetGroupInviteParams{
		GroupID: groupID,
		UserID:  userID,
	})
	return invite, err == nil
}

func leaveGroupHandler(w http.ResponseWriter, r *http.Request) {
	var groupID pgtype.UUID
	if err := groupID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid group id: "+err.Error(), http.StatusBadRequest)
		return
	}

	var req groupMembershipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var userID pgtype.UUID
	if err := userID.Scan(req.UserID); err != nil {
		http.Error(w, "invalid user_id: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := queries.RemoveGroupMember(r.Context(), sqlcdb.RemoveGroupMemberParams{
		GroupID: groupID,
		UserID:  userID,
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// isGroupManager checks whether the requester is an active owner/admin of
// the group — used to gate approving/declining pending join requests.
func isGroupManager(r *http.Request, groupID pgtype.UUID) bool {
	requester, ok := requesterUUID(r)
	if !ok {
		return false
	}
	member, err := queries.GetGroupMember(r.Context(), sqlcdb.GetGroupMemberParams{
		GroupID: groupID,
		UserID:  requester,
	})
	if err != nil || member.Status != "active" {
		return false
	}
	return member.Role == "owner" || member.Role == "admin"
}

// approveGroupMemberHandler: POST /groups/{id}/members/{userId}/approve
func approveGroupMemberHandler(w http.ResponseWriter, r *http.Request) {
	var groupID pgtype.UUID
	if err := groupID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid group id: "+err.Error(), http.StatusBadRequest)
		return
	}
	if !isGroupManager(r, groupID) {
		http.Error(w, "only a group owner/admin can do this", http.StatusForbidden)
		return
	}
	var userID pgtype.UUID
	if err := userID.Scan(r.PathValue("userId")); err != nil {
		http.Error(w, "invalid user id: "+err.Error(), http.StatusBadRequest)
		return
	}

	member, err := queries.UpdateGroupMemberStatus(r.Context(), sqlcdb.UpdateGroupMemberStatusParams{
		GroupID: groupID,
		UserID:  userID,
		Status:  "active",
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(member)
}

// declineGroupMemberHandler: POST /groups/{id}/members/{userId}/decline
// Declining a pending request just removes the row — they can request again
// later, unlike an event RSVP decline.
func declineGroupMemberHandler(w http.ResponseWriter, r *http.Request) {
	var groupID pgtype.UUID
	if err := groupID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid group id: "+err.Error(), http.StatusBadRequest)
		return
	}
	if !isGroupManager(r, groupID) {
		http.Error(w, "only a group owner/admin can do this", http.StatusForbidden)
		return
	}
	var userID pgtype.UUID
	if err := userID.Scan(r.PathValue("userId")); err != nil {
		http.Error(w, "invalid user id: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := queries.RemoveGroupMember(r.Context(), sqlcdb.RemoveGroupMemberParams{
		GroupID: groupID,
		UserID:  userID,
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func listPendingGroupMembersHandler(w http.ResponseWriter, r *http.Request) {
	var groupID pgtype.UUID
	if err := groupID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid group id: "+err.Error(), http.StatusBadRequest)
		return
	}
	if !isGroupManager(r, groupID) {
		http.Error(w, "only a group owner/admin can do this", http.StatusForbidden)
		return
	}
	pending, err := queries.ListPendingGroupMembers(r.Context(), groupID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if pending == nil {
		pending = []sqlcdb.GroupMember{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pending)
}

func listGroupEventsHandler(w http.ResponseWriter, r *http.Request) {
	var groupID pgtype.UUID
	if err := groupID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid group id: "+err.Error(), http.StatusBadRequest)
		return
	}
	events, err := queries.ListEventsForGroup(r.Context(), groupID)
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

func listGroupMembersHandler(w http.ResponseWriter, r *http.Request) {
	var groupID pgtype.UUID
	if err := groupID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid group id: "+err.Error(), http.StatusBadRequest)
		return
	}
	members, err := queries.ListGroupMembers(r.Context(), groupID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if members == nil {
		members = []sqlcdb.GroupMember{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}

// createGroupInviteHandler: POST /groups/{id}/invites
// Any active member can invite someone else to the group — mirrors the
// "attendees" event invite policy; groups don't have a separate host-only
// toggle since there's no per-group invite_policy field (owners/admins can
// always invite too, being active members themselves).
func createGroupInviteHandler(w http.ResponseWriter, r *http.Request) {
	var groupID pgtype.UUID
	if err := groupID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid group id: "+err.Error(), http.StatusBadRequest)
		return
	}

	invitedBy, ok := requesterUUID(r)
	if !ok {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}

	member, err := queries.GetGroupMember(r.Context(), sqlcdb.GetGroupMemberParams{
		GroupID: groupID,
		UserID:  invitedBy,
	})
	if err != nil || member.Status != "active" {
		http.Error(w, "only an active group member can invite others", http.StatusForbidden)
		return
	}

	var req groupMembershipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var userID pgtype.UUID
	if err := userID.Scan(req.UserID); err != nil {
		http.Error(w, "invalid user_id: "+err.Error(), http.StatusBadRequest)
		return
	}

	invite, err := queries.CreateGroupInvite(r.Context(), sqlcdb.CreateGroupInviteParams{
		GroupID:   groupID,
		UserID:    userID,
		InvitedBy: invitedBy,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(invite)
}

func listGroupInvitesHandler(w http.ResponseWriter, r *http.Request) {
	var groupID pgtype.UUID
	if err := groupID.Scan(r.PathValue("id")); err != nil {
		http.Error(w, "invalid group id: "+err.Error(), http.StatusBadRequest)
		return
	}
	invites, err := queries.ListGroupInvites(r.Context(), groupID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if invites == nil {
		invites = []sqlcdb.GroupInvite{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invites)
}

// listMyGroupInvitesHandler: GET /groups/invites/mine
// All group invites for the caller (X-User-Id), across every group —
// used by the notifications panel to show "invited to a group" alerts.
func listMyGroupInvitesHandler(w http.ResponseWriter, r *http.Request) {
	var userID pgtype.UUID
	if err := userID.Scan(r.Header.Get("X-User-Id")); err != nil {
		http.Error(w, "missing or invalid X-User-Id header", http.StatusUnauthorized)
		return
	}
	invites, err := queries.ListGroupInvitesForUser(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if invites == nil {
		invites = []sqlcdb.ListGroupInvitesForUserRow{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invites)
}
