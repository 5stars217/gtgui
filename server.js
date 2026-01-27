import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { execSync, exec } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { setupAuth, getSessionMiddleware } from './src/server/auth.js'
import { MultiplayerServer } from './src/server/multiplayer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const httpServer = createServer(app)

app.use(cors({
  origin: true,
  credentials: true
}))

// Only parse JSON for API routes
app.use('/api', express.json({ limit: '1mb' }))
app.use('/auth', express.json())

// Setup authentication
const sessionMiddleware = getSessionMiddleware()
app.use(sessionMiddleware)
const { users: authUsers } = setupAuth(app)

// Setup multiplayer WebSocket
const multiplayer = new MultiplayerServer(httpServer, sessionMiddleware)

const GT_PATH = process.env.GT_PATH || '/opt/homebrew/bin/gt'
const TOWN_ROOT = process.env.TOWN_ROOT || `${process.env.HOME}/gt`

// Helper to run gt commands
function gt(args, cwd = TOWN_ROOT) {
  try {
    const result = execSync(`${GT_PATH} ${args}`, {
      cwd,
      encoding: 'utf-8',
      timeout: 30000,
      shell: true,  // Use default shell
      env: { ...process.env, GT_TOWN_ROOT: TOWN_ROOT }
    })
    return result
  } catch (e) {
    console.error(`gt ${args} failed:`, e.message)
    return null
  }
}

// Parse JSON output from gt commands
function gtJson(args, cwd = TOWN_ROOT) {
  const result = gt(`${args} --json`, cwd)
  if (!result) return null
  try {
    return JSON.parse(result)
  } catch {
    return null
  }
}

// GET /api/status - Overall town status
app.get('/api/status', (req, res) => {
  const status = {}

  // Get rig list
  const rigs = gtJson('rig list')
  status.rigs = rigs || []

  // Get convoy status
  const convoys = gtJson('convoy list')
  status.activeConvoys = convoys?.length || 0
  status.convoys = convoys || []

  // Get polecats across all rigs
  status.polecats = []
  if (rigs) {
    for (const rig of rigs) {
      const polecats = getPolecatsForRig(rig.name || rig)
      status.polecats.push(...polecats)
    }
  }

  // Placeholder for tokens (would come from costs)
  status.tokens = 0
  status.openIssues = status.polecats.filter(p => p.hook).length

  // Broadcast state update to connected clients
  multiplayer.broadcastStateUpdate(status)

  res.json(status)
})

// GET /api/rigs - List all rigs
app.get('/api/rigs', (req, res) => {
  const rigs = gtJson('rig list') || []
  res.json(rigs)
})

// POST /api/rigs - Create a new rig
app.post('/api/rigs', (req, res) => {
  const { name } = req.body
  if (!name) {
    return res.status(400).json({ error: 'Rig name required' })
  }

  // Validate name (alphanumeric, dashes, underscores only)
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return res.status(400).json({ error: 'Invalid rig name. Use alphanumeric, dashes, or underscores.' })
  }

  const result = gt(`rig create ${name}`)
  if (result !== null) {
    // Broadcast new rig to all connected users
    multiplayer.broadcastStateUpdate({ event: 'rig:created', rig: name })
    res.json({ success: true, name })
  } else {
    res.status(500).json({ error: 'Failed to create rig' })
  }
})

// POST /api/rigs/:name/clone - Clone a repo into a rig
app.post('/api/rigs/:name/clone', (req, res) => {
  const { name } = req.params
  const { repo, branch } = req.body

  if (!repo) {
    return res.status(400).json({ error: 'Repository URL required' })
  }

  // Ensure rig directory exists
  const rigPath = join(TOWN_ROOT, name)
  try {
    execSync(`mkdir -p "${rigPath}"`, { encoding: 'utf-8', shell: true })
  } catch (e) {
    console.error('Failed to create rig directory:', e.message)
    return res.status(500).json({ error: 'Failed to create rig directory' })
  }

  // Try gt clone first, fallback to git clone
  const branchArg = branch ? `--branch ${branch}` : ''
  let result = gt(`clone ${repo} ${branchArg}`, rigPath)

  // Fallback to direct git clone if gt clone fails
  if (result === null) {
    try {
      const gitBranchArg = branch ? `-b ${branch}` : ''
      result = execSync(`git clone ${gitBranchArg} "${repo}" .`, {
        cwd: rigPath,
        encoding: 'utf-8',
        timeout: 120000,  // 2 min timeout for large repos
        shell: true
      })
    } catch (e) {
      console.error('Git clone failed:', e.message)
      return res.status(500).json({ error: `Failed to clone: ${e.message}` })
    }
  }

  multiplayer.broadcastStateUpdate({ event: 'repo:cloned', rig: name, repo })
  res.json({ success: true, repo })
})

