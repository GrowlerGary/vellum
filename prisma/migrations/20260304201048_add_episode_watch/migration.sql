-- CreateTable
CREATE TABLE "EpisodeWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "showExternalId" TEXT NOT NULL,
    "episodeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EpisodeWatch_userId_showExternalId_idx" ON "EpisodeWatch"("userId", "showExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeWatch_userId_episodeId_key" ON "EpisodeWatch"("userId", "episodeId");

-- AddForeignKey
ALTER TABLE "EpisodeWatch" ADD CONSTRAINT "EpisodeWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
