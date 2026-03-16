import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CommentTarget } from "@prisma/client";

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    targetType: CommentTarget,
    targetId: string | null,
    profileUserId: string | null,
    userId: string | null,
    text: string,
    repliesTo: string | null,
    anonId: string | null,
    anonTextColor: string | null,
    anonTextBackground: string | null,
  ) {
    const articleId = targetType === "ARTICLE" ? targetId : undefined;
    const gencastId = targetType === "GENCAST" ? targetId : undefined;
    const profileUserIdVal =
      targetType === "USER_PROFILE" ? profileUserId : undefined;
    const comment = await this.prisma.comment.create({
      data: {
        targetType,
        text: text.slice(0, 1000),
        userId: userId ?? undefined,
        articleId,
        gencastId,
        profileUserId: profileUserIdVal,
        repliesTo: repliesTo ?? undefined,
        anonId: anonId ?? undefined,
        anonTextColor: anonTextColor ?? undefined,
        anonTextBackground: anonTextBackground ?? undefined,
      },
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
    return { ...comment, user: this.mapUser(comment.user ?? null) };
  }

  private userSelect = {
    id: true,
    displayName: true,
    youtubeConnection: { select: { channelThumbnailUrl: true } },
  };

  private mapUser(
    u: {
      id: string;
      displayName: string | null;
      youtubeConnection?: { channelThumbnailUrl: string | null } | null;
    } | null,
  ) {
    if (!u) return null;
    return {
      id: u.id,
      displayName: u.displayName,
      avatarUrl: u.youtubeConnection?.channelThumbnailUrl ?? null,
    };
  }

  private mapCommentUser(comment: {
    user?: {
      id: string;
      displayName: string | null;
      youtubeConnection?: { channelThumbnailUrl: string | null } | null;
    } | null;
    replies?: Array<{
      user?: {
        id: string;
        displayName: string | null;
        youtubeConnection?: { channelThumbnailUrl: string | null } | null;
      } | null;
    }>;
    [k: string]: unknown;
  }) {
    return {
      ...comment,
      user: this.mapUser(comment.user ?? null),
      replies: comment.replies?.map((r) => ({
        ...r,
        user: this.mapUser(r.user ?? null),
      })),
    };
  }

  async findByTarget(
    targetType: CommentTarget,
    targetId: string,
    profileUserId: string | null,
  ) {
    const articleId = targetType === "ARTICLE" ? targetId : undefined;
    const gencastId = targetType === "GENCAST" ? targetId : undefined;
    const profileUserIdVal =
      targetType === "USER_PROFILE" ? profileUserId : undefined;
    const comments = await this.prisma.comment.findMany({
      where: {
        targetType,
        ...(articleId && { articleId }),
        ...(gencastId && { gencastId }),
        ...(profileUserIdVal && { profileUserId: profileUserIdVal }),
        repliesTo: null,
      },
      include: {
        user: { select: this.userSelect },
        replies: {
          include: { user: { select: this.userSelect } },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return comments.map((c) => this.mapCommentUser(c));
  }
}
