import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { VoteTarget } from "@prisma/client";

@Injectable()
export class VotingService {
  constructor(private readonly prisma: PrismaService) {}

  async vote(
    userId: string,
    targetType: VoteTarget,
    targetId: string,
    value: number,
  ) {
    if (value !== 1 && value !== -1 && value !== 0)
      throw new ForbiddenException("Invalid vote value");
    const articleId = targetType === "ARTICLE" ? targetId : undefined;
    const gencastId = targetType === "GENCAST" ? targetId : undefined;
    const commentId = targetType === "COMMENT" ? targetId : undefined;

    const existing = await this.prisma.vote.findFirst({
      where: {
        userId,
        targetType,
        ...(articleId && { articleId }),
        ...(gencastId && { gencastId }),
        ...(commentId && { commentId }),
      },
    });

    if (existing) {
      if (value === 0) {
        await this.prisma.vote.delete({ where: { id: existing.id } });
        await this.updateKarma(targetType, targetId, -existing.value);
        return true;
      }
      if (existing.value !== value) {
        await this.prisma.vote.update({
          where: { id: existing.id },
          data: { value },
        });
        await this.updateKarma(targetType, targetId, value - existing.value);
      }
      return true;
    }

    if (value !== 0) {
      await this.prisma.vote.create({
        data: {
          userId,
          targetType,
          value,
          ...(articleId && { articleId }),
          ...(gencastId && { gencastId }),
          ...(commentId && { commentId }),
        },
      });
      await this.updateKarma(targetType, targetId, value);
    }
    return true;
  }

  private async updateKarma(
    targetType: VoteTarget,
    targetId: string,
    delta: number,
  ) {
    if (targetType === "ARTICLE") {
      await this.prisma.article.update({
        where: { id: targetId },
        data: { karma: { increment: delta } },
      });
    } else if (targetType === "GENCAST") {
      await this.prisma.gencast.update({
        where: { id: targetId },
        data: { karma: { increment: delta } },
      });
    } else if (targetType === "COMMENT") {
      await this.prisma.comment.update({
        where: { id: targetId },
        data: { karma: { increment: delta } },
      });
    }
  }

  async getUserVote(
    userId: string | null,
    targetType: VoteTarget,
    targetId: string,
  ): Promise<number | null> {
    if (!userId) return null;
    const articleId = targetType === "ARTICLE" ? targetId : undefined;
    const gencastId = targetType === "GENCAST" ? targetId : undefined;
    const commentId = targetType === "COMMENT" ? targetId : undefined;
    const v = await this.prisma.vote.findFirst({
      where: {
        userId,
        targetType,
        ...(articleId && { articleId }),
        ...(gencastId && { gencastId }),
        ...(commentId && { commentId }),
      },
    });
    return v?.value ?? null;
  }
}
