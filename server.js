import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { execSync, exec } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
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

// Settings storage
const SETTINGS_FILE = join(TOWN_ROOT, 'settings.json')
const DEFAULT_SETTINGS = {
  stuckTokenThreshold: 25000,      // tokens before marked stuck
  stuckTimeThreshold: 1800000,     // 30 minutes in ms
  warningTokenThreshold: 20000,    // 80% - yellow warning
  warningTimeThreshold: 1440000,   // 24 minutes - 80%
  enableSounds: true,
  enableNotifications: true
}

// Load settings from file or use defaults
function loadSettings() {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const content = readFileSync(SETTINGS_FILE, 'utf-8')
      return { ...DEFAULT_SETTINGS, ...JSON.parse(content) }
    }
  } catch (e) {
    console.error('Failed to load settings:', e.message)
  }
  return { ...DEFAULT_SETTINGS }
}

// Save settings to file
function saveSettings(settings) {
  try {
    const dir = dirname(SETTINGS_FILE)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    return true
  } catch (e) {
    console.error('Failed to save settings:', e.message)
    return false
  }
}

let currentSettings = loadSettings()

// Check for stuck agents based on token and time thresholds
function checkForStuckAgents() {
  const now = Date.now()
  const rigs = listRigs()
  const notifications = []

  for (const rig of rigs) {
    const polecatsPath = join(TOWN_ROOT, rig.name, 'polecats')

    try {
      const dirs = execSync(`ls -1 "${polecatsPath}" 2>/dev/null || true`, {
        encoding: 'utf-8'
      }).trim()

      if (!dirs) continue

      for (const name of dirs.split('\n').filter(Boolean)) {
        const statusFile = join(polecatsPath, name, 'status.json')

        try {
          if (!existsSync(statusFile)) continue

          const content = readFileSync(statusFile, 'utf-8')
          const status = JSON.parse(content)

          // Only check working agents
          if (status.status !== 'working') continue

          const assignedAt = status.assignedAt ? new Date(status.assignedAt).getTime() : now
          const elapsed = now - assignedAt
          const tokensUsed = status.tokensUsed || 0

          // Check if either threshold exceeded
          const timeExceeded = elapsed > currentSettings.stuckTimeThreshold
          const tokensExceeded = tokensUsed > currentSettings.stuckTokenThreshold

          if (timeExceeded || tokensExceeded) {
            // Mark as stuck
            status.status = 'stuck'
            status.stuckReason = timeExceeded ? 'time' : 'tokens'
            status.stuckAt = new Date().toISOString()
            writeFileSync(statusFile, JSON.stringify(status, null, 2))

            notifications.push({
              type: 'stuck',
              agent: name,
              rig: rig.name,
              reason: status.stuckReason,
              elapsed,
              tokensUsed,
              message: timeExceeded
                ? `${name} has been working for over ${Math.round(elapsed / 60000)} minutes`
                : `${name} has used over ${tokensUsed.toLocaleString()} tokens`
            })
          }
          // Check for warning thresholds (80%)
          else {
            const timeWarning = elapsed > currentSettings.warningTimeThreshold
            const tokenWarning = tokensUsed > currentSettings.warningTokenThreshold

            if ((timeWarning || tokenWarning) && !status.warningNotified) {
              status.warningNotified = true
              writeFileSync(statusFile, JSON.stringify(status, null, 2))

              notifications.push({
                type: 'warning',
                agent: name,
                rig: rig.name,
                elapsed,
                tokensUsed,
                message: `${name} is approaching limits (${Math.round(elapsed / 60000)}min / ${tokensUsed} tokens)`
              })
            }
          }
        } catch (e) {
          // Parse error, skip this polecat
        }
      }
    } catch (e) {
      // No polecats directory
    }
  }

  // Broadcast notifications
  for (const notification of notifications) {
    multiplayer.broadcastNotification(notification)
  }

  return notifications
}

// Run stuck detection every 30 seconds
setInterval(checkForStuckAgents, 30000)

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

