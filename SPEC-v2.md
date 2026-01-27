# Gas Town Club Penguin v2 - Spec

## Overview

Next iteration focusing on **agentic workflow management** - making it easy to monitor, alert, and direct penguin workers through the Club Penguin interface.

---

## 1. Enhanced Login & User Profiles

### 1.1 Login Methods
| Method | Description |
|--------|-------------|
| GitHub OAuth | Primary auth, links to repos |
| API Key | For programmatic access |
| Team Invite | Join via invite link |

### 1.2 User Profile & Preferences
```
User Profile:
├── Display name & avatar (from GitHub or custom)
├── Notification preferences
│   ├── Desktop notifications (on/off)
│   ├── Sound alerts (on/off)
│   ├── Email digest (daily/weekly/off)
│   └── Slack/Discord webhook URL
├── Alert thresholds (personal defaults)
│   ├── Idle timeout: X minutes
│   ├── Task timeout: X minutes
│   └── Token spend limit: X tokens
└── Assigned villages (which projects they manage)
```

### 1.3 Team/Org Support
- Multiple users can view the same town
- Assign penguins to specific users
- Activity log shows who did what

---

## 2. Polecat Status & Monitoring

### 2.1 Enhanced Status States
```
Polecat States:
├── idle          → Available, waiting for work (green)
├── working       → Actively processing (blue, animated)
├── stuck         → Hit a blocker, needs help (red, pulsing)
├── waiting       → Waiting for external input (yellow)
├── reviewing     → PR submitted, awaiting review (purple)
├── overtime      → Exceeded time threshold (orange, warning)
├── overspend     → Exceeded token threshold (orange, warning)
└── offline       → Tmux session dead (gray)
```

### 2.2 Visual Indicators on Map
| State | Visual Effect |
|-------|---------------|
| idle | Gentle breathing animation, occasional look-around |
| working | Typing animation, progress sparkles |
| stuck | Red exclamation bubble, worried jitter |
| waiting | Thought bubble with "...", foot tap |
| reviewing | Clipboard sprite, checking animation |
| overtime | Orange glow, clock icon above head |
| overspend | Orange glow, coin icon above head |
| offline | Grayed out, "zzz" above head |

### 2.3 Status Detail Panel
When clicking a polecat, show:
```
┌─────────────────────────────────────┐
│ [Avatar]  GOOSE                     │
│           Working on #123           │
├─────────────────────────────────────┤
│ ⏱ Time:    45m / 60m threshold     │
│ [████████████░░░░] 75%              │
│                                     │
│ 🪙 Tokens:  12,450 / 50,000 limit   │
│ [██████░░░░░░░░░░] 25%              │
│                                     │
│ 📊 Progress: Planning → Coding      │
│ 📝 Last activity: 2m ago            │
│ 🔗 Issue: #123 - Fix auth bug       │
├─────────────────────────────────────┤
│ [View Logs] [Send Message] [Stop]   │
└─────────────────────────────────────┘
```

---

## 3. Alert & Notification System

### 3.1 Alert Types
| Alert | Trigger | Default | Configurable |
|-------|---------|---------|--------------|
| `idle_too_long` | Polecat idle > X minutes | 10 min | Yes |
| `task_timeout` | Working on same task > X minutes | 60 min | Yes |
| `token_limit` | Token spend > X | 50,000 | Yes |
| `stuck` | Polecat reports blocker | Immediate | No |
| `error` | Crash or exception | Immediate | No |
| `pr_ready` | PR submitted for review | Immediate | No |
| `pr_merged` | PR merged successfully | Immediate | No |

### 3.2 Notification UI
```
┌─────────────────────────────────────────┐
│ 🔔 NOTIFICATIONS                    [X] │
├─────────────────────────────────────────┤
│ 🔴 2m ago - GOOSE is stuck on #123      │
│    "Can't find the auth module"         │
│    [View] [Help] [Reassign]             │
├─────────────────────────────────────────┤
│ 🟠 5m ago - NUX exceeded time limit     │
│    Working 75m on #456 (limit: 60m)     │
│    [View] [Extend] [Stop]               │
├─────────────────────────────────────────┤
│ 🟢 10m ago - FURIOSA completed #789     │
│    PR #42 merged successfully           │
│    [View PR] [Assign More]              │
└─────────────────────────────────────────┘
```

### 3.3 Notification Bell
- Bell icon in top bar with badge count
- Click to open notification panel
- Desktop notifications (with permission)
- Sound effects (configurable):
  - `stuck` → Worried penguin sound
  - `complete` → Celebration jingle
  - `overtime` → Clock chime

### 3.4 Notification Webhook
```javascript
// POST to configured webhook URL
{
  "type": "stuck",
  "polecat": "goose",
  "village": "artemis",
  "issue": "#123",
  "message": "Can't find the auth module",
  "timestamp": "2024-01-15T10:30:00Z",
  "link": "https://gastown.app/village/artemis/polecat/goose"
}
```

---

## 4. Threshold Configuration

