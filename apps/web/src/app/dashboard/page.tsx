"use client";

import { Suspense, useMemo, useEffect, useRef, useState } from "react";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  SYNC_YOUTUBE_SUBSCRIPTIONS_MUTATION,
  UNLINK_YOUTUBE_MUTATION,
  YOUTUBE_AUTH_URL_QUERY,
  YOUTUBE_SUBSCRIPTIONS_QUERY,
  SET_YOUTUBE_SELECTION_MUTATION,
} from "@/lib/graphql/youtube";
import {
  CREATE_CUSTOM_VOICE_MUTATION,
  DELETE_VOICE_MUTATION,
  VOICES_QUERY,
} from "@/lib/graphql/voices";
import { USER_ARTICLES_QUERY, USER_GENCASTS_QUERY } from "@/lib/graphql/content";
import {
  HARVEST_ELIGIBILITY_QUERY,
  START_HARVEST_MUTATION,
} from "@/lib/graphql/processing";
import { ArticleCard } from "@/components/article-card";
import { GencastCard } from "@/components/gencast-card";
import { ProfileContent } from "@/components/profile-content";
import { toast } from "sonner";
import BouncyClick from "@/components/ui/bouncy-click";
import { FileText, Radio, UserRound } from "lucide-react";

const MAX_SELECTED_CHANNELS = 40;
type DashboardSection = "profile" | "youtube" | "content";

type SortOption = "recentlyUploaded" | "aToZ" | "zToA" | "mostSubscribers";

type SubscriptionItem = {
  id: string;
  channelId: string;
  channelTitle: string;
  channelThumbnailUrl?: string | null;
  subscriberCount?: number | null;
  lastUploadedAt?: string | null;
  active: boolean;
};

type ContentCardItem = {
  id: string;
  title: string;
  slug: string;
  headlineImageUrl?: string | null;
  views: number;
  karma: number;
  user?: { id: string; displayName?: string | null } | null;
};

function formatSubscriberCount(value?: number | null): string {
  if (!value || value < 0) return "Subscribers unavailable";
  return `${new Intl.NumberFormat().format(value)} subscribers`;
}

function formatLastUploaded(value?: string | null): string {
  if (!value) return "No recent upload data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent upload data";
  return `Last upload ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date)}`;
}

