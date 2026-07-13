import Link from "next/link";

type Group = {
  id: string;
  name: string;
  description: string | { String: string; Valid: boolean };
  access_tier?: string;
};

function formatDescription(desc: Group["description"]): string {
  if (typeof desc === "string") return desc;
  if (desc && typeof desc === "object") return desc.Valid ? desc.String : "";
  return "";
}

async function getGroups(): Promise<Group[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch groups: ${res.status}`);
  return res.json();
}

const GROUP_GRADIENTS = [
  "linear-gradient(135deg,#7c3aed,#db2777)",
  "linear-gradient(135deg,#f97316,#db2777)",
  "linear-gradient(135deg,#0ea5e9,#7c3aed)",
  "linear-gradient(135deg,#16a34a,#0ea5e9)",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GROUP_GRADIENTS[hash % GROUP_GRADIENTS.length];
}

export default async function GroupsPage() {
  const groups = await getGroups();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Groups</h1>
          <p className="text-neutral-500 text-sm mt-1">Find your crew, or start one.</p>
        </div>
        <Link href="/groups/new" className="btn-gradient text-sm px-4 py-2 shadow-sm">
          + New Group
        </Link>
      </div>

      {groups.length === 0 && (
        <p className="text-neutral-500">No groups yet — create the first one.</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Link
            key={group.id}
            href={`/groups/${group.id}`}
            className="card-hover group block rounded-2xl bg-white border border-neutral-200/80 shadow-sm overflow-hidden"
          >
            <div
              className="relative h-20 w-full flex items-end p-3"
              style={{ backgroundImage: gradientFor(group.id) }}
            >
              {group.access_tier && (
                <span className="text-[10px] font-medium uppercase tracking-wide text-white bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-1">
                  {group.access_tier}
                </span>
              )}
            </div>
            <div className="p-4">
              <h2 className="font-medium group-hover:text-neutral-950">{group.name}</h2>
              {formatDescription(group.description) && (
                <p className="text-sm text-neutral-500 mt-1 line-clamp-2">
                  {formatDescription(group.description)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
