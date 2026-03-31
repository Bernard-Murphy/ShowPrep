"use client";

import { useParams } from "next/navigation";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Button } from "@/components/ui/button";
import { ArticleCard } from "@/components/article-card";
import { GencastCard } from "@/components/gencast-card";
import { USER_ARTICLES_QUERY, USER_GENCASTS_QUERY } from "@/lib/graphql/content";
import { CommentsSection } from "@/components/comments-section";

const USER_QUERY = gql`
  query User($id: String!) {
    user(id: $id) {
      id
      displayName
      avatarUrl
      bio
      createdAt
      _count { articles gencasts subscribers }
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

export default function ProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  const { data, loading } = useQuery(USER_QUERY, { variables: { id }, skip: !id });
  const { data: articlesData } = useQuery(USER_ARTICLES_QUERY, {
    variables: { userId: id, limit: 12 },
    skip: !id,
  });
  const { data: gencastsData } = useQuery(USER_GENCASTS_QUERY, {
    variables: { userId: id, limit: 12 },
    skip: !id,
  });
  const { data: subscribedData, refetch: refetchSubscribed } = useQuery(
    IS_SUBSCRIBED_QUERY,
    { variables: { subscribedToId: id }, skip: !id },
  );
  const [subscribe, { loading: subscribing }] = useMutation(SUBSCRIBE_MUTATION);
  const [unsubscribe, { loading: unsubscribing }] = useMutation(
    UNSUBSCRIBE_MUTATION,
  );

  if (loading || !data?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        {loading ? <p>Loading...</p> : <p>User not found.</p>}
      </div>
    );
  }

  const u = data.user;
  const displayName = u.displayName || "User";
  const articles = articlesData?.userArticles ?? [];
  const gencasts = gencastsData?.userGencasts ?? [];
  const isSubscribed = Boolean(subscribedData?.isSubscribed);
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        {u.avatarUrl ? (
          <img src={u.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
        </div>
      </div>
      {u.bio && <p className="text-sm text-muted-foreground mb-6">{u.bio}</p>}
      <div className="flex gap-4 text-sm mb-6">
        <span>{u._count?.articles ?? 0} articles</span>
        <span>{u._count?.gencasts ?? 0} gencasts</span>
        <span>{u._count?.subscribers ?? 0} subscribers</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={subscribing || unsubscribing}
        onClick={async () => {
          if (isSubscribed) {
            await unsubscribe({ variables: { subscribedToId: id } });
          } else {
            await subscribe({ variables: { subscribedToId: id } });
          }
          await refetchSubscribed();
        }}
      >
        {isSubscribed ? "Subscribed" : "Subscribe"}
      </Button>
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Content</h2>
        {articles.length === 0 && gencasts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No public articles or gencasts yet.
          </p>
        ) : (
          <div className="space-y-8">
            {articles.length > 0 && (
              <div>
                <h3 className="text-md font-medium mb-3">Articles</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <h3 className="text-md font-medium mb-3">Gencasts</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      <CommentsSection targetType="USER_PROFILE" targetId={id} profileUserId={id} />
    </div>
  );
}
