"use client";

import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { Input } from "@/components/ui/input";
import {
  SYNC_YOUTUBE_SUBSCRIPTIONS_MUTATION,
  UNLINK_YOUTUBE_MUTATION,
  YOUTUBE_AUTH_URL_QUERY,
  YOUTUBE_SUBSCRIPTIONS_QUERY,
  SET_YOUTUBE_SELECTION_MUTATION,
} from "@/lib/graphql/youtube";
import { useEffect, useState } from "react";
import {
  CREATE_CUSTOM_VOICE_MUTATION,
  DELETE_VOICE_MUTATION,
  VOICES_QUERY,
} from "@/lib/graphql/voices";

export default function SettingsPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const { data, loading, refetch } = useQuery(YOUTUBE_SUBSCRIPTIONS_QUERY, {
    skip: !user,
  });
  const [fetchAuthUrl, { loading: linking }] = useLazyQuery(YOUTUBE_AUTH_URL_QUERY);
  const [syncSubscriptions, { loading: syncing }] = useMutation(
    SYNC_YOUTUBE_SUBSCRIPTIONS_MUTATION,
  );
  const [unlinkYouTube, { loading: unlinking }] = useMutation(
    UNLINK_YOUTUBE_MUTATION,
  );
  const [setSelection, { loading: saving }] = useMutation(
    SET_YOUTUBE_SELECTION_MUTATION,
  );
  const { data: voicesData, refetch: refetchVoices } = useQuery(VOICES_QUERY, {
    variables: { userId: user?.id },
    skip: !user,
  });
  const [deleteVoice, { loading: deletingVoice }] = useMutation(
    DELETE_VOICE_MUTATION,
  );
  const [createCustomVoice, { loading: creatingVoice }] = useMutation(
    CREATE_CUSTOM_VOICE_MUTATION,
  );
  const [voiceName, setVoiceName] = useState("");
  const [voiceFile, setVoiceFile] = useState<File | null>(null);

  useEffect(() => {
    const subscriptions = data?.youtubeSubscriptions ?? [];
    setSelected(
      subscriptions
        .filter((subscription: { active: boolean }) => subscription.active)
        .map((subscription: { channelId: string }) => subscription.channelId),
    );
  }, [data?.youtubeSubscriptions]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Sign in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Logged in as {user.displayName || "User"}</p>
          <div>
            <h3 className="font-medium mb-2">YouTube</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Link your YouTube account, sync subscriptions, and choose channels to harvest.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <Button
                variant="outline"
                size="sm"
                disabled={linking}
                onClick={() =>
                  fetchAuthUrl().then((response) => {
                    const authUrl = response.data?.youtubeAuthUrl?.authUrl;
                    if (authUrl) window.location.href = authUrl;
                  })
                }
              >
                {linking ? "Redirecting..." : "Link YouTube"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={syncing}
                onClick={async () => {
                  await syncSubscriptions();
                  await refetch();
                }}
              >
                {syncing ? "Syncing..." : "Sync subscriptions"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={unlinking}
                onClick={async () => {
                  await unlinkYouTube();
                  await refetch();
                }}
              >
                {unlinking ? "Unlinking..." : "Unlink YouTube"}
              </Button>
            </div>
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading subscriptions...</p>
            ) : (
              <div className="space-y-2">
                {(data?.youtubeSubscriptions ?? []).map(
                  (subscription: {
                    id: string;
                    channelId: string;
                    channelTitle: string;
                  }) => (
                    <label
                      key={subscription.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(subscription.channelId)}
                        onChange={() =>
                          setSelected((previous) =>
                            previous.includes(subscription.channelId)
                              ? previous.filter((id) => id !== subscription.channelId)
                              : [...previous, subscription.channelId],
                          )
                        }
                      />
                      {subscription.channelTitle}
                    </label>
                  ),
                )}
                {(data?.youtubeSubscriptions ?? []).length > 0 && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await setSelection({ variables: { channelIds: selected } });
                      await refetch();
                    }}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save selected channels"}
                  </Button>
                )}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-medium mb-2">Voices</h3>
            <p className="text-sm text-muted-foreground">
              Manage default and custom voices for gencasts.
            </p>
            <div className="space-y-2 mt-3">
              <Input
                placeholder="Custom voice name"
                value={voiceName}
                onChange={(event) => setVoiceName(event.target.value)}
              />
              <Input
                type="file"
                accept="audio/*"
                onChange={(event) =>
                  setVoiceFile(event.target.files?.[0] ?? null)
                }
              />
              <Button
                size="sm"
                disabled={!voiceFile || !voiceName.trim() || creatingVoice}
                onClick={async () => {
                  if (!voiceFile || !voiceName.trim()) return;
                  const bytes = await voiceFile.arrayBuffer();
                  const binary = new Uint8Array(bytes);
                  let str = "";
                  binary.forEach((value) => {
                    str += String.fromCharCode(value);
                  });
                  const sampleAudioBase64 = btoa(str);
                  await createCustomVoice({
                    variables: {
                      name: voiceName.trim(),
                      sampleAudioBase64,
                    },
                  });
                  setVoiceName("");
                  setVoiceFile(null);
                  await refetchVoices();
                }}
              >
                {creatingVoice ? "Creating..." : "Create custom voice"}
              </Button>
              <div className="space-y-1">
                {(voicesData?.voices ?? []).map(
                  (voice: {
                    id: string;
                    name: string;
                    provider: string;
                    userId?: string | null;
                    isDefault: boolean;
                  }) => (
                    <div
                      key={voice.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>
                        {voice.name} ({voice.provider}
                        {voice.isDefault ? ", default" : ""})
                      </span>
                      {voice.userId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingVoice}
                          onClick={async () => {
                            await deleteVoice({ variables: { id: voice.id } });
                            await refetchVoices();
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
