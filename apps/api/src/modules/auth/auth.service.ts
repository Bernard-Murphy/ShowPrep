import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";

export interface JwtPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, bio: true, role: true },
    });
  }

  signToken(userId: string): { accessToken: string } {
    const payload: JwtPayload = { sub: userId };
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: "7d" }),
    };
  }
}
