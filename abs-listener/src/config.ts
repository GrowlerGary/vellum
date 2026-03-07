export const config = {
  databaseUrl: process.env.DATABASE_URL || '',
  absUrl: process.env.ABS_URL || '',
  absToken: process.env.ABS_TOKEN || '',
}

/** Returns true if ABS integration is enabled (ABS_URL is set). */
export function isEnabled(): boolean {
  return Boolean(config.absUrl)
}

export function validateConfig() {
  const required = ['databaseUrl', 'absUrl', 'absToken'] as const
  const missing = required.filter((k) => !config[k])
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }
}
