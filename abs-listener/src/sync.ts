import { PrismaClient, Prisma } from '@prisma/client'
import type { ABSClient } from './abs-client'

// Outer wrapper of the ABS `user_item_progress_updated` Socket.IO event.
// The actual MediaProgress data is nested under the `data` key.
interface ABSProgressEventWrapper {
  id: string
  sessionId?: string
  deviceDescription?: string
  data: ABSProgressEvent
}

// Shape of the MediaProgress object (nested under the `data` key of the event wrapper).
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
 * Strip common audiobook qualifiers that ABS appends but Vellum/Hardcover omit.
 * e.g. "The Hard Line (Unabridged)" → "The Hard Line"
 */
function normalizeTitle(title: string): string {
  return title
    .replace(/\s*\(unabridged\)/gi, '')
    .replace(/\s*\(abridged\)/gi, '')
    .replace(/\s*[-–—]\s*unabridged$/gi, '')
    .replace(/\s*[-–—]\s*abridged$/gi, '')
    .trim()
}

/**
 * Strategy 1: look up by absLibraryItemId stored on MediaItem.
 * Strategy 2: fetch ABS item metadata; try exact normalized title match,
 *             then a broader contains-based fallback.
 * Strategy 3: create a new AUDIOBOOKSHELF MediaItem if nothing matched.
 * Returns the MediaItem or null on unrecoverable error.
 */
async function findMediaItem(
  prisma: PrismaClient,
  abs: ABSClient,
  libraryItemId: string
) {
  // Strategy 1: direct ABS ID match (fast path after first sync)
  const byId = await prisma.mediaItem.findFirst({
    where: { absLibraryItemId: libraryItemId },
  })
  if (byId) {
    console.log(`[sync] Strategy 1 matched: "${byId.title}" (${byId.id})`)
    return byId
  }

  // Strategy 2: fetch ABS title and match against Vellum
  try {
    const details = await abs.getItemDetails(libraryItemId)
    const rawTitle = details.media.metadata.title?.trim()
    if (!rawTitle) return null

    const normalizedTitle = normalizeTitle(rawTitle)
    console.log(`[sync] ABS title: "${rawTitle}" → normalized: "${normalizedTitle}"`)

    // 2a: exact match on normalized title
    let byTitle = await prisma.mediaItem.findFirst({
      where: {
        title: { equals: normalizedTitle, mode: 'insensitive' },
        type: { in: ['AUDIOBOOK', 'BOOK'] },
      },
    })

    // 2b: contains fallback (handles subtitle differences)
    if (!byTitle && normalizedTitle.length > 3) {
      byTitle = await prisma.mediaItem.findFirst({
        where: {
          title: { contains: normalizedTitle, mode: 'insensitive' },
          type: { in: ['AUDIOBOOK', 'BOOK'] },
        },
        orderBy: { updatedAt: 'desc' },
      })
    }

    if (byTitle) {
      console.log(`[sync] Strategy 2 matched: "${byTitle.title}" (${byTitle.id})`)
      // Backfill absLibraryItemId so future lookups hit Strategy 1
      await prisma.mediaItem.update({
        where: { id: byTitle.id },
        data: { absLibraryItemId: libraryItemId },
      })
      return byTitle
    }

    // Strategy 3: create a new AUDIOBOOKSHELF media item
    console.log(`[sync] No match for "${normalizedTitle}" — creating new MediaItem`)
    const newItem = await prisma.mediaItem.create({
      data: {
        type: 'AUDIOBOOK',
        externalId: libraryItemId,
        source: 'AUDIOBOOKSHELF',
        absLibraryItemId: libraryItemId,
        title: normalizedTitle, // store the clean title, not the "(Unabridged)" version
        metadata: {},
      },
    })
    console.log(`[sync] Created new MediaItem: "${newItem.title}" (${newItem.id})`)
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
  const event = (rawEvent as ABSProgressEventWrapper).data
  const { libraryItemId, episodeId, progress, currentTime, duration, isFinished, currentChapter } = event

  // Skip podcast episodes
  if (episodeId) return

  const mediaItem = await findMediaItem(prisma, abs, libraryItemId)
  if (!mediaItem) {
    console.warn(`[sync] Could not resolve media item for ABS library item ${libraryItemId}`)
    return
  }

  const newStatus = progressToStatus(progress, isFinished)

  // Find a MediaEntry for this item (any user — single-instance ABS setup)
  // Prefer the most recent entry to handle edge cases with multiple users
  let entry = await prisma.mediaEntry.findFirst({
    where: { mediaItemId: mediaItem.id },
    orderBy: { updatedAt: 'desc' },
  })

  if (!entry) {
    // Auto-create a MediaEntry rather than skipping — single-user ABS setup assumption
    console.info(`[sync] No entry for "${mediaItem.title}" — auto-creating with status ${newStatus}`)
    const user = await prisma.user.findFirst()
    if (!user) {
      console.warn('[sync] No Vellum users in DB — cannot auto-create entry')
      return
    }
    entry = await prisma.mediaEntry.create({
      data: {
        mediaItemId: mediaItem.id,
        userId: user.id,
        status: newStatus,
        sortOrder: 0,
        ...(newStatus === 'IN_PROGRESS' ? { startedAt: new Date() } : {}),
        ...(newStatus === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
    })
    console.log(`[sync] Auto-created entry ${entry.id} for "${mediaItem.title}"`)
  }

  // Update entry status if it changed (don't downgrade COMPLETED → IN_PROGRESS)
  const statusRank = { WANT: 0, IN_PROGRESS: 1, COMPLETED: 2, DROPPED: 3 }
  const currentRank = statusRank[entry.status as keyof typeof statusRank] ?? 0
  const newRank = statusRank[newStatus]

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
