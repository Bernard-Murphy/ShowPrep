"use client";

import { useState, useCallback } from "react";
import { ApolloProvider } from "@apollo/client";
import { Toaster } from "sonner";
import { apolloClient } from "@/lib/apollo-client";
import { AuthProvider } from "@/components/auth-provider";
import { AuthDialog } from "@/components/auth-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  const [authOpen, setAuthOpen] = useState(false);
  const openAuth = useCallback((_tab?: "login" | "register" | "forgot") => {
    setAuthOpen(true);
  }, []);

  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider onOpenAuthDialog={openAuth}>
        {children}
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </AuthProvider>
      <Toaster />
    </ApolloProvider>
  );
}
