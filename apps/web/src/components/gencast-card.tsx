"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_DESCRIPTION = 120;

function truncate(text: string, max: number) {
  if (!text || text.length <= max) return text ?? "";
  return text.slice(0, max).trim() + "...";
}

export interface GencastCardProps {
  id: string;
  title: string;
  slug: string;
  headlineImageUrl?: string | null;
  views: number;
  karma: number;
  scriptContent?: string;
  user?: { id: string; displayName?: string | null } | null;
}

export function GencastCard({ title, slug, headlineImageUrl, views, karma, scriptContent, user }: GencastCardProps) {
  const desc = truncate(scriptContent ?? "", MAX_DESCRIPTION);
  return (
    <Link href={`/gencast/${slug}`}>
      <Card className="overflow-hidden transition-colors hover:bg-accent/50">
        <div className="aspect-video w-full bg-muted relative">
          {headlineImageUrl ? (
            <img src={headlineImageUrl} alt="" className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}
        </div>
        <CardHeader className="p-4">
          <CardTitle className="line-clamp-1 text-lg">{title}</CardTitle>
          <CardDescription className="line-clamp-2 text-sm">{desc || "Gencast recap"}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-xs text-muted-foreground flex justify-between">
          <span>{views} view{views !== 1 ? "s" : ""} · {karma} karma</span>
          {user && (
            <Link href={`/u/${user.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
              {user.displayName || "User"}
            </Link>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
