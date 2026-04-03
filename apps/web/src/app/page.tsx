"use client";

import Link from "next/link";
import { useQuery } from "@apollo/client";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { ArticleCard } from "@/components/article-card";
import { GencastCard } from "@/components/gencast-card";
import { HOT_ARTICLES_QUERY, HOT_GENCASTS_QUERY } from "@/lib/graphql/feed";

export default function HomePage() {
  const { user, showAuthDialog } = useAuth();
  const { data: articlesData } = useQuery(HOT_ARTICLES_QUERY, {
    variables: { limit: 12 },
  });
  const { data: gencastsData } = useQuery(HOT_GENCASTS_QUERY, {
    variables: { limit: 12 },
  });

  const hotArticles = articlesData?.hotArticles ?? [];
  const hotGencasts = gencastsData?.hotGencasts ?? [];

  return (
    <div className="min-h-screen">
      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Showprep</h1>
        <p className="mt-4 mb-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Show prep for podcasters. Link your YouTube, get article summaries and daily audio recaps.
        </p>
        {user ? (
          <Button size="lg" asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        ) : (
          <Button size="lg" onClick={() => showAuthDialog()}>
            Get Started
          </Button>
        )}
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6">Popular Gencasts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {hotGencasts.map((g: { id: string; title: string; slug: string; headlineImageUrl?: string | null; views: number; karma: number; scriptContent?: string; user?: { id: string; displayName?: string | null } | null }) => (
            <GencastCard
              key={g.id}
              id={g.id}
              title={g.title}
              slug={g.slug}
              headlineImageUrl={g.headlineImageUrl}
              views={g.views}
              karma={g.karma}
              scriptContent={g.scriptContent}
              user={g.user}
            />
          ))}
        </div>
        {hotGencasts.length === 0 && (
          <p className="text-muted-foreground">No gencasts yet.</p>
        )}
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6">Popular Articles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {hotArticles.map((a: { id: string; title: string; slug: string; headlineImageUrl?: string | null; views: number; karma: number; content?: string; user?: { id: string; displayName?: string | null } | null }) => (
            <ArticleCard
              key={a.id}
              id={a.id}
              title={a.title}
              slug={a.slug}
              headlineImageUrl={a.headlineImageUrl}
              views={a.views}
              karma={a.karma}
              content={a.content}
              user={a.user}
            />
          ))}
        </div>
        {hotArticles.length === 0 && (
          <p className="text-muted-foreground">No articles yet.</p>
        )}
      </section>
    </div>
  );
}
