-- AlterTable User: drop username, email, passwordHash, avatarUrl; add youtubeChannelId (unique)
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_username_key";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
ALTER TABLE "User" ADD COLUMN "youtubeChannelId" TEXT;
ALTER TABLE "User" DROP COLUMN IF EXISTS "username";
ALTER TABLE "User" DROP COLUMN IF EXISTS "email";
ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordHash";
ALTER TABLE "User" DROP COLUMN IF EXISTS "avatarUrl";
CREATE UNIQUE INDEX IF NOT EXISTS "User_youtubeChannelId_key" ON "User"("youtubeChannelId");

-- AlterTable YouTubeConnection: add channelTitle, channelThumbnailUrl
ALTER TABLE "YouTubeConnection" ADD COLUMN "channelTitle" TEXT;
ALTER TABLE "YouTubeConnection" ADD COLUMN "channelThumbnailUrl" TEXT;
