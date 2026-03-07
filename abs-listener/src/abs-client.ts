import { io, Socket } from 'socket.io-client'
import { config } from './config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (data: any) => void

export class ABSClient {
  private socket: Socket | null = null
  private token: string | null = null

  async connect(): Promise<void> {
    // Use the API key directly as the bearer token — no login round-trip needed
    this.token = config.absApiKey

    // Socket.IO connection with API key as bearer token in auth
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
