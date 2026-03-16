import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateProfileInput } from "./dto/update-profile.input";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly userSelect = {
    id: true,
    displayName: true,
    bio: true,
    createdAt: true,
    _count: { select: { articles: true, gencasts: true, subscribers: true } },
    youtubeConnection: {
      select: { channelThumbnailUrl: true },
    },
  };

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSelect,
    });
    if (!user) return null;
    const { youtubeConnection, ...rest } = user;
    return {
      ...rest,
      avatarUrl: youtubeConnection?.channelThumbnailUrl ?? null,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const data: { displayName?: string; bio?: string } = {};
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.bio !== undefined) data.bio = input.bio;
    await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return this.findById(userId);
  }

  async subscribe(subscriberId: string, subscribedToId: string) {
    const subscribedTo = await this.prisma.user.findUnique({
      where: { id: subscribedToId },
    });
    if (!subscribedTo) throw new ForbiddenException("User not found");
    if (subscribedTo.id === subscriberId)
      throw new ForbiddenException("Cannot subscribe to yourself");
    await this.prisma.userSubscription.upsert({
      where: {
        subscriberId_subscribedToId: {
          subscriberId,
          subscribedToId: subscribedTo.id,
        },
      },
      create: { subscriberId, subscribedToId: subscribedTo.id },
      update: {},
    });
    return true;
  }

  async unsubscribe(subscriberId: string, subscribedToId: string) {
    const subscribedTo = await this.prisma.user.findUnique({
      where: { id: subscribedToId },
    });
    if (!subscribedTo) return true;
    await this.prisma.userSubscription.deleteMany({
      where: { subscriberId, subscribedToId: subscribedTo.id },
    });
    return true;
  }

  async isSubscribed(
    subscriberId: string | null,
    subscribedToId: string,
  ): Promise<boolean> {
    if (!subscriberId) return false;
    const subscribedTo = await this.prisma.user.findUnique({
      where: { id: subscribedToId },
    });
    if (!subscribedTo) return false;
    const sub = await this.prisma.userSubscription.findUnique({
      where: {
        subscriberId_subscribedToId: {
          subscriberId,
          subscribedToId: subscribedTo.id,
        },
      },
    });
    return !!sub;
  }
}
