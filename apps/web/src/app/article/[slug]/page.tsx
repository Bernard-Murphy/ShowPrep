"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@apollo/client";
import { gql } from "@apollo/client";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";

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

export default function ArticlePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { data, loading } = useQuery(ARTICLE_QUERY, { variables: { slug }, skip: !slug });

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
      <p className="text-xs text-muted-foreground mb-6">
        {a.views} views · {a.karma} karma
      </p>
      <Card className="p-6">
        <CardContent className="prose prose-invert dark:prose-invert max-w-none">
          <ReactMarkdown>{a.content}</ReactMarkdown>
        </CardContent>
      </Card>
    </div>
  );
}
