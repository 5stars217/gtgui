import { io } from 'socket.io-client'

export class MultiplayerClient {
  constructor() {
    this.socket = null
    this.connected = false
    this.selfId = null
    this.users = new Map()
    this.eventHandlers = new Map()

    // Throttle cursor updates (50ms = 20/sec)
    this.cursorThrottleMs = 50
    this.lastCursorUpdate = 0
    this.pendingCursor = null
  }

  async connect() {
    return new Promise((resolve, reject) => {
      // Connect to same origin
      this.socket = io({
        withCredentials: true,
        transports: ['websocket', 'polling']
      })

      this.socket.on('connect', () => {
        console.log('[Multiplayer] Connected to server')
        this.connected = true
        this.emit('connected')
      })

      this.socket.on('disconnect', (reason) => {
        console.log('[Multiplayer] Disconnected:', reason)
        this.connected = false
        this.emit('disconnected', reason)
      })

      this.socket.on('connect_error', (error) => {
        console.error('[Multiplayer] Connection error:', error.message)
        this.emit('error', error)
        reject(error)
      })

      // Room state (on initial join)
      this.socket.on('room:state', (data) => {
        this.selfId = data.selfId
        this.users.clear()
        data.users.forEach(user => {
          if (user.id !== this.selfId) {
            this.users.set(user.id, user)
          }
        })
        console.log('[Multiplayer] Room state:', this.users.size, 'other users')
        this.emit('roomState', data)
        resolve()
      })

      // User events
      this.socket.on('user:join', (user) => {
        console.log('[Multiplayer] User joined:', user.name)
        this.users.set(user.id, user)
        this.emit('userJoin', user)
      })

      this.socket.on('user:leave', (data) => {
        const user = this.users.get(data.id)
        if (user) {
          console.log('[Multiplayer] User left:', user.name)
          this.users.delete(data.id)
          this.emit('userLeave', user)
        }
      })

      // Presence updates
      this.socket.on('presence', (data) => {
        const user = this.users.get(data.userId)
        if (user) {
          if (data.cursor) {
            user.cursor = data.cursor
          }
          if (data.selection) {
            user.selection = data.selection
          }
          this.emit('presence', { user, ...data })
        }
      })

      // State updates
      this.socket.on('state:update', (data) => {
        this.emit('stateUpdate', data)
      })

      // Feed events
      this.socket.on('feed:event', (data) => {
        this.emit('feedEvent', data)
      })
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
    }
  }

  // Send cursor position (throttled)
  sendCursor(x, y) {
    const now = Date.now()
    this.pendingCursor = { x, y }

    if (now - this.lastCursorUpdate >= this.cursorThrottleMs) {
      this.flushCursor()
    } else if (!this.cursorTimer) {
      this.cursorTimer = setTimeout(() => {
        this.flushCursor()
        this.cursorTimer = null
      }, this.cursorThrottleMs - (now - this.lastCursorUpdate))
    }
  }

  flushCursor() {
    if (this.pendingCursor && this.socket?.connected) {
      this.socket.emit('cursor:move', this.pendingCursor)
      this.lastCursorUpdate = Date.now()
      this.pendingCursor = null
    }
  }

  // Send selection change
  sendSelection(unitIds) {
    if (this.socket?.connected) {
      this.socket.emit('selection', { ids: unitIds })
    }
  }

  // Send commands (V2)
  sendCommand(type, data) {
    if (this.socket?.connected) {
      this.socket.emit(`command:${type}`, data)
    }
  }

  // Event handling
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event).push(handler)
    return () => this.off(event, handler)
  }

  off(event, handler) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(h => h(data))
    }
  }

  // Get current user list (excluding self)
  getUsers() {
    return Array.from(this.users.values())
  }

  // Get user by ID
  getUser(id) {
    return this.users.get(id)
  }

  // Check if connected
  isConnected() {
    return this.connected
  }
}

// Singleton instance
let instance = null

export function getMultiplayerClient() {
  if (!instance) {
    instance = new MultiplayerClient()
  }
  return instance
}
