import {
  Controller,
  Get,
  Query,
  Res,
  ForbiddenException,
} from "@nestjs/common";
import { Response } from "express";
import { YouTubeService } from "./youtube.service";
import { ConfigService } from "@nestjs/config";

@Controller("api/auth/youtube")
export class YouTubeController {
  constructor(
    private readonly youtube: YouTubeService,
    private readonly config: ConfigService,
  ) {}

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get<string>(
      "CORS_ORIGIN",
      "http://localhost:3000",
    );
    const callbackPath = `${frontendUrl}/auth/callback`;
    const successLinkRedirect = `${frontendUrl}/settings?youtube=linked`;
    const errorRedirect = `${callbackPath}?error=1`;

    if (error) {
      return res.redirect(errorRedirect);
    }
    if (!code || !state) {
      return res.redirect(errorRedirect);
    }
    try {
      const result = await this.youtube.handleCallback(code, state);
      if (result.accessToken) {
        return res.redirect(
          `${callbackPath}?token=${encodeURIComponent(result.accessToken)}`,
        );
      }
      return res.redirect(successLinkRedirect);
    } catch {
      return res.redirect(errorRedirect);
    }
  }
}
