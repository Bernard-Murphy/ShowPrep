"use client";

import { useLazyQuery } from "@apollo/client";
import { YOUTUBE_LOGIN_AUTH_URL_QUERY } from "@/lib/graphql/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";

export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register" | "forgot";
}) {
  const [fetchAuthUrl, { data, loading }] = useLazyQuery(YOUTUBE_LOGIN_AUTH_URL_QUERY);

  const handleSignInWithYouTube = () => {
    fetchAuthUrl({
      onCompleted: (d) => {
        const url = d?.youtubeLoginAuthUrl?.authUrl;
        if (url) {
          toast.success("Redirecting to YouTube sign in...");
          window.location.href = url;
        } else {
          toast.error("Unable to start YouTube sign in. Please try again.");
        }
      },
      onError: () => {
        toast.error("Unable to start YouTube sign in. Please try again.");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your YouTube/Google account to use Showprep.
          </p>
          <Button
            className="w-full"
            onClick={handleSignInWithYouTube}
            disabled={loading}
          >
            {loading ? "Redirecting…" : "Sign in with YouTube"}
          </Button>
          <p className="text-xs text-muted-foreground">
            By signing in you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
