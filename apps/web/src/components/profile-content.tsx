"use client";

import { gql, useMutation, useQuery } from "@apollo/client";
import { Button } from "@/components/ui/button";
import { ArticleCard } from "@/components/article-card";
import { GencastCard } from "@/components/gencast-card";
import { USER_ARTICLES_QUERY, USER_GENCASTS_QUERY } from "@/lib/graphql/content";
import { CommentsSection } from "@/components/comments-section";
import { toast } from "sonner";

const USER_QUERY = gql`
  query User($id: String!) {
    user(id: $id) {
      id
      displayName
      avatarUrl
      bio
      createdAt
      _count {
        articles
        gencasts
        subscribers
      }
    }
  }
`;

const IS_SUBSCRIBED_QUERY = gql`
  query IsSubscribed($subscribedToId: String!) {
    isSubscribed(subscribedToId: $subscribedToId)
  }
`;

const SUBSCRIBE_MUTATION = gql`
  mutation Subscribe($subscribedToId: String!) {
    subscribe(subscribedToId: $subscribedToId)
  }
`;

const UNSUBSCRIBE_MUTATION = gql`
  mutation Unsubscribe($subscribedToId: String!) {
    unsubscribe(subscribedToId: $subscribedToId)
  }
`;

type ProfileContentProps = {
  userId: string;
  embedded?: boolean;
};

export function ProfileContent({ userId, embedded = false }: ProfileContentProps) {
  const { data, loading } = useQuery(USER_QUERY, {
    variables: { id: userId },
    skip: !userId,
  });
  const { data: articlesData } = useQuery(USER_ARTICLES_QUERY, {
    variables: { userId, limit: 12 },
    skip: !userId,
  });
  const { data: gencastsData } = useQuery(USER_GENCASTS_QUERY, {
    variables: { userId, limit: 12 },
    skip: !userId,
  });
  const { data: subscribedData, refetch: refetchSubscribed } = useQuery(
    IS_SUBSCRIBED_QUERY,
    { variables: { subscribedToId: userId }, skip: !userId },
  );
  const [subscribe, { loading: subscribing }] = useMutation(SUBSCRIBE_MUTATION);
  const [unsubscribe, { loading: unsubscribing }] = useMutation(UNSUBSCRIBE_MUTATION);

  if (loading || !data?.user) {
    return <>{loading ? <p>Loading...</p> : <p>User not found.</p>}</>;
  }

  const u = data.user;
  const displayName = u.displayName || "User";
  const articles = articlesData?.userArticles ?? [];
  const gencasts = gencastsData?.userGencasts ?? [];
  const isSubscribed = Boolean(subscribedData?.isSubscribed);

  return (
    <div className={embedded ? "space-y-8" : "container mx-auto max-w-2xl space-y-8 px-4 py-8"}>
      <div className="flex items-center gap-4">
        {u.avatarUrl ? (
          <img src={u.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-2xl font-bold">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
        </div>
      </div>

      {u.bio && <p className="text-sm text-muted-foreground">{u.bio}</p>}

      <div className="flex gap-4 text-sm">
        <span>{u._count?.articles ?? 0} articles</span>
        <span>{u._count?.gencasts ?? 0} gencasts</span>
        <span>{u._count?.subscribers ?? 0} subscribers</span>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={subscribing || unsubscribing}
        onClick={async () => {
          try {
            if (isSubscribed) {
              await unsubscribe({ variables: { subscribedToId: userId } });
              toast.success("Unsubscribed.");
            } else {
              await subscribe({ variables: { subscribedToId: userId } });
              toast.success("Subscribed.");
            }
            await refetchSubscribed();
          } catch {
            toast.error("Failed to update subscription.");
          }
        }}
      >
        {isSubscribed ? "Subscribed" : "Subscribe"}
      </Button>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Content</h2>
        {articles.length === 0 && gencasts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public articles or gencasts yet.</p>
        ) : (
          <div className="space-y-8">
            {articles.length > 0 && (
              <div>
                <h3 className="mb-3 text-md font-medium">Articles</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {articles.map(
                    (article: {
                      id: string;
                      title: string;
                      slug: string;
                      headlineImageUrl?: string | null;
                      views: number;
                      karma: number;
                      user?: { id: string; displayName?: string | null } | null;
                    }) => (
                      <ArticleCard
                        key={article.id}
                        id={article.id}
                        title={article.title}
                        slug={article.slug}
                        headlineImageUrl={article.headlineImageUrl}
                        views={article.views}
                        karma={article.karma}
                        user={article.user}
                      />
                    ),
                  )}
                </div>
              </div>
            )}
            {gencasts.length > 0 && (
              <div>
                <h3 className="mb-3 text-md font-medium">Gencasts</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {gencasts.map(
                    (gencast: {
                      id: string;
                      title: string;
                      slug: string;
                      headlineImageUrl?: string | null;
                      views: number;
                      karma: number;
                      user?: { id: string; displayName?: string | null } | null;
                    }) => (
                      <GencastCard
                        key={gencast.id}
                        id={gencast.id}
                        title={gencast.title}
                        slug={gencast.slug}
                        headlineImageUrl={gencast.headlineImageUrl}
                        views={gencast.views}
                        karma={gencast.karma}
                        user={gencast.user}
                      />
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <CommentsSection targetType="USER_PROFILE" targetId={userId} profileUserId={userId} />
    </div>
  );
}
