import { io, Socket } from 'socket.io-client'
import { config } from './config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (data: any) => void

export class ABSClient {
  private socket: Socket | null = null
  private token: string | null = null

  async connect(): Promise<void> {
    // API keys (Settings → API Keys) work for HTTP but are rejected by ABS socket
    // auth, which only validates user JWT tokens. Call /api/me with the configured
    // credential to resolve the user's JWT token for socket auth.
    // When ABS adds native API key support for sockets, the fallback handles it.
    this.token = config.absToken
    try {
      const meRes = await fetch(`${config.absUrl}/api/me`, {
        headers: { Authorization: `Bearer ${config.absToken}` },
      })
      if (meRes.ok) {
        const me = await meRes.json() as { user?: { token?: string } }
        if (me.user?.token) {
          this.token = me.user.token
          console.log('[ABS] Resolved JWT token from /api/me for socket auth')
        }
      } else {
        console.warn(`[ABS] /api/me returned ${meRes.status}, falling back to configured token`)
      }
    } catch (err) {
      console.warn('[ABS] Could not reach /api/me, falling back to configured token:', err)
    }

    // Socket.IO connection with resolved JWT token in auth
    this.socket = io(config.absUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 5000,
      auth: { token: this.token },
    })

    this.socket.on('connect', () => {
      console.log('[ABS] Socket connected, authenticating...')
      this.socket!.emit('auth', this.token)
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
    if (!this.token) throw new Error('Not authenticated')
    const res = await fetch(`${config.absUrl}/api/items/${libraryItemId}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    })
    if (!res.ok) throw new Error(`Failed to fetch ABS item ${libraryItemId}: ${res.status}`)
    return res.json()
  }
}
