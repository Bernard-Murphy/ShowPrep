"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { gql, useMutation, useQuery } from "@apollo/client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VoteControls } from "@/components/vote-controls";
import { CommentsSection } from "@/components/comments-section";

const GENCAST_QUERY = gql`
  query Gencast($slug: String!) {
    gencast(slug: $slug) {
      id
      title
      slug
      scriptContent
      harvestOutline
      audioUrl
      headlineImageUrl
      views
      karma
      createdAt
      user { id displayName }
      sources { id processedVideo { videoTitle channelTitle } }
    }
  }
`;

const GENCAST_INCREMENT_VIEWS_MUTATION = gql`
  mutation GencastIncrementViews($slug: String!) {
    gencastIncrementViews(slug: $slug)
  }
`;

export default function GencastPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [showScript, setShowScript] = useState(false);
  const { data, loading } = useQuery(GENCAST_QUERY, { variables: { slug }, skip: !slug });
  const [incrementViews] = useMutation(GENCAST_INCREMENT_VIEWS_MUTATION);

  useEffect(() => {
    if (!slug) return;
    incrementViews({ variables: { slug } }).catch(() => {});
  }, [slug, incrementViews]);

  if (loading || !data?.gencast) {
    return (
      <div className="container mx-auto px-4 py-8">
        {loading ? <p>Loading...</p> : <p>Gencast not found.</p>}
      </div>
    );
  }

  const g = data.gencast;
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {g.headlineImageUrl && (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted mb-6">
          <img src={g.headlineImageUrl} alt="" className="object-cover w-full h-full" />
        </div>
      )}
      <h1 className="text-3xl font-bold mb-4">{g.title}</h1>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          {g.views} views · {g.karma} karma
        </p>
        <VoteControls targetType="GENCAST" targetId={g.id} karma={g.karma} />
      </div>
      {g.audioUrl && (
        <div className="mb-6">
          <audio controls src={g.audioUrl} className="w-full" />
        </div>
      )}
      <Button variant="outline" className="mb-4" onClick={() => setShowScript((s) => !s)}>
        {showScript ? "Hide script" : "Show script"}
      </Button>
      {showScript && (
        <Card className="p-6 mb-6">
          <CardContent className="whitespace-pre-wrap text-sm">{g.scriptContent}</CardContent>
        </Card>
      )}
      {g.harvestOutline && (
        <Card className="p-6 mb-6">
          <CardContent className="whitespace-pre-wrap text-sm">{g.harvestOutline}</CardContent>
        </Card>
      )}
      {g.sources?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Sources</h2>
          <ul className="list-disc list-inside text-sm text-muted-foreground">
            {g.sources.map((s: { id: string; processedVideo: { videoTitle: string; channelTitle: string } }) => (
              <li key={s.id}>
                {s.processedVideo?.channelTitle}: {s.processedVideo?.videoTitle}
              </li>
            ))}
          </ul>
        </div>
      )}
      <CommentsSection targetType="GENCAST" targetId={g.id} />
    </div>
  );
}
