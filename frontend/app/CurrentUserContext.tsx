"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
};

type CurrentUserContextType = {
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;
  // true until we've checked localStorage once — avoids briefly flashing
  // a "log in" state before we've had a chance to read the stored value.
  loading: boolean;
};

const CurrentUserContext = createContext<CurrentUserContextType | undefined>(
  undefined
);

const STORAGE_KEY = "clubmax_current_user";

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Runs once on mount, in the browser only — localStorage doesn't exist
  // during server-side rendering, which is why this has to live inside
  // useEffect rather than directly in the component body.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setCurrentUserState(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  function setCurrentUser(user: CurrentUser | null) {
    setCurrentUserState(user);
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <CurrentUserContext.Provider value={{ currentUser, setCurrentUser, loading }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  }
  return ctx;
}
