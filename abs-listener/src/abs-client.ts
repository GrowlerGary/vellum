import { io, Socket } from 'socket.io-client'
import { config } from './config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (data: any) => void

export class ABSClient {
  private socket: Socket | null = null
  // socketToken: JWT used only for socket auth (ABS socket only accepts user JWTs)
  private socketToken: string | null = null

  async connect(): Promise<void> {
    // API keys (Settings → API Keys) work for HTTP but ABS socket auth only
    // validates user JWT tokens. Exchange via /api/me to get the user JWT.
    // The API key is kept separate and used for all HTTP API calls — using the
    // refresh JWT for HTTP causes ABS to attempt (and fail) session refreshes.
    this.socketToken = config.absToken  // fallback if /api/me fails
    try {
      const meRes = await fetch(`${config.absUrl}/api/me`, {
        headers: { Authorization: `Bearer ${config.absToken}` },
      })
      if (meRes.ok) {
        const me = await meRes.json() as { token?: string }
        if (me.token) {
          this.socketToken = me.token
          console.log('[ABS] Resolved JWT token from /api/me for socket auth')
        }
      } else {
        console.warn(`[ABS] /api/me returned ${meRes.status}, falling back to API key for socket auth`)
      }
    } catch (err) {
      console.warn('[ABS] Could not reach /api/me, falling back to API key for socket auth:', err)
    }

    // Socket.IO connection — JWT in auth header for the initial handshake
    this.socket = io(config.absUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 5000,
      auth: { token: this.socketToken },
    })

    this.socket.on('connect', () => {
      console.log('[ABS] Socket connected, authenticating...')
      this.socket!.emit('auth', this.socketToken)
    })

    this.socket.on('init', () => {
      console.log('[ABS] Authenticated successfully')
    })

    this.socket.on('connect_error', (err: Error) => {
      console.error('[ABS] Connection error:', err.message)
    })

    this.socket.on('disconnect', (reason: string) => {
      console.warn('[ABS] Disconnected:', reason)
    })
  }

  onProgressUpdate(handler: AnyHandler): void {
    if (!this.socket) throw new Error('Not connected — call connect() first')
    this.socket.on('user_item_progress_updated', handler)
  }

  async getItemDetails(libraryItemId: string): Promise<{
    id: string
    media: {
      metadata: {
        title: string
        authorName?: string
        seriesName?: string
      }
      duration?: number
    }
  }> {
    // Use the API key directly for HTTP — avoids ABS session-refresh errors
    // that occur when the socket JWT (a refresh token) is used as Bearer.
    const res = await fetch(`${config.absUrl}/api/items/${libraryItemId}`, {
      headers: { Authorization: `Bearer ${config.absToken}` },
    })
    if (!res.ok) throw new Error(`Failed to fetch ABS item ${libraryItemId}: ${res.status}`)
    return res.json()
  }
}
