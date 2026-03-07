import { validateConfig, config } from './config'
import { ABSClient } from './abs-client'
import { syncProgress } from './sync'
import { PrismaClient } from '@prisma/client'

async function main() {
  validateConfig()

  const prisma = new PrismaClient({
    datasources: { db: { url: config.databaseUrl } },
  })
  const abs = new ABSClient()

  console.log('[ABS-Listener] Starting...')
  await abs.connect()

  abs.onProgressUpdate(async (event) => {
    try {
      await syncProgress(prisma, abs, event)
    } catch (err) {
      console.error('[ABS-Listener] Sync error:', err)
    }
  })

  console.log('[ABS-Listener] Listening for progress updates')
}

main().catch((err) => {
  console.error('[ABS-Listener] Fatal error:', err)
  process.exit(1)
})
