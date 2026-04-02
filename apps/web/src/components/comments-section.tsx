"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  COMMENTS_QUERY,
  CREATE_COMMENT_MUTATION,
} from "@/lib/graphql/engagement";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";

type TargetType = "ARTICLE" | "GENCAST" | "USER_PROFILE";

export function CommentsSection({
  targetType,
  targetId,
  profileUserId,
}: {
  targetType: TargetType;
  targetId: string;
  profileUserId?: string;
}) {
  const { user, showAuthDialog } = useAuth();
  const [text, setText] = useState("");
  const { data, loading, refetch } = useQuery(COMMENTS_QUERY, {
    variables: { targetType, targetId, profileUserId },
    skip: !targetId,
  });
  const [createComment, { loading: creating }] = useMutation(
    CREATE_COMMENT_MUTATION,
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) return;
    if (!user) {
      showAuthDialog();
      return;
    }
    try {
      await createComment({
        variables: {
          targetType,
          targetId,
          profileUserId,
          text: text.trim(),
        },
      });
      setText("");
      await refetch();
    } catch {
      toast.error("Failed to post comment.");
    }
  };

  const comments = data?.comments ?? [];

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-semibold">Comments</h2>
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write a comment..."
          maxLength={1000}
        />
        <Button type="submit" disabled={creating}>
          {creating ? "Posting..." : "Post"}
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map(
            (comment: {
              id: string;
              text: string;
              karma: number;
              createdAt: string;
              user?: { displayName?: string | null } | null;
            }) => (
              <div key={comment.id} className="rounded-md border p-3">
                <p className="text-sm whitespace-pre-wrap">{comment.text}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {comment.user?.displayName || "Anonymous"} · {comment.karma} karma
                </p>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
