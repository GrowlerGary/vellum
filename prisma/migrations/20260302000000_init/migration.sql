-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'TV_SHOW', 'BOOK', 'AUDIOBOOK', 'VIDEO_GAME');

-- CreateEnum
CREATE TYPE "MetadataSource" AS ENUM ('TMDB', 'IGDB', 'HARDCOVER', 'MANUAL');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('WANT', 'IN_PROGRESS', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "ScrobbleSource" AS ENUM ('TRAKT', 'AUDIOBOOKSHELF', 'STREMIO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isProfilePublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" "MetadataSource" NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "overview" TEXT,
    "genres" TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'WANT',
    "rating" DOUBLE PRECISION,
    "reviewText" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrobbleConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ScrobbleSource" NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "accessToken" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrobbleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_username_idx" ON "User"("username");
CREATE INDEX "User_email_idx" ON "User"("email");

CREATE UNIQUE INDEX "MediaItem_source_externalId_key" ON "MediaItem"("source", "externalId");
CREATE INDEX "MediaItem_type_idx" ON "MediaItem"("type");
CREATE INDEX "MediaItem_title_idx" ON "MediaItem"("title");

CREATE UNIQUE INDEX "MediaEntry_userId_mediaItemId_key" ON "MediaEntry"("userId", "mediaItemId");
CREATE INDEX "MediaEntry_userId_idx" ON "MediaEntry"("userId");
CREATE INDEX "MediaEntry_status_idx" ON "MediaEntry"("status");

CREATE INDEX "MediaList_userId_idx" ON "MediaList"("userId");

CREATE UNIQUE INDEX "ListItem_listId_mediaItemId_key" ON "ListItem"("listId", "mediaItemId");

CREATE UNIQUE INDEX "ScrobbleConfig_userId_source_key" ON "ScrobbleConfig"("userId", "source");

CREATE INDEX "AiSuggestion_userId_createdAt_idx" ON "AiSuggestion"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "MediaEntry" ADD CONSTRAINT "MediaEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaEntry" ADD CONSTRAINT "MediaEntry_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MediaList" ADD CONSTRAINT "MediaList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MediaList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScrobbleConfig" ADD CONSTRAINT "ScrobbleConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
