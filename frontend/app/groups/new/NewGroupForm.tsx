"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../CurrentUserContext";

export default function NewGroupForm() {
  const router = useRouter();
  const { currentUser, loading } = useCurrentUser();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accessTier, setAccessTier] = useState("open");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          created_by: currentUser.id,
          access_tier: accessTier,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }

      const group = await res.json();
      router.push(`/groups/${group.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  if (!currentUser) {
    return (
      <p className="text-sm text-neutral-500">
        You need to{" "}
        <a href="/login" className="underline">
          log in
        </a>{" "}
        first.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          placeholder="Sunday Soccer Crew"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Description <span className="text-neutral-400">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Access</label>
        <select
          value={accessTier}
          onChange={(e) => setAccessTier(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="open">Open — anyone can join instantly</option>
          <option value="request">Request to join — owner/admin must approve</option>
          <option value="private">Private — invite only</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="btn-gradient py-2.5 text-sm disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create Group"}
      </button>
    </form>
  );
}
