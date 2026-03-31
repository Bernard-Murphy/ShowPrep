"use client";

import { useParams } from "next/navigation";
import { gql, useMutation, useQuery } from "@apollo/client";
import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { VoteControls } from "@/components/vote-controls";
import { CommentsSection } from "@/components/comments-section";

const ARTICLE_QUERY = gql`
  query Article($slug: String!) {
    article(slug: $slug) {
      id
      title
      slug
      content
      headlineImageUrl
      sourceChannelTitle
      sourceVideoTitle
      views
      karma
      createdAt
      user { id displayName }
    }
  }
`;

const ARTICLE_INCREMENT_VIEWS_MUTATION = gql`
  mutation ArticleIncrementViews($slug: String!) {
    articleIncrementViews(slug: $slug)
  }
`;

export default function ArticlePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { data, loading } = useQuery(ARTICLE_QUERY, { variables: { slug }, skip: !slug });
  const [incrementViews] = useMutation(ARTICLE_INCREMENT_VIEWS_MUTATION);

  useEffect(() => {
    if (!slug) return;
    incrementViews({ variables: { slug } }).catch(() => {});
  }, [slug, incrementViews]);

  if (loading || !data?.article) {
    return (
      <div className="container mx-auto px-4 py-8">
        {loading ? <p>Loading...</p> : <p>Article not found.</p>}
      </div>
    );
  }

  const a = data.article;
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {a.headlineImageUrl && (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted mb-6">
          <img src={a.headlineImageUrl} alt="" className="object-cover w-full h-full" />
        </div>
      )}
      <h1 className="text-3xl font-bold mb-2">{a.title}</h1>
      <p className="text-sm text-muted-foreground mb-4">
        {a.sourceChannelTitle} · {a.sourceVideoTitle}
      </p>
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-muted-foreground">
          {a.views} views · {a.karma} karma
        </p>
        <VoteControls targetType="ARTICLE" targetId={a.id} karma={a.karma} />
      </div>
      <Card className="p-6">
        <CardContent className="prose prose-invert dark:prose-invert max-w-none">
          <ReactMarkdown>{a.content}</ReactMarkdown>
        </CardContent>
      </Card>
      <CommentsSection targetType="ARTICLE" targetId={a.id} />
    </div>
  );
}
