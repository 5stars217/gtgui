import { Server } from 'socket.io'

// User colors pool (6 distinct colors)
const USER_COLORS = [
  { name: 'red', hex: '#E74C3C' },
  { name: 'green', hex: '#2ECC71' },
  { name: 'blue', hex: '#3498DB' },
  { name: 'purple', hex: '#9B59B6' },
  { name: 'orange', hex: '#E67E22' },
  { name: 'pink', hex: '#E91E8C' }
]

export class MultiplayerServer {
  constructor(httpServer, sessionMiddleware) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    // Room state: users in the default room
    this.users = new Map()
    this.colorIndex = 0

    // Throttle presence updates
    this.presenceThrottleMs = 50 // 20 updates/sec max

    // Wrap session middleware for Socket.io
    const wrap = middleware => (socket, next) =>
      middleware(socket.request, {}, next)

    this.io.use(wrap(sessionMiddleware))

    // Authenticate socket connections
    this.io.use((socket, next) => {
      const session = socket.request.session
      if (session?.passport?.user) {
        // Authenticated user
        socket.userId = session.passport.user
        next()
      } else if (process.env.NODE_ENV !== 'production') {
        // Allow anonymous in dev mode
        socket.userId = `anon-${socket.id.substring(0, 8)}`
        next()
      } else {
        next(new Error('Authentication required'))
      }
    })

    this.setupEventHandlers()
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`[Multiplayer] User connected: ${socket.userId}`)

      // Auto-join default room
      this.handleJoin(socket)

      // Cursor movement (throttled by client)
      socket.on('cursor:move', (data) => {
        this.handleCursorMove(socket, data)
      })

      // Selection change
      socket.on('selection', (data) => {
        this.handleSelection(socket, data)
      })

      // Commands (V2 - pass through for now)
      socket.on('command:sling', (data) => {
        this.handleCommand(socket, 'sling', data)
      })

      socket.on('command:mail', (data) => {
        this.handleCommand(socket, 'mail', data)
      })

      socket.on('command:stop', (data) => {
        this.handleCommand(socket, 'stop', data)
      })

      // Disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket)
      })
    })
  }

  handleJoin(socket) {
    const user = this.createUserState(socket)
    this.users.set(socket.userId, user)
    socket.join('town')

    // Send current room state to new user
    socket.emit('room:state', {
      users: this.getUserList(),
      selfId: socket.userId
    })

    // Broadcast new user to others
    socket.to('town').emit('user:join', {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      color: user.color
    })

    console.log(`[Multiplayer] User joined: ${user.name} (${user.color.name})`)
  }

  createUserState(socket) {
    // Get user info from session if available
    const session = socket.request.session
    const passportUser = session?.passport?.user

    // Try to get stored user data
    let name = socket.userId
    let avatar = null

    // If we have passport session, the user data should be serialized
    // For now, use socket.userId as name
    if (passportUser && typeof passportUser === 'object') {
      name = passportUser.displayName || passportUser.username || socket.userId
      avatar = passportUser.avatar
    }

    // Assign color
    const color = USER_COLORS[this.colorIndex % USER_COLORS.length]
    this.colorIndex++

    return {
      id: socket.userId,
      socketId: socket.id,
      name,
      avatar,
      color,
      cursor: { x: 0, y: 0 },
      selection: [],
      lastUpdate: Date.now()
    }
  }

  handleCursorMove(socket, data) {
    const user = this.users.get(socket.userId)
    if (!user) return

    user.cursor = { x: data.x, y: data.y }
    user.lastUpdate = Date.now()

    // Broadcast to others
    socket.to('town').emit('presence', {
      userId: socket.userId,
      cursor: user.cursor
    })
  }

  handleSelection(socket, data) {
    const user = this.users.get(socket.userId)
    if (!user) return

    user.selection = data.ids || []
    user.lastUpdate = Date.now()

    // Broadcast to others
    socket.to('town').emit('presence', {
      userId: socket.userId,
      selection: user.selection
    })
  }

  handleCommand(socket, type, data) {
    // V2: Queue and execute commands
    // For now, just broadcast the command event
    this.io.to('town').emit('feed:event', {
      timestamp: Date.now(),
      event: type,
      user: socket.userId,
      data
    })
  }

  handleDisconnect(socket) {
    const user = this.users.get(socket.userId)
    if (user) {
      this.users.delete(socket.userId)

      // Broadcast user left
      this.io.to('town').emit('user:leave', {
        id: socket.userId
      })

      console.log(`[Multiplayer] User left: ${user.name}`)
    }
  }

  getUserList() {
    return Array.from(this.users.values()).map(u => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      color: u.color,
      cursor: u.cursor,
      selection: u.selection
    }))
  }

  // Broadcast gastown state update to all users
  broadcastStateUpdate(data) {
    this.io.to('town').emit('state:update', { data })
  }
}
