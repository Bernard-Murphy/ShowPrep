"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client";
import { FEED_QUERY } from "@/lib/graphql/feed";
import { ArticleCard } from "@/components/article-card";
import { GencastCard } from "@/components/gencast-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Filter = "all" | "articles" | "gencasts";
type Sort = "hot" | "newest" | "oldest" | "popular";

export default function FeedPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("hot");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);

  const { data, loading } = useQuery(FEED_QUERY, {
    variables: {
      filter: filter.toUpperCase() === "ALL" ? undefined : filter,
      sort,
      search: search || undefined,
      limit: 20,
      cursor: cursor ?? undefined,
    },
  });

  const connection = data?.feed;
  const edges = connection?.edges ?? [];
  const nextCursor = connection?.nextCursor ?? null;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Feed</h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="articles">Articles</TabsTrigger>
            <TabsTrigger value="gencasts">Gencasts</TabsTrigger>
          </TabsList>
        </Tabs>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm h-10"
        >
          <option value="hot">Hot</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="popular">Popular</option>
        </select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {edges.map((edge: { node: Record<string, unknown>; cursor: string }) => {
              const node = edge.node as {
                __typename?: string;
                id: string;
                title: string;
                slug: string;
                headlineImageUrl?: string | null;
                views: number;
                karma: number;
                content?: string;
                scriptContent?: string;
                user?: { id: string; displayName?: string | null } | null;
              };
              const isArticle = node.__typename === "ArticleEntity";
              if (isArticle) {
                return (
                  <ArticleCard
                    key={node.id}
                    id={node.id}
                    title={node.title}
                    slug={node.slug}
                    headlineImageUrl={node.headlineImageUrl}
                    views={node.views}
                    karma={node.karma}
                    content={node.content}
                    user={node.user}
                  />
                );
              }
              return (
                <GencastCard
                  key={node.id}
                  id={node.id}
                  title={node.title}
                  slug={node.slug}
                  headlineImageUrl={node.headlineImageUrl}
                  views={node.views}
                  karma={node.karma}
                  scriptContent={node.scriptContent}
                  user={node.user}
                />
              );
            })}
          </div>
          {nextCursor && (
            <div className="mt-8 flex justify-center">
              <Button onClick={() => setCursor(nextCursor)}>Load more</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
