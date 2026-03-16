import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class GencastsService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string) {
    const gencast = await this.prisma.gencast.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            youtubeConnection: { select: { channelThumbnailUrl: true } },
          },
        },
        voice: true,
        sources: { include: { processedVideo: true } },
      },
    });
    if (!gencast) return null;
    return {
      ...gencast,
      user: gencast.user
        ? {
            id: gencast.user.id,
            displayName: gencast.user.displayName,
            avatarUrl:
              gencast.user.youtubeConnection?.channelThumbnailUrl ?? null,
          }
        : null,
    };
  }

  async incrementViews(slug: string) {
    await this.prisma.gencast.update({
      where: { slug },
      data: { views: { increment: 1 } },
    });
    return true;
  }

  async setPublic(gencastId: string, userId: string, isPublic: boolean) {
    const g = await this.prisma.gencast.findFirst({
      where: { id: gencastId, userId },
    });
    if (!g) throw new ForbiddenException("Gencast not found");
    await this.prisma.gencast.update({
      where: { id: gencastId },
      data: { isPublic },
    });
    return true;
  }
}
