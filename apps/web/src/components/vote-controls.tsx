"use client";

import { useMutation, useQuery } from "@apollo/client";
import { Button } from "@/components/ui/button";
import { USER_VOTE_QUERY, VOTE_MUTATION } from "@/lib/graphql/engagement";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";

export function VoteControls({
  targetType,
  targetId,
  karma,
}: {
  targetType: "ARTICLE" | "GENCAST" | "COMMENT";
  targetId: string;
  karma: number;
}) {
  const { user, showAuthDialog } = useAuth();
  const { data, refetch } = useQuery(USER_VOTE_QUERY, {
    variables: { targetType, targetId },
    skip: !targetId,
  });
  const [vote, { loading }] = useMutation(VOTE_MUTATION);

  const myVote = typeof data?.userVote === "number" ? data.userVote : 0;
  const displayKarma = karma;

  const submit = async (value: 1 | -1) => {
    if (!user) {
      showAuthDialog();
      return;
    }
    const nextValue = myVote === value ? 0 : value;
    try {
      await vote({ variables: { targetType, targetId, value: nextValue } });
      await refetch();
    } catch {
      toast.error("Failed to submit vote.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={myVote === 1 ? "default" : "outline"}
        onClick={() => submit(1)}
        disabled={loading}
      >
        ▲
      </Button>
      <span className="text-sm text-muted-foreground min-w-10 text-center">
        {displayKarma}
      </span>
      <Button
        size="sm"
        variant={myVote === -1 ? "default" : "outline"}
        onClick={() => submit(-1)}
        disabled={loading}
      >
        ▼
      </Button>
    </div>
  );
}
