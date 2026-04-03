"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { setStoredToken } from "@/lib/auth-storage";
import { toast } from "sonner";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    const readParams = () => {
      const fromWindow =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      return {
        token: searchParams.get("token") ?? fromWindow?.get("token") ?? null,
        error: searchParams.get("error") ?? fromWindow?.get("error") ?? null,
      };
    };

    const completeSignIn = (token: string) => {
      handledRef.current = true;
      setStoredToken(token);
      window.dispatchEvent(new Event("showprep-auth-changed"));
      toast.success("Signed in successfully.");
      router.replace("/dashboard?section=youtube");
    };

    const failSignIn = () => {
      handledRef.current = true;
      toast.error("Sign in failed. Please try again.");
      router.replace("/");
    };

    const { token, error } = readParams();

    if (error) {
      failSignIn();
      return;
    }

    if (token) {
      completeSignIn(token);
      return;
    }

    const id = window.setTimeout(() => {
      if (handledRef.current) return;
      const { token: tokenRetry, error: errorRetry } = readParams();
      if (errorRetry) {
        failSignIn();
        return;
      }
      if (tokenRetry) {
        completeSignIn(tokenRetry);
        return;
      }
      failSignIn();
    }, 0);

    return () => clearTimeout(id);
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Signing you in…</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
