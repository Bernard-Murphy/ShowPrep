import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SchedulerService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron("0 * * * *")
  async recalculateHotScores() {
    const articles = await this.prisma.article.findMany({
      select: {
        id: true,
        views: true,
        karma: true,
        createdAt: true,
        _count: { select: { comments: true } },
      },
    });
    for (const a of articles) {
      const ageHours = (Date.now() - a.createdAt.getTime()) / 3_600_000;
      const score =
        (a._count.comments * 3 + a.karma * 2 + a.views) /
        Math.pow(ageHours + 2, 1.5);
      await this.prisma.article.update({
        where: { id: a.id },
        data: { hotScore: score },
      });
    }
    const gencasts = await this.prisma.gencast.findMany({
      select: {
        id: true,
        views: true,
        karma: true,
        createdAt: true,
        _count: { select: { comments: true } },
      },
    });
    for (const g of gencasts) {
      const ageHours = (Date.now() - g.createdAt.getTime()) / 3_600_000;
      const score =
        (g._count.comments * 3 + g.karma * 2 + g.views) /
        Math.pow(ageHours + 2, 1.5);
      await this.prisma.gencast.update({
        where: { id: g.id },
        data: { hotScore: score },
      });
    }
  }
}