// Helper to list rigs from directory
function listRigs() {
  try {
    const dirs = execSync(`ls -1 "${TOWN_ROOT}" 2>/dev/null || true`, {
      encoding: 'utf-8'
    }).trim()

    if (!dirs) return []

    // Filter to only directories that look like rigs (not hidden, not special)
    const rigs = []
    for (const name of dirs.split('\n').filter(Boolean)) {
      if (name.startsWith('.') || name === 'plugins' || name === 'settings') continue
      const rigPath = join(TOWN_ROOT, name)
      try {
        const stat = execSync(`test -d "${rigPath}" && echo "dir" || echo "file"`, {
          encoding: 'utf-8'
        }).trim()
        if (stat === 'dir') {
          rigs.push({ name, path: rigPath })
        }
      } catch (e) {
        // Skip
      }
    }
    return rigs
  } catch (e) {
    return []
  }
}

// GET /api/status - Overall town status
app.get('/api/status', (req, res) => {
  const status = {}

  // Get rig list from directory
  const rigs = listRigs()
  status.rigs = rigs

  // Get convoy status (skip if gt doesn't support it)
  status.activeConvoys = 0
  status.convoys = []

  // Get polecats across all rigs
  status.polecats = []
  for (const rig of rigs) {
    const polecats = getPolecatsForRig(rig.name)
    status.polecats.push(...polecats)
  }

  // Placeholder for tokens (would come from costs)
  status.tokens = 0
  status.openIssues = status.polecats.filter(p => p.status === 'stuck').length

  // Broadcast state update to connected clients
  multiplayer.broadcastStateUpdate(status)

  res.json(status)
})

