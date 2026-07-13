import GroupDetail from "./GroupDetail";

export type Group = {
  id: string;
  name: string;
  description: string | { String: string; Valid: boolean };
  access_tier: string;
  created_by?: unknown;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string;
};

export type Event = {
  id: string;
  title: string;
  starts_at: string;
  access_tier: string;
  category?: string | { String: string; Valid: boolean } | null;
  cover_photo_url?: string | { String: string; Valid: boolean } | null;
  capacity_max: number | { Int32: number; Valid: boolean } | null;
};

export type User = {
  id: string;
  name: string;
  email: string;
};

async function getGroup(id: string): Promise<Group> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch group: ${res.status}`);
  return res.json();
}

async function getMembers(id: string): Promise<GroupMember[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups/${id}/members`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch members: ${res.status}`);
  return res.json();
}

async function getGroupEvents(id: string): Promise<Event[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups/${id}/events`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch group events: ${res.status}`);
  return res.json();
}

async function getUsers(): Promise<User[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  return res.json();
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group, members, events, users] = await Promise.all([
    getGroup(id),
    getMembers(id),
    getGroupEvents(id),
    getUsers(),
  ]);

  return <GroupDetail group={group} members={members} events={events} users={users} />;
}
