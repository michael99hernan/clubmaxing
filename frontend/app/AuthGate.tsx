"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "./CurrentUserContext";

// There's no real auth here — just "pick a user from a list" (see
// login/UserPicker.tsx). This gate just makes that mandatory: anyone who
// hasn't picked a user gets sent to /login, instead of being able to
// browse the app as an anonymous visitor. /login itself is always exempt,
// otherwise nobody could ever reach it.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!currentUser && pathname !== "/login") {
      router.replace("/login");
    }
  }, [loading, currentUser, pathname, router]);

  // While we're still checking localStorage, or about to redirect a
  // logged-out visitor, render nothing rather than flashing real content.
  if (loading) return null;
  if (!currentUser && pathname !== "/login") return null;

  return <>{children}</>;
}
