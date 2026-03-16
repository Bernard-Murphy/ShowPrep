import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UserEntity } from "./models/user.model";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalAuthGuard } from "../../common/guards/optional-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { UpdateProfileInput } from "./dto/update-profile.input";

@Resolver(() => UserEntity)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => UserEntity, { nullable: true })
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: { id: string }) {
    return this.usersService.findById(user.id);
  }

  @Query(() => UserEntity, { nullable: true })
  user(@Args("id") id: string) {
    return this.usersService.findById(id);
  }

  @Mutation(() => UserEntity)
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @CurrentUser() user: { id: string },
    @Args("input") input: UpdateProfileInput,
  ) {
    return this.usersService.updateProfile(user.id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  subscribe(
    @CurrentUser() user: { id: string },
    @Args("subscribedToId") subscribedToId: string,
  ) {
    return this.usersService.subscribe(user.id, subscribedToId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  unsubscribe(
    @CurrentUser() user: { id: string },
    @Args("subscribedToId") subscribedToId: string,
  ) {
    return this.usersService.unsubscribe(user.id, subscribedToId);
  }

  @Query(() => Boolean)
  @UseGuards(OptionalAuthGuard)
  isSubscribed(
    @CurrentUser() user: { id: string } | null,
    @Args("subscribedToId") subscribedToId: string,
  ) {
    return this.usersService.isSubscribed(user?.id ?? null, subscribedToId);
  }
}
