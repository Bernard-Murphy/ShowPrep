"use client";

import React, { createContext, useCallback, useContext, useState, useEffect } from "react";
import { useLazyQuery } from "@apollo/client";
import { ME_QUERY } from "@/lib/graphql/auth";
import { getStoredToken, setStoredToken } from "@/lib/auth-storage";
import { toast } from "sonner";

export type User = {
  id: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  _count?: { articles: number; gencasts: number; subscribers: number } | null;
};

type AuthContextType = {
  user: User | null;
  setUser: (u: User | null) => void;
  showAuthDialog: (tab?: "login" | "register" | "forgot") => void;
  refetchUser: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export { getStoredToken, setStoredToken };

export function AuthProvider({
  children,
  onOpenAuthDialog,
}: {
  children: React.ReactNode;
  onOpenAuthDialog?: (tab?: "login" | "register" | "forgot") => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [fetchMe, { data, error, loading }] = useLazyQuery(ME_QUERY, {
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    const syncToken = () => setToken(getStoredToken());
    syncToken();
    window.addEventListener("storage", syncToken);
    window.addEventListener("showprep-auth-changed", syncToken);
    return () => {
      window.removeEventListener("storage", syncToken);
      window.removeEventListener("showprep-auth-changed", syncToken);
    };
  }, []);

  React.useEffect(() => {
    if (error) {
      setUser(null);
      if (getStoredToken()) {
        toast.error("Your session expired. Please sign in again.");
      }
      setStoredToken(null);
      window.dispatchEvent(new Event("showprep-auth-changed"));
    } else if (data !== undefined) {
      setUser(data?.me ?? null);
    }
  }, [data, error]);

  const refetchUser = useCallback(() => {
    if (getStoredToken()) fetchMe();
    else setUser(null);
  }, [fetchMe]);

  useEffect(() => {
    if (token) {
      document.cookie = `showprep_token=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      fetchMe();
    } else {
      document.cookie = "showprep_token=; Path=/; Max-Age=0; SameSite=Lax";
      setUser(null);
    }
  }, [token, fetchMe]);

  const showAuthDialog = useCallback(
    (tab?: "login" | "register" | "forgot") => {
      onOpenAuthDialog?.(tab ?? "login");
    },
    [onOpenAuthDialog]
  );

  const value: AuthContextType = {
    user,
    setUser,
    showAuthDialog,
    refetchUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
