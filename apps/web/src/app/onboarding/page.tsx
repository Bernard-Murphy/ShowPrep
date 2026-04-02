"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard?section=youtube");
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-8">
      <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
    </div>
  );
}
