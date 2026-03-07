import { PrismaClient } from '@prisma/client'
import type { ABSClient } from './abs-client'

// Shape of the ABS `user_item_progress_updated` Socket.IO event.
// ABS emits the MediaProgress object flat — no nested wrapper.
interface ABSProgressEvent {
  id: string           // ABS progress record ID
  libraryItemId: string
  episodeId?: string | null  // set for podcast episodes; null/absent for audiobooks
  userId: string       // ABS user ID (not Vellum)
  duration: number     // seconds
  progress: number     // 0–1
  currentTime: number
  isFinished: boolean
  hideFromContinueListening?: boolean
  currentChapter?: {
    id: string
    start: number
    end: number
    title: string
  } | null
  startedAt: number    // unix ms
  lastUpdate: number   // unix ms
  finishedAt?: number | null
}

function progressToStatus(progress: number, isFinished: boolean): 'WANT' | 'IN_PROGRESS' | 'COMPLETED' {
  if (isFinished || progress >= 0.99) return 'COMPLETED'
  if (progress > 0) return 'IN_PROGRESS'
  return 'WANT'
}

/**
 * Strategy 1: look up by absLibraryItemId stored on MediaItem.
 * Strategy 2: fetch ABS item metadata and try a case-insensitive title match.
 * Returns the MediaItem or null if no match found.
 */
async function findMediaItem(
  prisma: PrismaClient,
  abs: ABSClient,
  libraryItemId: string
) {
  // Strategy 1: direct ABS ID match
  const byId = await prisma.mediaItem.findFirst({
    where: { absLibraryItemId: libraryItemId },
  })
  if (byId) return byId

  // Strategy 2: fetch metadata from ABS and try title match
  try {
    const details = await abs.getItemDetails(libraryItemId)
    const title = details.media.metadata.title?.trim()
    if (!title) return null

    const byTitle = await prisma.mediaItem.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
        type: { in: ['AUDIOBOOK', 'BOOK'] },
      },
    })

    if (byTitle) {
      // Backfill absLibraryItemId so future lookups are instant
      await prisma.mediaItem.update({
        where: { id: byTitle.id },
        data: { absLibraryItemId: libraryItemId },
      })
      return byTitle
    }

    // Strategy 3: create a new AUDIOBOOKSHELF media item
    const newItem = await prisma.mediaItem.create({
      data: {
        type: 'AUDIOBOOK',
        externalId: libraryItemId,
        source: 'AUDIOBOOKSHELF',
        absLibraryItemId: libraryItemId,
        title,
        metadata: {},
      },
    })
    return newItem
  } catch (err) {
    console.error('[sync] Failed to resolve ABS item details:', err)
    return null
  }
}

/**
 * Main handler for ABS `user_item_progress_updated` events.
 * Finds or creates the matching Vellum entry and upserts ListeningProgress.
 */
export async function syncProgress(
  prisma: PrismaClient,
  abs: ABSClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawEvent: any
): Promise<void> {
  const event = rawEvent as ABSProgressEvent
  const { libraryItemId, episodeId, progress, currentTime, duration, isFinished, currentChapter } = event

  // Skip podcast episodes
  if (episodeId) return

  const mediaItem = await findMediaItem(prisma, abs, libraryItemId)
  if (!mediaItem) {
    console.warn(`[sync] Could not resolve media item for ABS library item ${libraryItemId}`)
    return
  }

  // Find a MediaEntry for this item (any user — single-instance ABS setup)
  // Prefer the most recent entry to handle edge cases with multiple users
  const entry = await prisma.mediaEntry.findFirst({
    where: { mediaItemId: mediaItem.id },
    orderBy: { updatedAt: 'desc' },
  })

  if (!entry) {
    console.info(`[sync] No Vellum entry for media item ${mediaItem.id} (${mediaItem.title}), skipping`)
    return
  }

  const newStatus = progressToStatus(progress, isFinished)

  // Update entry status if it changed (don't downgrade COMPLETED → IN_PROGRESS)
  const statusRank = { WANT: 0, IN_PROGRESS: 1, COMPLETED: 2, DROPPED: 3 }
  const currentRank = statusRank[entry.status as keyof typeof statusRank] ?? 0
  const newRank = statusRank[newStatus]

  await prisma.$transaction(async (tx) => {
    if (newRank > currentRank) {
      await tx.mediaEntry.update({
        where: { id: entry.id },
        data: {
          status: newStatus,
          ...(newStatus === 'IN_PROGRESS' && !entry.startedAt ? { startedAt: new Date() } : {}),
          ...(newStatus === 'COMPLETED' && !entry.completedAt ? { completedAt: new Date() } : {}),
        },
      })
    }

    // Upsert listening progress
    await tx.listeningProgress.upsert({
      where: { mediaEntryId: entry.id },
      create: {
        mediaEntryId: entry.id,
        progress,
        currentTime,
        duration,
        currentChapter: currentChapter?.title ?? null,
        lastSyncedAt: new Date(),
      },
      update: {
        progress,
        currentTime,
        duration,
        currentChapter: currentChapter?.title ?? null,
        lastSyncedAt: new Date(),
      },
    })
  })

  console.log(
    `[sync] Updated progress for "${mediaItem.title}": ${Math.round(progress * 100)}% (${newStatus})`
  )
}
