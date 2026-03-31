"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  YOUTUBE_SUBSCRIPTIONS_QUERY,
  SYNC_YOUTUBE_SUBSCRIPTIONS_MUTATION,
  SET_YOUTUBE_SELECTION_MUTATION,
} from "@/lib/graphql/youtube";
import { START_HARVEST_MUTATION } from "@/lib/graphql/processing";
import { HarvestProgressStream } from "@/components/harvest-progress-stream";

type SubscriptionItem = {
  id: string;
  channelId: string;
  channelTitle: string;
  channelThumbnailUrl?: string | null;
  active: boolean;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery(YOUTUBE_SUBSCRIPTIONS_QUERY, {
    skip: !user,
    fetchPolicy: "network-only",
  });
  const [syncSubscriptions, { loading: syncing }] = useMutation(
    SYNC_YOUTUBE_SUBSCRIPTIONS_MUTATION,
  );
  const [saveSelection, { loading: saving }] = useMutation(
    SET_YOUTUBE_SELECTION_MUTATION,
  );
  const [startHarvest, { loading: starting }] = useMutation(START_HARVEST_MUTATION);

  const subscriptions: SubscriptionItem[] = data?.youtubeSubscriptions ?? [];

  useEffect(() => {
    setSelected(
      subscriptions
        .filter((subscription) => subscription.active)
        .map((subscription) => subscription.channelId),
    );
  }, [data?.youtubeSubscriptions]);

  const selectedCount = useMemo(() => selected.length, [selected.length]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Please sign in first.</p>
      </div>
    );
  }

  const toggleSelection = (channelId: string) => {
    setSelected((previous) =>
      previous.includes(channelId)
        ? previous.filter((id) => id !== channelId)
        : [...previous, channelId],
    );
  };

  const handleSync = async () => {
    await syncSubscriptions();
    await refetch();
  };

  const handleSaveAndHarvest = async () => {
    await saveSelection({ variables: { channelIds: selected } });
    const response = await startHarvest({ variables: { type: "INITIAL" } });
    const id = response.data?.startHarvest?.id as string | undefined;
    if (id) setJobId(id);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Choose channels to harvest</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Select the subscriptions you want ShowPrep to ingest.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="outline" onClick={handleSync} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync subscriptions"}
        </Button>
        <Button
          onClick={handleSaveAndHarvest}
          disabled={saving || starting || selectedCount === 0}
        >
          {starting ? "Starting..." : "Save selection and start harvest"}
        </Button>
        <Button variant="ghost" onClick={() => router.push("/feed")}>
          Skip for now
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Selected channels: {selectedCount}
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading subscriptions...</p>
      ) : subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No subscriptions found yet. Click "Sync subscriptions" to fetch them.
        </p>
      ) : (
        <div className="space-y-2">
          {subscriptions.map((subscription) => (
            <label
              key={subscription.id}
              className="flex items-center gap-3 rounded-md border p-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(subscription.channelId)}
                onChange={() => toggleSelection(subscription.channelId)}
              />
              {subscription.channelThumbnailUrl ? (
                <img
                  src={subscription.channelThumbnailUrl}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted" />
              )}
              <span className="text-sm">{subscription.channelTitle}</span>
            </label>
          ))}
        </div>
      )}

      <HarvestProgressStream jobId={jobId} />
    </div>
  );
}
