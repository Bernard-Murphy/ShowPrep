import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed(
    userId: string | null,
    options: {
      filter?: "all" | "articles" | "gencasts";
      sort?: "hot" | "newest" | "oldest" | "popular";
      search?: string;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{
    items: (Record<string, unknown> & { type: string })[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(options.limit ?? 20, 50);
    const sort = options.sort ?? "hot";
    const filter = options.filter ?? "all";

    const subscriberIds = userId
      ? (
          await this.prisma.userSubscription.findMany({
            where: { subscriberId: userId },
            select: { subscribedToId: true },
          })
        ).map((x: { subscribedToId: string }) => x.subscribedToId)
      : [];
    const feedUserIds = userId ? [userId, ...subscriberIds] : [];

    const orderBy =
      sort === "newest"
        ? { createdAt: "desc" as const }
        : sort === "oldest"
          ? { createdAt: "asc" as const }
          : sort === "popular"
            ? [{ karma: "desc" as const }, { views: "desc" as const }]
            : [{ hotScore: "desc" as const }, { createdAt: "desc" as const }];

    const whereBase = {
      isPublic: true,
      ...(feedUserIds.length > 0 ? { userId: { in: feedUserIds } } : {}),
    };

    const search = options.search?.trim();
    const whereArticle = search
      ? {
          ...whereBase,
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { content: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : whereBase;
    const whereGencast = search
      ? {
          ...whereBase,
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            {
              scriptContent: { contains: search, mode: "insensitive" as const },
            },
          ],
        }
      : whereBase;

    const items: (Record<string, unknown> & { type: string })[] = [];
    const takePerType = Math.ceil(limit / 2);

    const userSelect = {
      id: true,
      displayName: true,
      youtubeConnection: { select: { channelThumbnailUrl: true } },
    };
    const mapUser = (u: {
      id: string;
      displayName: string | null;
      youtubeConnection?: { channelThumbnailUrl: string | null } | null;
    }) =>
      u
        ? {
            id: u.id,
            displayName: u.displayName,
            avatarUrl: u.youtubeConnection?.channelThumbnailUrl ?? null,
          }
        : null;

    if (filter === "all" || filter === "articles") {
      const articles = await this.prisma.article.findMany({
        where: whereArticle,
        orderBy,
        take: takePerType + 1,
        cursor: options.cursor ? { id: options.cursor } : undefined,
        skip: options.cursor ? 1 : 0,
        include: { user: { select: userSelect } },
      });
      for (const a of articles.slice(0, takePerType)) {
        items.push({ ...a, user: mapUser(a.user), type: "article" });
      }
    }
    if (filter === "all" || filter === "gencasts") {
      const gencasts = await this.prisma.gencast.findMany({
        where: whereGencast,
        orderBy,
        take: takePerType + 1,
        cursor: options.cursor ? { id: options.cursor } : undefined,
        skip: options.cursor ? 1 : 0,
        include: { user: { select: userSelect }, voice: true },
      });
      for (const g of gencasts.slice(0, takePerType)) {
        items.push({ ...g, user: mapUser(g.user), type: "gencast" });
      }
    }

    items.sort((a, b) => {
      const ah = (a as unknown as { hotScore: number }).hotScore ?? 0;
      const bh = (b as unknown as { hotScore: number }).hotScore ?? 0;
      const at =
        (a as unknown as { createdAt: Date }).createdAt?.getTime?.() ?? 0;
      const bt =
        (b as unknown as { createdAt: Date }).createdAt?.getTime?.() ?? 0;
      const ak = (a as unknown as { karma: number }).karma ?? 0;
      const bk = (b as unknown as { karma: number }).karma ?? 0;
      if (sort === "hot") return bh - ah;
      if (sort === "newest") return bt - at;
      if (sort === "oldest") return at - bt;
      return bk - ak;
    });
    const result = items.slice(0, limit);
    const nextCursor =
      result.length === limit
        ? (result[result.length - 1] as unknown as { id: string }).id
        : null;
    return { items: result, nextCursor };
  }

  async getHotArticles(limit: number) {
    const articles = await this.prisma.article.findMany({
      where: { isPublic: true },
      orderBy: { hotScore: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            youtubeConnection: { select: { channelThumbnailUrl: true } },
          },
        },
      },
    });
    return articles.map((a) => ({
      ...a,
      user: a.user
        ? {
            id: a.user.id,
            displayName: a.user.displayName,
            avatarUrl: a.user.youtubeConnection?.channelThumbnailUrl ?? null,
          }
        : null,
    }));
  }

  async getHotGencasts(limit: number) {
    const gencasts = await this.prisma.gencast.findMany({
      where: { isPublic: true },
      orderBy: { hotScore: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            youtubeConnection: { select: { channelThumbnailUrl: true } },
          },
        },
        voice: true,
      },
    });
    return gencasts.map((g) => ({
      ...g,
      user: g.user
        ? {
            id: g.user.id,
            displayName: g.user.displayName,
            avatarUrl: g.user.youtubeConnection?.channelThumbnailUrl ?? null,
          }
        : null,
    }));
  }
}
