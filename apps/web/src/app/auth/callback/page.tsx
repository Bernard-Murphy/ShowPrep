"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { setStoredToken } from "@/lib/auth-storage";
import { toast } from "sonner";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");
    if (error) {
      toast.error("Sign in failed. Please try again.");
      router.replace("/");
      return;
    }
    if (token) {
      setStoredToken(token);
      document.cookie = `showprep_token=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      window.dispatchEvent(new Event("showprep-auth-changed"));
      toast.success("Signed in successfully.");
      router.replace("/dashboard?section=youtube");
    } else {
      toast.error("Sign in failed. Please try again.");
      router.replace("/");
    }
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