// POST /api/rigs/:name/polecats - Spawn a new polecat in a rig
app.post('/api/rigs/:name/polecats', (req, res) => {
  const { name } = req.params
  const { polecatName } = req.body

  const pcName = polecatName || `polecat-${Date.now()}`
  const result = gt(`polecat spawn ${pcName}`, join(TOWN_ROOT, name))

  if (result !== null) {
    multiplayer.broadcastStateUpdate({ event: 'polecat:spawned', rig: name, polecat: pcName })
    res.json({ success: true, name: pcName })
  } else {
    res.status(500).json({ error: 'Failed to spawn polecat' })
  }
})

// GET /api/rigs/:name/polecats - Get polecats for a rig
app.get('/api/rigs/:name/polecats', (req, res) => {
  const polecats = getPolecatsForRig(req.params.name)
  res.json(polecats)
})

// GET /api/convoys - List convoys
app.get('/api/convoys', (req, res) => {
  const convoys = gtJson('convoy list --all') || []
  res.json(convoys)
})

// GET /api/convoys/:id - Convoy details
app.get('/api/convoys/:id', (req, res) => {
  const status = gtJson(`convoy status ${req.params.id}`)
  if (status) {
    res.json(status)
  } else {
    res.status(404).json({ error: 'Convoy not found' })
  }
})

// POST /api/sling - Sling work to agent
app.post('/api/sling', (req, res) => {
  const { agent, issue } = req.body
  if (!agent || !issue) {
    return res.status(400).json({ error: 'Missing agent or issue' })
  }

  const result = gt(`sling ${issue} --to ${agent}`)
  if (result) {
    res.json({ success: true, message: result })
  } else {
    res.status(500).json({ error: 'Sling failed' })
  }
})

// POST /api/mail/send - Send mail
app.post('/api/mail/send', (req, res) => {
  const { to, subject, message } = req.body
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing recipient or message' })
  }

  const subjectArg = subject ? `-s "${subject}"` : ''
  const result = gt(`mail send ${to} ${subjectArg} -m "${message}"`)
  if (result !== null) {
    res.json({ success: true })
  } else {
    res.status(500).json({ error: 'Mail send failed' })
  }
})

// GET /api/agents/:id/hook - Get agent's current hook
app.get('/api/agents/:id/hook', (req, res) => {
  const result = gt(`hook --agent ${req.params.id}`)
  res.json({ hook: result?.trim() || null })
})

// POST /api/agents/:id/stop - Emergency stop
app.post('/api/agents/:id/stop', (req, res) => {
  const result = gt(`stop ${req.params.id}`)
  res.json({ success: result !== null })
})

// GET /api/costs - Get running costs
app.get('/api/costs', (req, res) => {
  const costs = gtJson('costs')
  res.json(costs || { total: 0, breakdown: [] })
})

// GET /api/feed - Live activity feed (SSE)
app.get('/api/feed', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Poll gt feed and stream
  const interval = setInterval(() => {
    const feedLine = gt('feed --once 2>/dev/null') || ''
    if (feedLine.trim()) {
      res.write(`data: ${JSON.stringify({ event: feedLine.trim() })}\n\n`)
    }
  }, 1000)

  req.on('close', () => {
    clearInterval(interval)
  })
})

// Helper: Get polecats for a specific rig
function getPolecatsForRig(rigName) {
  const polecats = []
  const rigPath = join(TOWN_ROOT, rigName, 'polecats')

  try {
    const sessions = execSync(`tmux list-sessions -F "#{session_name}" 2>/dev/null || true`, {
      encoding: 'utf-8'
    })

    for (const session of sessions.split('\n').filter(Boolean)) {
      if (session.includes(rigName) && session.includes('polecat')) {
        // Extract polecat name from session
        const parts = session.split('-')
        const name = parts[parts.length - 1]

        // Try to get hook status
        const hookResult = gt(`hook --agent ${rigName}/polecats/${name}`)
        const hook = hookResult?.trim() || null

        polecats.push({
          name,
          rig: rigName,
          session,
          status: hook ? 'working' : 'idle',
          hook
        })
      }
    }
  } catch (e) {
    // No tmux sessions
  }

  return polecats
}

// Static files
app.use(express.static(join(__dirname, 'dist')))

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message)
  res.status(500).json({ error: err.message })
})

const PORT = process.env.PORT || 8080
httpServer.listen(PORT, () => {
  console.log(`Gas Town UI server running at http://localhost:${PORT}`)
  console.log(`Town root: ${TOWN_ROOT}`)
  console.log(`GT binary: ${GT_PATH}`)
  console.log(`WebSocket enabled for multiplayer`)
  if (!process.env.GITHUB_CLIENT_ID) {
    console.log(`GitHub OAuth: Not configured (dev mode enabled)`)
  } else {
    console.log(`GitHub OAuth: Configured`)
  }
})
