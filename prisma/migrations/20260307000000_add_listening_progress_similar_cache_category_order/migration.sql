-- AlterEnum: add AUDIOBOOKSHELF to MetadataSource
ALTER TYPE "MetadataSource" ADD VALUE 'AUDIOBOOKSHELF';

-- AlterTable: add categoryOrder to User
ALTER TABLE "User" ADD COLUMN "categoryOrder" TEXT[] NOT NULL DEFAULT ARRAY['MOVIE', 'TV_SHOW', 'BOOK', 'AUDIOBOOK', 'VIDEO_GAME']::TEXT[];

-- AlterTable: add absLibraryItemId to MediaItem
ALTER TABLE "MediaItem" ADD COLUMN "absLibraryItemId" TEXT;

-- CreateTable: ListeningProgress
CREATE TABLE "ListeningProgress" (
    "id" TEXT NOT NULL,
    "mediaEntryId" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL,
    "currentTime" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "currentChapter" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SimilarItemCache
CREATE TABLE "SimilarItemCache" (
    "id" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimilarItemCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListeningProgress_mediaEntryId_key" ON "ListeningProgress"("mediaEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "SimilarItemCache_mediaItemId_key" ON "SimilarItemCache"("mediaItemId");

-- AddForeignKey
ALTER TABLE "ListeningProgress" ADD CONSTRAINT "ListeningProgress_mediaEntryId_fkey" FOREIGN KEY ("mediaEntryId") REFERENCES "MediaEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimilarItemCache" ADD CONSTRAINT "SimilarItemCache_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