### 4.1 Global Defaults (Admin)
```
Settings → Global Thresholds
├── Default idle timeout: 10 minutes
├── Default task timeout: 60 minutes
├── Default token limit: 50,000 tokens
├── Auto-reassign on stuck: Off
└── Auto-stop on overspend: Off
```

### 4.2 Per-Village Overrides
```
Village: ARTEMIS → Settings
├── Task timeout: 120 minutes (complex project)
├── Token limit: 100,000 tokens
└── Alert recipients: @adrian, @team-leads
```

### 4.3 Per-Polecat Overrides
```
Polecat: GOOSE → Settings
├── Task timeout: 30 minutes (quick tasks only)
├── Token limit: 25,000 tokens
└── Auto-reassign to: NUX (if stuck > 5m)
```

### 4.4 Per-Task Overrides
When slinging work:
```
Mayor Chat:
You: "Assign #123 to goose with 2 hour timeout"
Mayor: "Got it! Goose is working on #123 with a 2 hour limit."
```

---

## 5. Work Queue & Assignment

### 5.1 Work Queue Panel
```
┌─────────────────────────────────────────┐
│ 📋 WORK QUEUE                       [+] │
├─────────────────────────────────────────┤
│ Priority │ Issue    │ Assignee │ Status │
├──────────┼──────────┼──────────┼────────┤
│ 🔴 High  │ #123     │ GOOSE    │ Stuck  │
│ 🟡 Med   │ #456     │ NUX      │ Working│
│ 🟡 Med   │ #789     │ -        │ Queued │
│ 🟢 Low   │ #101     │ -        │ Queued │
└─────────────────────────────────────────┘
```

### 5.2 Auto-Assignment Rules
```
Rules:
├── Round-robin: Distribute evenly across idle polecats
├── Skill-based: Match issue labels to polecat specialties
├── Load-based: Assign to least-busy polecat
└── Priority: High priority issues go to senior polecats
```

### 5.3 Drag & Drop Assignment
- Drag issue from queue to polecat on map
- Drag polecat to another village to transfer
- Visual feedback during drag

### 5.4 Bulk Operations
```
Select multiple polecats → Right click menu:
├── Assign same issue (swarm mode)
├── Stop all selected
├── Send message to all
└── Move to village
```

---

## 6. Progress Tracking

### 6.1 Task Progress Phases
```
Phases (auto-detected from agent output):
1. 📖 Understanding - Reading issue, exploring code
2. 📝 Planning - Designing solution
3. 💻 Coding - Writing implementation
4. 🧪 Testing - Running tests
5. 📤 Submitting - Creating PR
6. 🔄 Revising - Addressing review feedback
7. ✅ Complete - PR merged
```

### 6.2 Progress Bar on Polecat
- Small progress bar under polecat sprite
- Color matches current phase
- Tooltip shows phase name

### 6.3 Activity Timeline
```
GOOSE - Issue #123 Timeline:
├── 10:00 - Started working
├── 10:05 - Reading issue description
├── 10:12 - Exploring codebase (found 3 files)
├── 10:20 - Planning approach
├── 10:25 - Started coding
├── 10:45 - ⚠️ Hit blocker: "Can't find auth module"
├── 10:46 - 🔴 Status: STUCK
└── Now - Awaiting help
```

---

## 7. Mayor Chat Enhancements

### 7.1 New Commands
```
Work Management:
- "Queue #123, #456, #789" → Add multiple issues
- "Prioritize #123" → Move to top of queue
- "Swarm #123" → Assign multiple polecats
- "Stop all in artemis" → Halt village workers

Monitoring:
- "Who's stuck?" → List stuck polecats
- "Who's idle?" → List available polecats
- "Status report" → Summary of all activity
- "Show overtime" → List exceeded thresholds

Configuration:
- "Set timeout 2 hours for goose" → Per-polecat
- "Set token limit 100k for artemis" → Per-village
- "Alert me on slack" → Configure webhook
```

### 7.2 Proactive Mayor Alerts
Mayor speaks up automatically:
```
Mayor: "🔴 Heads up! Goose has been stuck for 5 minutes.
        They say: 'Can't find the auth module'

        [Help Goose] [Reassign] [Ignore]"
```

### 7.3 Quick Actions from Chat
```
Mayor: "NUX just finished #456! 🎉
        They're now idle. Want me to:

        [Assign next in queue]
        [Assign specific issue]
        [Let them rest]"
```

---

## 8. API Extensions

### 8.1 New Endpoints
```
GET  /api/alerts                    # List active alerts
POST /api/alerts/:id/dismiss        # Dismiss alert
GET  /api/queue                     # Work queue
POST /api/queue                     # Add to queue
POST /api/queue/reorder             # Reorder queue
GET  /api/polecats/:id/timeline     # Activity timeline
GET  /api/polecats/:id/metrics      # Time & token stats
POST /api/settings/thresholds       # Update thresholds
GET  /api/notifications             # User notifications
POST /api/webhooks                  # Configure webhook
```