function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("recentlyUploaded");
  const [search, setSearch] = useState("");
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
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
  const [startHarvest, { loading: startingHarvest }] = useMutation(
    START_HARVEST_MUTATION,
  );
  const { data: voicesData, refetch: refetchVoices } = useQuery(VOICES_QUERY, {
    variables: { userId: user?.id },
    skip: !user,
  });
  const { data: harvestEligibilityData, refetch: refetchEligibility } = useQuery(
    HARVEST_ELIGIBILITY_QUERY,
    { skip: !user },
  );
  const { data: articlesData } = useQuery(USER_ARTICLES_QUERY, {
    variables: { userId: user?.id, limit: 24 },
    skip: !user?.id,
  });
  const { data: gencastsData } = useQuery(USER_GENCASTS_QUERY, {
    variables: { userId: user?.id, limit: 24 },
    skip: !user?.id,
  });
  const [deleteVoice, { loading: deletingVoice }] = useMutation(
    DELETE_VOICE_MUTATION,
  );
  const [createCustomVoice, { loading: creatingVoice }] = useMutation(
    CREATE_CUSTOM_VOICE_MUTATION,
  );
  const [voiceName, setVoiceName] = useState("");
  const [voiceFile, setVoiceFile] = useState<File | null>(null);

  const subscriptions: SubscriptionItem[] = data?.youtubeSubscriptions ?? [];
  const harvestEligibility = harvestEligibilityData?.harvestEligibility;
  const isFirstRun = Boolean(harvestEligibility?.isFirstRun);
  const firstRunPreselectAppliedRef = useRef(false);

  const activeSection = useMemo<DashboardSection>(() => {
    const section = searchParams.get("section");
    if (section === "profile" || section === "youtube" || section === "content") {
      return section;
    }
    return "youtube";
  }, [searchParams]);

  const setSection = (section: DashboardSection) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", section);
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    if (subscriptions.length === 0) {
      setSelected([]);
      return;
    }

    if (isFirstRun && !firstRunPreselectAppliedRef.current) {
      const topByRecency = [...subscriptions]
        .sort((left, right) => {
          const leftAt = left.lastUploadedAt ? new Date(left.lastUploadedAt).getTime() : 0;
          const rightAt = right.lastUploadedAt ? new Date(right.lastUploadedAt).getTime() : 0;
          if (rightAt !== leftAt) return rightAt - leftAt;
          return left.channelTitle.localeCompare(right.channelTitle);
        })
        .slice(0, MAX_SELECTED_CHANNELS)
        .map((subscription) => subscription.channelId);
      setSelected(topByRecency);
      firstRunPreselectAppliedRef.current = true;
      return;
    }

    if (!isFirstRun) {
      setSelected(
        subscriptions
          .filter((subscription) => subscription.active)
          .map((subscription) => subscription.channelId),
      );
      firstRunPreselectAppliedRef.current = false;
    }
  }, [subscriptions, isFirstRun]);

  const filteredSubscriptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const matches = subscriptions.filter((subscription) =>
      subscription.channelTitle.toLowerCase().includes(normalizedSearch) &&
      (!showOnlySelected || selected.includes(subscription.channelId)),
    );

    return [...matches].sort((left, right) => {
      if (sortBy === "aToZ") {
        return left.channelTitle.localeCompare(right.channelTitle);
      }
      if (sortBy === "zToA") {
        return right.channelTitle.localeCompare(left.channelTitle);
      }
      if (sortBy === "mostSubscribers") {
        const leftSubscribers = left.subscriberCount ?? -1;
        const rightSubscribers = right.subscriberCount ?? -1;
        if (rightSubscribers !== leftSubscribers) {
          return rightSubscribers - leftSubscribers;
        }
        return left.channelTitle.localeCompare(right.channelTitle);
      }
      const leftLastUploaded = left.lastUploadedAt
        ? new Date(left.lastUploadedAt).getTime()
        : 0;
      const rightLastUploaded = right.lastUploadedAt
        ? new Date(right.lastUploadedAt).getTime()
        : 0;
      if (rightLastUploaded !== leftLastUploaded) {
        return rightLastUploaded - leftLastUploaded;
      }
      return left.channelTitle.localeCompare(right.channelTitle);
    });
  }, [search, showOnlySelected, sortBy, subscriptions, selected]);

  const isOverSelectionLimit = selected.length > MAX_SELECTED_CHANNELS;
  const allChannelIds = useMemo(
    () => subscriptions.map((subscription) => subscription.channelId),
    [subscriptions],
  );
  const areAllChannelsSelected =
    allChannelIds.length > 0 && selected.length === allChannelIds.length;
  const actionRowRef = useRef<HTMLDivElement | null>(null);
  const [showFloatingActions, setShowFloatingActions] = useState(false);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Sign in to access your dashboard.</p>
      </div>
    );
  }

  const toggleSelection = (channelId: string) => {
    setSelectionMessage(null);
    setSelected((previous) => {
      if (previous.includes(channelId)) {
        return previous.filter((id) => id !== channelId);
      }
      return [...previous, channelId];
    });
  };

  const handleSaveAndMaybeGenerate = async () => {
    if (selected.length > MAX_SELECTED_CHANNELS) {
      const message = `You can select up to ${MAX_SELECTED_CHANNELS} channels for generation.`;
      setSelectionMessage(message);
      toast.error(message);
      return;
    }

    try {
      await setSelection({ variables: { channelIds: selected } });
      await refetch();
      if (isFirstRun) {
        await startHarvest({ variables: { type: "INITIAL" } });
        toast.success("Selection saved. Generation started.");
      } else {
        toast.success("Channel selection saved.");
      }
      await refetchEligibility();
    } catch {
      toast.error("Failed to complete action.");
    }
  };

  const handleGenerateNew = async () => {
    try {
      await startHarvest({ variables: { type: "RECURRING" } });
      toast.success("Generation started.");
      await refetchEligibility();
    } catch {
      toast.error("Unable to start generation right now.");
    }
  };

  useEffect(() => {
    const updateFloatingActions = () => {
      const row = actionRowRef.current;
      if (!row || subscriptions.length === 0) {
        setShowFloatingActions(false);
        return;
      }
      const rect = row.getBoundingClientRect();
      setShowFloatingActions(rect.bottom <= 0);
    };

    updateFloatingActions();
    window.addEventListener("scroll", updateFloatingActions, { passive: true });
    window.addEventListener("resize", updateFloatingActions);
    return () => {
      window.removeEventListener("scroll", updateFloatingActions);
      window.removeEventListener("resize", updateFloatingActions);
    };
  }, [subscriptions.length]);

  return (
    <div className="w-full px-4 py-8 pb-28">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { id: "profile" as const, label: "Profile", icon: UserRound },
              { id: "youtube" as const, label: "YouTube", icon: Radio },
              { id: "content" as const, label: "Content", icon: FileText },
            ].map((section) => {
              const Icon = section.icon;
              const selectedSection = activeSection === section.id;
              return (
                <BouncyClick
                  key={section.id}
                  onClick={() => setSection(section.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm",
                    selectedSection
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </BouncyClick>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {activeSection === "profile" && <ProfileContent userId={user.id} embedded />}

          {activeSection === "content" && (
            <Card>
              <CardHeader>
                <CardTitle>Content</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="gencasts">
                  <TabsList>
                    <TabsTrigger value="gencasts">Gencasts</TabsTrigger>
                    <TabsTrigger value="articles">Articles</TabsTrigger>
                  </TabsList>
                  <TabsContent value="gencasts" className="pt-4">
                    {(gencastsData?.userGencasts ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No gencasts yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {(gencastsData?.userGencasts ?? []).map((gencast: ContentCardItem) => (
                          <GencastCard key={gencast.id} {...gencast} />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="articles" className="pt-4">
                    {(articlesData?.userArticles ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No articles yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {(articlesData?.userArticles ?? []).map((article: ContentCardItem) => (
                          <ArticleCard key={article.id} {...article} />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {activeSection === "youtube" && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Account & YouTube</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Logged in as {user.displayName || "User"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Link your account, choose channels, and generate content from your
                      selected channels.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={linking}
                        onClick={() => {
                          fetchAuthUrl()
                            .then((response) => {
                              const authUrl = response.data?.youtubeAuthUrl?.authUrl;
                              if (authUrl) {
                                toast.success("Redirecting to YouTube...");
                                window.location.href = authUrl;
                                return;
                              }
                              toast.error("Unable to start YouTube linking.");
                            })
                            .catch(() => {
                              toast.error("Unable to start YouTube linking.");
                            });
                        }}
                      >
                        {linking ? "Redirecting..." : "Link YouTube"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={syncing}
                        onClick={async () => {
                          try {
                            if (selected.length > MAX_SELECTED_CHANNELS) {
                              const message = `You can sync up to ${MAX_SELECTED_CHANNELS} selected channels.`;
                              setSelectionMessage(message);
                              toast.error(message);
                              return;
                            }
                            await syncSubscriptions();
                            await refetch();
                            toast.success("Subscriptions synced.");
                          } catch {
                            toast.error("Failed to sync subscriptions.");
                          }
                        }}
                      >
                        {syncing ? "Syncing..." : "Resync subscriptions"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={unlinking}
                        onClick={async () => {
                          try {
                            await unlinkYouTube();
                            await refetch();
                            toast.success("YouTube account unlinked.");
                          } catch {
                            toast.error("Failed to unlink YouTube account.");
                          }
                        }}
                      >
                        {unlinking ? "Unlinking..." : "Unlink YouTube"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectionMessage(null);
                          if (areAllChannelsSelected) {
                            setSelected([]);
                            return;
                          }
                          setSelected(allChannelIds);
                        }}
                        disabled={subscriptions.length === 0}
                      >
                        {areAllChannelsSelected ? "Deselect all" : "Select all"}
                      </Button>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search channels"
                        className="md:max-w-sm"
                      />
                      <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
                        <input
                          type="checkbox"
                          checked={showOnlySelected}
                          onChange={(event) => setShowOnlySelected(event.target.checked)}
                        />
                        Show only selected
                      </label>
                      <select
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm md:w-56"
                        value={sortBy}
                        onChange={(event) => setSortBy(event.target.value as SortOption)}
                      >
                        <option value="recentlyUploaded">Recently uploaded</option>
                        <option value="aToZ">A to Z</option>
                        <option value="zToA">Z to A</option>
                        <option value="mostSubscribers">Most subscribers</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Gencast Voices</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Manage default and custom voices for gencasts.
                    </p>
                    <Input
                      placeholder="Custom voice name"
                      value={voiceName}
                      onChange={(event) => setVoiceName(event.target.value)}
                    />
                    <Input
                      type="file"
                      accept="audio/*"
                      onChange={(event) => setVoiceFile(event.target.files?.[0] ?? null)}
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
                        try {
                          await createCustomVoice({
                            variables: {
                              name: voiceName.trim(),
                              sampleAudioBase64,
                            },
                          });
                          setVoiceName("");
                          setVoiceFile(null);
                          await refetchVoices();
                          toast.success("Custom voice created.");
                        } catch {
                          toast.error("Failed to create custom voice.");
                        }
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
                                  try {
                                    await deleteVoice({ variables: { id: voice.id } });
                                    await refetchVoices();
                                    toast.success("Voice deleted.");
                                  } catch {
                                    toast.error("Failed to delete voice.");
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>YouTube Channels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    ref={actionRowRef}
                    className="flex flex-wrap items-center justify-between gap-3 border-b pb-3"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveAndMaybeGenerate}
                        disabled={saving || startingHarvest}
                      >
                        {saving || startingHarvest
                          ? "Working..."
                          : isFirstRun
                            ? "Save selection and generate now"
                            : "Save selection"}
                      </Button>
                      {!isFirstRun && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!harvestEligibility?.canStart || startingHarvest}
                          onClick={handleGenerateNew}
                        >
                          {startingHarvest
                            ? "Starting..."
                            : "Generate new Gencast/articles"}
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <p className={cn(isOverSelectionLimit && "text-destructive")}>
                        Selected channels: {selected.length}/{MAX_SELECTED_CHANNELS}
                      </p>
                      {selectionMessage && <p className="text-destructive">{selectionMessage}</p>}
                      {!harvestEligibility?.canStart && harvestEligibility?.reason && (
                        <p className="text-destructive">{harvestEligibility.reason}</p>
                      )}
                    </div>
                  </div>

                  {loading ? (
                    <p className="text-xs text-muted-foreground">Loading subscriptions...</p>
                  ) : filteredSubscriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No channels found. Try syncing subscriptions or adjusting your search.
                    </p>
                  ) : (
                    <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {filteredSubscriptions.map((subscription) => {
                        const isSelected = selected.includes(subscription.channelId);
                        return (
                          <BouncyClick
                            key={subscription.id}
                            onClick={() => toggleSelection(subscription.channelId)}
                            className={cn(
                              "rounded-md border p-3 text-left",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/60",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              {subscription.channelThumbnailUrl ? (
                                <img
                                  src={subscription.channelThumbnailUrl}
                                  alt=""
                                  className="h-12 w-12 rounded-full object-cover"
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-full bg-muted" />
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {subscription.channelTitle}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatSubscriberCount(subscription.subscriberCount)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatLastUploaded(subscription.lastUploadedAt)}
                                </p>
                                {isSelected && (
                                  <span className="mt-1 inline-flex rounded-full border border-green-600 px-2 py-0.5 text-xs font-medium text-green-600">
                                    Selected
                                  </span>
                                )}
                              </div>
                            </div>
                          </BouncyClick>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {showFloatingActions && subscriptions.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <p className={cn(isOverSelectionLimit && "text-destructive")}>
                Selected channels: {selected.length}/{MAX_SELECTED_CHANNELS}
              </p>
              {selectionMessage && <p className="text-destructive">{selectionMessage}</p>}
            </div>
            <Button
              size="sm"
              onClick={handleSaveAndMaybeGenerate}
              disabled={saving || startingHarvest}
            >
              {saving || startingHarvest
                ? "Working..."
                : isFirstRun
                  ? "Save selection and generate now"
                  : "Save selection"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full px-4 py-8">
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
