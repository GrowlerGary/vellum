export const config = {
  databaseUrl: process.env.DATABASE_URL || '',
  absUrl: process.env.ABS_URL || '',
  absUsername: process.env.ABS_USERNAME || '',
  absPassword: process.env.ABS_PASSWORD || '',
}

export function validateConfig() {
  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }
}