### 8.2 WebSocket Events
```javascript
// New real-time events
socket.on('alert:new', (alert) => {})
socket.on('alert:dismissed', (alertId) => {})
socket.on('polecat:status', (polecatId, status) => {})
socket.on('polecat:progress', (polecatId, phase, percent) => {})
socket.on('queue:updated', (queue) => {})
socket.on('threshold:exceeded', (polecatId, type) => {})
```

---

## 9. Data Model Updates

### 9.1 Polecat Schema
```javascript
{
  id: "goose",
  rig: "artemis",
  status: "working",
  currentTask: {
    issueId: "#123",
    startedAt: "2024-01-15T10:00:00Z",
    phase: "coding",
    progress: 65
  },
  metrics: {
    timeSpent: 2700,      // seconds
    tokensUsed: 12450,
    lastActivity: "2024-01-15T10:45:00Z"
  },
  thresholds: {
    taskTimeout: 3600,    // seconds (1 hour)
    tokenLimit: 50000,
    idleTimeout: 600      // seconds (10 min)
  },
  alerts: ["overtime"],
  timeline: [...]
}
```

### 9.2 Alert Schema
```javascript
{
  id: "alert-123",
  type: "stuck",
  polecatId: "goose",
  villageId: "artemis",
  message: "Can't find the auth module",
  severity: "high",
  createdAt: "2024-01-15T10:46:00Z",
  dismissedAt: null,
  dismissedBy: null
}
```

### 9.3 Notification Preferences
```javascript
{
  userId: "adrian",
  desktop: true,
  sound: true,
  email: "daily",
  webhookUrl: "https://hooks.slack.com/...",
  alertTypes: {
    stuck: true,
    overtime: true,
    overspend: true,
    complete: true,
    idle: false
  }
}
```

---

## 10. Implementation Phases

### Phase 1: Core Monitoring (Week 1)
- [ ] Enhanced polecat status states
- [ ] Visual indicators on map
- [ ] Status detail panel
- [ ] Basic time tracking

### Phase 2: Alerts & Notifications (Week 2)
- [ ] Alert system backend
- [ ] Notification panel UI
- [ ] Desktop notifications
- [ ] Sound effects

### Phase 3: Thresholds & Config (Week 3)
- [ ] Global threshold settings
- [ ] Per-village overrides
- [ ] Per-polecat overrides
- [ ] Settings UI

### Phase 4: Work Queue (Week 4)
- [ ] Queue panel UI
- [ ] Drag & drop assignment
- [ ] Auto-assignment rules
- [ ] Bulk operations

### Phase 5: Mayor Intelligence (Week 5)
- [ ] Proactive alerts in chat
- [ ] New chat commands
- [ ] Quick action buttons
- [ ] Status reports

### Phase 6: Webhooks & API (Week 6)
- [ ] Webhook configuration
- [ ] New API endpoints
- [ ] WebSocket events
- [ ] External integrations

---

## 11. UI Mockups

### 11.1 Enhanced Top Bar
```
┌────────────────────────────────────────────────────────────────────┐
│ 🪙 1,234  🐟 5  📜 3  │  PENGUIN TOWN  │  👥 3 online  🔔(2)  ⚙️  │
└────────────────────────────────────────────────────────────────────┘
                                                         ↑
                                              Notification bell
                                              with alert count
```

### 11.2 Polecat with Alerts
```
        ⏰ (overtime icon)
         │
    ┌────┴────┐
    │ GOOSE   │  ← Name plate turns orange
    │  🐧     │  ← Orange glow effect
    │ ████░░  │  ← Progress bar
    └─────────┘
```

### 11.3 Work Queue Sidebar
```
┌─────────────────┐
│ 📋 QUEUE    [+] │
├─────────────────┤
│ 🔴 #123 → GOOSE │
│ 🟡 #456 → NUX   │
│ ┈┈┈ UNASSIGNED ┈┈┈│
│ 🟡 #789         │
│ 🟢 #101         │
│ 🟢 #102         │
├─────────────────┤
│ [Auto-assign]   │
└─────────────────┘
```

---

## 12. Sound Design

| Event | Sound | File |
|-------|-------|------|
| New alert | Soft chime | `alert.mp3` |
| Stuck | Worried "bwah" | `stuck.mp3` |
| Complete | Celebration | `complete.mp3` |
| Overtime | Clock tick | `overtime.mp3` |
| Message | Pop | `message.mp3` |
| Error | Buzzer | `error.mp3` |

All sounds should be:
- Short (< 2 seconds)
- Non-intrusive
- Club Penguin style (playful)

---

## Summary

This spec transforms Gas Town from a visualization tool into a **full workflow management system** where:

1. **Users know instantly** when penguins need attention
2. **Thresholds are configurable** per project, polecat, or task
3. **Work flows smoothly** through queue and auto-assignment
4. **Mayor is proactive** about alerting and suggesting actions
5. **Integrations** allow alerts to flow to Slack/Discord/email

The Club Penguin aesthetic remains central - alerts feel playful not stressful, and managing AI agents feels like running a cozy penguin village.
