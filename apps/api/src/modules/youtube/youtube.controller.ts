import { Controller, Get, Query, Res, Logger } from "@nestjs/common";
import { Response } from "express";
import { YouTubeService } from "./youtube.service";
import { ConfigService } from "@nestjs/config";

@Controller("api/auth/youtube")
export class YouTubeController {
  private readonly logger = new Logger(YouTubeController.name);

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
      this.logger.warn(`OAuth provider returned error: ${error}`);
      return res.redirect(errorRedirect);
    }
    if (!code || !state) {
      this.logger.warn("OAuth callback missing code or state");
      return res.redirect(errorRedirect);
    }
    try {
      this.logger.log("Processing YouTube OAuth callback");
      const result = await this.youtube.handleCallback(code, state);
      if (result.accessToken) {
        this.logger.log(
          `OAuth login succeeded for userId=${result.userId}; redirecting with token`,
        );
        return res.redirect(
          `${callbackPath}?token=${encodeURIComponent(result.accessToken)}`,
        );
      }
      this.logger.log(
        `OAuth link flow succeeded for userId=${result.userId}; redirecting to settings`,
      );
      return res.redirect(successLinkRedirect);
    } catch (err) {
      const message =
        err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      this.logger.error(`OAuth callback failed: ${message}`);
      return res.redirect(errorRedirect);
    }
  }
}
