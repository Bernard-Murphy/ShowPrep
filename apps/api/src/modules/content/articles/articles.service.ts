import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            youtubeConnection: { select: { channelThumbnailUrl: true } },
          },
        },
        processedVideo: true,
      },
    });
    if (!article) return null;
    return {
      ...article,
      user: article.user
        ? {
            id: article.user.id,
            displayName: article.user.displayName,
            avatarUrl:
              article.user.youtubeConnection?.channelThumbnailUrl ?? null,
          }
        : null,
    };
  }

  async listByUser(userId: string, limit = 20) {
    return this.prisma.article.findMany({
      where: { userId, isPublic: true },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(limit, 100)),
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
  }

  async incrementViews(slug: string) {
    await this.prisma.article.update({
      where: { slug },
      data: { views: { increment: 1 } },
    });
    return true;
  }

  async setPublic(articleId: string, userId: string, isPublic: boolean) {
    const art = await this.prisma.article.findFirst({
      where: { id: articleId, userId },
    });
    if (!art) throw new ForbiddenException("Article not found");
    await this.prisma.article.update({
      where: { id: articleId },
      data: { isPublic },
    });
    return true;
  }
}