// GET /api/rigs - List all rigs
app.get('/api/rigs', (req, res) => {
  const rigs = listRigs()
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

  // Create rig directory (gt rig create doesn't exist, so we just mkdir)
  const rigPath = join(TOWN_ROOT, name)
  try {
    execSync(`mkdir -p "${rigPath}"`, { encoding: 'utf-8', shell: true })
    // Broadcast new rig to all connected users
    multiplayer.broadcastStateUpdate({ event: 'rig:created', rig: name })
    res.json({ success: true, name })
  } catch (e) {
    console.error('Failed to create rig:', e.message)
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

  // Extract repo name from URL for subdirectory
  const repoName = repo.split('/').pop().replace('.git', '') || 'repo'

  // Ensure rig directory exists
  const rigPath = join(TOWN_ROOT, name)
  const clonePath = join(rigPath, repoName)

  try {
    execSync(`mkdir -p "${rigPath}"`, { encoding: 'utf-8', shell: true })
  } catch (e) {
    console.error('Failed to create rig directory:', e.message)
    return res.status(500).json({ error: 'Failed to create rig directory' })
  }

  // Check if clone path already exists
  try {
    const exists = execSync(`test -d "${clonePath}" && echo "exists" || echo "no"`, {
      encoding: 'utf-8',
      shell: true
    }).trim()

    if (exists === 'exists') {
      // Directory exists - check if it's a git repo and pull instead
      try {
        execSync(`cd "${clonePath}" && git pull`, {
          encoding: 'utf-8',
          timeout: 60000,
          shell: true
        })
        multiplayer.broadcastStateUpdate({ event: 'repo:updated', rig: name, repo })
        return res.json({ success: true, repo, action: 'pulled' })
      } catch (pullErr) {
        // Pull failed, remove and re-clone
        execSync(`rm -rf "${clonePath}"`, { encoding: 'utf-8', shell: true })
      }
    }
  } catch (e) {
    // Directory doesn't exist, proceed with clone
  }

  // Try gt clone first, fallback to git clone
  const branchArg = branch ? `--branch ${branch}` : ''
  let result = gt(`clone ${repo} ${branchArg}`, rigPath)

  // Fallback to direct git clone if gt clone fails
  if (result === null) {
    try {
      const gitBranchArg = branch ? `-b ${branch}` : ''
      result = execSync(`git clone ${gitBranchArg} "${repo}"`, {
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
  const rigPath = join(TOWN_ROOT, name)
  const polecatPath = join(rigPath, 'polecats', pcName)

  // Create polecat directory (gt polecat spawn doesn't exist)
  try {
    // Create polecat directory and status file
    if (!existsSync(polecatPath)) {
      mkdirSync(polecatPath, { recursive: true })
    }
    const initialStatus = {
      status: 'idle',
      created: new Date().toISOString()
    }
    writeFileSync(join(polecatPath, 'status.json'), JSON.stringify(initialStatus, null, 2))
    multiplayer.broadcastStateUpdate({ event: 'polecat:spawned', rig: name, polecat: pcName })
    res.json({ success: true, name: pcName })
  } catch (e) {
    console.error('Failed to spawn polecat:', e.message)
    res.status(500).json({ error: 'Failed to spawn polecat' })
  }
})

// GET /api/rigs/:name/polecats - Get polecats for a rig
app.get('/api/rigs/:name/polecats', (req, res) => {
  const polecats = getPolecatsForRig(req.params.name)
  res.json(polecats)
})

// DELETE /api/rigs/:name - Delete a rig (for testing cleanup)
app.delete('/api/rigs/:name', (req, res) => {
  const { name } = req.params

  // Safety check - only allow deletion of test rigs
  if (!name.startsWith('test-')) {
    return res.status(403).json({ error: 'Can only delete test rigs (prefix: test-)' })
  }

  const rigPath = join(TOWN_ROOT, name)

  try {
    if (existsSync(rigPath)) {
      execSync(`rm -rf "${rigPath}"`, { encoding: 'utf-8', shell: true })
      multiplayer.broadcastStateUpdate({ event: 'rig:deleted', rig: name })
      res.json({ success: true, deleted: name })
    } else {
      res.status(404).json({ error: 'Rig not found' })
    }
  } catch (e) {
    console.error('Failed to delete rig:', e.message)
    res.status(500).json({ error: 'Failed to delete rig' })
  }
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

  // Parse agent path (e.g., "rigname/polecats/polecatname" or just "polecatname")
  const parts = agent.split('/')
  let rigName, polecatName
  if (parts.length >= 3) {
    rigName = parts[0]
    polecatName = parts[parts.length - 1]
  } else {
    polecatName = agent
    rigName = 'default'
  }

  // Update polecat status to working
  const statusPath = join(TOWN_ROOT, rigName, 'polecats', polecatName, 'status.json')
  try {
    const status = {
      status: 'working',
      issue: issue,
      assignedAt: new Date().toISOString(),
      progress: 0
    }
    // Use Node.js fs to avoid shell escaping issues with special characters
    const statusDir = dirname(statusPath)
    if (!existsSync(statusDir)) {
      mkdirSync(statusDir, { recursive: true })
    }
    writeFileSync(statusPath, JSON.stringify(status, null, 2))

    // Broadcast status update
    multiplayer.broadcastStateUpdate({
      event: 'polecat:working',
      rig: rigName,
      polecat: polecatName,
      issue: issue
    })

    res.json({ success: true, message: `Assigned ${issue} to ${polecatName}`, status })
  } catch (e) {
    console.error('Sling failed:', e.message)
    res.status(500).json({ error: 'Sling failed: ' + e.message })
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

// GET /api/agents/:id/hook - Get agent's current task/status
app.get('/api/agents/:id/hook', (req, res) => {
  // Parse agent ID - could be "rig/polecats/name" or just "name"
  const agentId = req.params.id
  const parts = agentId.split('/')

  let rigName, polecatName
  if (parts.length >= 3) {
    rigName = parts[0]
    polecatName = parts[parts.length - 1]
  } else {
    polecatName = agentId
    // Search all rigs for this polecat
    const rigs = listRigs()
    for (const rig of rigs) {
      const statusPath = join(TOWN_ROOT, rig.name, 'polecats', polecatName, 'status.json')
      if (existsSync(statusPath)) {
        try {
          const content = readFileSync(statusPath, 'utf-8')
          const status = JSON.parse(content)
          res.json({
            hook: status.issue || status.task || null,
            status: status.status,
            assignedAt: status.assignedAt,
            progress: status.progress || 0
          })
          return
        } catch (e) {
          // Parse error, continue
        }
      }
    }
    res.json({ hook: null, status: 'unknown' })
    return
  }

  // Read status from file
  const statusPath = join(TOWN_ROOT, rigName, 'polecats', polecatName, 'status.json')
  if (existsSync(statusPath)) {
    try {
      const content = readFileSync(statusPath, 'utf-8')
      const status = JSON.parse(content)
      res.json({
        hook: status.issue || status.task || null,
        status: status.status,
        assignedAt: status.assignedAt,
        progress: status.progress || 0
      })
    } catch (e) {
      res.json({ hook: null, status: 'idle' })
    }
  } else {
    res.json({ hook: null, status: 'idle' })
  }
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

// GET /api/settings - Get current settings
app.get('/api/settings', (req, res) => {
  res.json(currentSettings)
})

// POST /api/settings - Update settings
app.post('/api/settings', (req, res) => {
  const newSettings = { ...currentSettings, ...req.body }

  // Validate thresholds
  if (newSettings.stuckTokenThreshold < 1000) newSettings.stuckTokenThreshold = 1000
  if (newSettings.stuckTokenThreshold > 500000) newSettings.stuckTokenThreshold = 500000
  if (newSettings.stuckTimeThreshold < 60000) newSettings.stuckTimeThreshold = 60000  // Min 1 minute
  if (newSettings.stuckTimeThreshold > 7200000) newSettings.stuckTimeThreshold = 7200000  // Max 2 hours

  // Calculate warning thresholds as 80% of stuck thresholds
  newSettings.warningTokenThreshold = Math.round(newSettings.stuckTokenThreshold * 0.8)
  newSettings.warningTimeThreshold = Math.round(newSettings.stuckTimeThreshold * 0.8)

  if (saveSettings(newSettings)) {
    currentSettings = newSettings
    multiplayer.broadcastStateUpdate({ event: 'settings:updated', settings: currentSettings })
    res.json({ success: true, settings: currentSettings })
  } else {
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

// POST /api/agents/:id/reassign - Reassign work to another agent
app.post('/api/agents/:id/reassign', (req, res) => {
  const { newAgent, rig: targetRig } = req.body
  const oldAgentId = req.params.id

  if (!newAgent) {
    return res.status(400).json({ error: 'New agent ID required' })
  }

  // Parse old agent ID
  const oldParts = oldAgentId.split('/')
  let oldRig, oldPolecat
  if (oldParts.length >= 3) {
    oldRig = oldParts[0]
    oldPolecat = oldParts[oldParts.length - 1]
  } else {
    oldPolecat = oldAgentId
    // Find the rig containing this polecat
    const rigs = listRigs()
    for (const r of rigs) {
      const statusPath = join(TOWN_ROOT, r.name, 'polecats', oldPolecat, 'status.json')
      if (existsSync(statusPath)) {
        oldRig = r.name
        break
      }
    }
  }

  if (!oldRig) {
    return res.status(404).json({ error: 'Old agent not found' })
  }

  // Read old agent's current task
  const oldStatusPath = join(TOWN_ROOT, oldRig, 'polecats', oldPolecat, 'status.json')
  let oldStatus
  try {
    const content = readFileSync(oldStatusPath, 'utf-8')
    oldStatus = JSON.parse(content)
  } catch (e) {
    return res.status(404).json({ error: 'Could not read old agent status' })
  }

  const task = oldStatus.issue || oldStatus.task
  if (!task) {
    return res.status(400).json({ error: 'Old agent has no task to reassign' })
  }

  // Parse new agent ID
  const newParts = newAgent.split('/')
  let newRig, newPolecat
  if (newParts.length >= 3) {
    newRig = newParts[0]
    newPolecat = newParts[newParts.length - 1]
  } else {
    newPolecat = newAgent
    newRig = targetRig || oldRig  // Default to same rig
  }

  // Update old agent to idle
  const newOldStatus = {
    status: 'idle',
    previousTask: task,
    reassignedAt: new Date().toISOString(),
    reassignedTo: newPolecat
  }
  writeFileSync(oldStatusPath, JSON.stringify(newOldStatus, null, 2))

  // Update new agent to working
  const newStatusPath = join(TOWN_ROOT, newRig, 'polecats', newPolecat, 'status.json')
  const newStatus = {
    status: 'working',
    issue: task,
    assignedAt: new Date().toISOString(),
    reassignedFrom: oldPolecat,
    progress: 0
  }

  try {
    const statusDir = dirname(newStatusPath)
    if (!existsSync(statusDir)) {
      mkdirSync(statusDir, { recursive: true })
    }
    writeFileSync(newStatusPath, JSON.stringify(newStatus, null, 2))
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update new agent status' })
  }

  // Broadcast updates
  multiplayer.broadcastStateUpdate({
    event: 'polecat:reassigned',
    from: { rig: oldRig, polecat: oldPolecat },
    to: { rig: newRig, polecat: newPolecat },
    task
  })

  multiplayer.broadcastNotification({
    type: 'info',
    message: `Task reassigned from ${oldPolecat} to ${newPolecat}`,
    agent: newPolecat,
    rig: newRig
  })

  res.json({
    success: true,
    message: `Reassigned "${task}" from ${oldPolecat} to ${newPolecat}`,
    oldAgent: { rig: oldRig, polecat: oldPolecat, status: 'idle' },
    newAgent: { rig: newRig, polecat: newPolecat, status: 'working', task }
  })
})

// POST /api/agents/:id/complete - Mark task as complete (manual override)
app.post('/api/agents/:id/complete', (req, res) => {
  const agentId = req.params.id

  // Parse agent ID
  const parts = agentId.split('/')
  let rigName, polecatName
  if (parts.length >= 3) {
    rigName = parts[0]
    polecatName = parts[parts.length - 1]
  } else {
    polecatName = agentId
    // Find the rig
    const rigs = listRigs()
    for (const r of rigs) {
      const statusPath = join(TOWN_ROOT, r.name, 'polecats', polecatName, 'status.json')
      if (existsSync(statusPath)) {
        rigName = r.name
        break
      }
    }
  }

  if (!rigName) {
    return res.status(404).json({ error: 'Agent not found' })
  }

  const statusPath = join(TOWN_ROOT, rigName, 'polecats', polecatName, 'status.json')

  try {
    const content = readFileSync(statusPath, 'utf-8')
    const oldStatus = JSON.parse(content)

    const newStatus = {
      status: 'idle',
      completedTask: oldStatus.issue || oldStatus.task,
      completedAt: new Date().toISOString(),
      created: oldStatus.created
    }

    writeFileSync(statusPath, JSON.stringify(newStatus, null, 2))

    multiplayer.broadcastStateUpdate({
      event: 'polecat:completed',
      rig: rigName,
      polecat: polecatName,
      task: oldStatus.issue
    })

    multiplayer.broadcastNotification({
      type: 'success',
      message: `${polecatName} completed: ${oldStatus.issue || 'task'}`,
      agent: polecatName,
      rig: rigName
    })

    res.json({ success: true, agent: polecatName, completedTask: oldStatus.issue })
  } catch (e) {
    res.status(500).json({ error: 'Failed to mark complete: ' + e.message })
  }
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
  const polecatsPath = join(TOWN_ROOT, rigName, 'polecats')

  try {
    // List polecat directories
    const dirs = execSync(`ls -1 "${polecatsPath}" 2>/dev/null || true`, {
      encoding: 'utf-8'
    }).trim()

    if (!dirs) return polecats

    for (const name of dirs.split('\n').filter(Boolean)) {
      const statusFile = join(polecatsPath, name, 'status.json')
      let status = { status: 'idle' }

      try {
        const content = execSync(`cat "${statusFile}" 2>/dev/null || echo '{}'`, {
          encoding: 'utf-8'
        })
        status = JSON.parse(content) || { status: 'idle' }
      } catch (e) {
        // No status file, default to idle
      }

      polecats.push({
        name,
        rig: rigName,
        status: status.status || 'idle',
        issue: status.issue || null,
        assignedAt: status.assignedAt || null,
        progress: status.progress || 0,
        tokensUsed: status.tokensUsed || 0,
        stuckReason: status.stuckReason || null,
        stuckAt: status.stuckAt || null,
        created: status.created || null
      })
    }
  } catch (e) {
    // No polecats directory
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
