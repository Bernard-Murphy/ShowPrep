"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@apollo/client";
import { gql } from "@apollo/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

export default function ProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  const { data, loading } = useQuery(USER_QUERY, { variables: { id }, skip: !id });

  if (loading || !data?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        {loading ? <p>Loading...</p> : <p>User not found.</p>}
      </div>
    );
  }

  const u = data.user;
  const displayName = u.displayName || "User";
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
      <Button variant="outline" size="sm">Subscribe</Button>
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Content</h2>
        <p className="text-sm text-muted-foreground">Articles and gencasts will appear here.</p>
      </div>
    </div>
  );
}
