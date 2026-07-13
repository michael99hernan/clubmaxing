import UserPicker from "./UserPicker";

type User = {
  id: string;
  name: string;
  email: string;
};

async function getUsers(): Promise<User[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  return res.json();
}

export default async function LoginPage() {
  const users = await getUsers();

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight mb-2">
        Who&rsquo;s <span className="gradient-text">joining</span>?
      </h1>
      <p className="text-sm text-neutral-500 mb-8">
        No real accounts yet — pick a user to act as for this session.
      </p>
      <div className="text-left">
        <UserPicker users={users} />
      </div>
    </div>
  );
}
