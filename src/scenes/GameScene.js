import Phaser from 'phaser'
import { GasTownAPI } from '../api/GasTownAPI.js'
import { getMultiplayerClient } from '../multiplayer/MultiplayerClient.js'

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' })
    this.api = new GasTownAPI()
    this.units = new Map()
    this.buildings = new Map()
    this.selectedUnits = []
    this.mapWidth = 40  // Larger map for multiple villages
    this.mapHeight = 40
    // 2x tile dimensions for enhanced sprites
    this.tileWidth = 128
    this.tileHeight = 64

    // Multiplayer state
    this.multiplayer = null
    this.otherUsers = new Map() // userId -> { cursor, selections, sprites }

    // Multi-village support
    this.villages = []
    this.villageSpacing = 12 // Grid units between village centers
  }

  create() {
    // Club Penguin sky blue background
    this.cameras.main.setBackgroundColor(0x87CEEB)
    // Adjusted zoom for 2x sprites (was 1.5, now 1.0)
    this.cameras.main.setZoom(1.0)
    this.setupCameraControls()

    // Create isometric map
    this.createMap()

    // Add enhanced snow particle effect
    this.createSnowParticles()

    // Create building layer
    this.buildingLayer = this.add.container(0, 0)

    // Create unit layer (above buildings)
    this.unitLayer = this.add.container(0, 0)

    // Effects layer (for dust, sparkles)
    this.effectsLayer = this.add.container(0, 0)
    this.effectsLayer.setDepth(400)

    // Multiplayer: cursor layer (above units)
    this.cursorLayer = this.add.container(0, 0)
    this.cursorLayer.setDepth(500)

    // Selection box
    this.selectionBox = this.add.graphics()
    this.selectionStart = null

    // Input handlers
    this.setupInput()

    // Load initial state
    this.loadTownState()

    // Start UI scene in parallel
    this.scene.launch('UIScene', { gameScene: this })

    // Initialize multiplayer
    this.initMultiplayer()

    // Poll for updates (reduced frequency since WebSocket provides real-time updates)
    this.time.addEvent({
      delay: 5000,
      callback: () => this.refreshState(),
      loop: true
    })
  }

  async initMultiplayer() {
    this.multiplayer = getMultiplayerClient()

    // Register handlers BEFORE connecting to avoid race condition
    this.multiplayer.on('userJoin', (user) => this.addOtherUser(user))
    this.multiplayer.on('userLeave', (user) => this.removeOtherUser(user))
    this.multiplayer.on('presence', (data) => this.updatePresence(data))
    this.multiplayer.on('roomState', (data) => {
      // Add existing users
      data.users.forEach(user => {
        if (user.id !== data.selfId) {
          this.addOtherUser(user)
        }
      })
      // Emit users update to UI
      this.events.emit('multiplayerConnected', this.multiplayer)
    })

    try {
      await this.multiplayer.connect()
      console.log('[GameScene] Multiplayer connected')
    } catch (e) {
      console.warn('[GameScene] Multiplayer connection failed:', e.message)
    }
  }

  addOtherUser(user) {
    if (this.otherUsers.has(user.id)) return

    // Create cursor sprite
    const cursorKey = `cursor-${user.color.name}`
    const cursor = this.add.image(0, 0, cursorKey)
    cursor.setOrigin(0, 0)
    cursor.setVisible(false)
    cursor.setDepth(1)

    // Create name label
    const nameLabel = this.add.text(16, 0, user.name, {
      font: 'bold 12px Fredoka',
      fill: user.color.hex,
      stroke: '#FFFFFF',
      strokeThickness: 3
    })
    nameLabel.setOrigin(0, 0.5)
    nameLabel.setVisible(false)

    this.cursorLayer.add([cursor, nameLabel])

    // Store user state
    this.otherUsers.set(user.id, {
      user,
      cursor,
      nameLabel,
      selectionRings: new Map() // unitId -> ring sprite
    })

    console.log(`[GameScene] Added user: ${user.name}`)
    this.events.emit('usersUpdated', this.getConnectedUsers())
  }

  removeOtherUser(user) {
    const userData = this.otherUsers.get(user.id)
    if (!userData) return

    // Clean up sprites
    userData.cursor.destroy()
    userData.nameLabel.destroy()
    userData.selectionRings.forEach(ring => ring.destroy())

    this.otherUsers.delete(user.id)
    console.log(`[GameScene] Removed user: ${user.name}`)
    this.events.emit('usersUpdated', this.getConnectedUsers())
  }

  updatePresence(data) {
    const userData = this.otherUsers.get(data.userId)
    if (!userData) return

    // Update cursor position
    if (data.cursor) {
      userData.cursor.setPosition(data.cursor.x, data.cursor.y)
      userData.cursor.setVisible(true)
      userData.nameLabel.setPosition(data.cursor.x + 20, data.cursor.y + 10)
      userData.nameLabel.setVisible(true)
    }

    // Update selections
    if (data.selection) {
      this.updateOtherUserSelection(userData, data.selection)
    }
  }

  updateOtherUserSelection(userData, selectedIds) {
    const color = userData.user.color.name
    const ringKey = `selection-ring-${color}`

    // Remove rings for deselected units
    userData.selectionRings.forEach((ring, unitId) => {
      if (!selectedIds.includes(unitId)) {
        ring.destroy()
        userData.selectionRings.delete(unitId)
      }
    })

    // Add rings for newly selected units
    selectedIds.forEach(unitId => {
      if (!userData.selectionRings.has(unitId)) {
        const unit = this.units.get(unitId)
        if (unit) {
          const ring = this.add.image(0, 4, ringKey)
          ring.setOrigin(0.5, 0.5)
          unit.add(ring)
          unit.sendToBack(ring)
          userData.selectionRings.set(unitId, ring)
        }
      }
    })
  }

  getConnectedUsers() {
    const users = []
    this.otherUsers.forEach(userData => {
      users.push(userData.user)
    })
    return users
  }

  createSnowParticles() {
    // Create multiple snowflake textures for variety
    for (let size = 0; size < 3; size++) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      const s = 6 + size * 3
      // Soft glow
      g.fillStyle(0xFFFFFF, 0.3)
      g.fillCircle(s, s, s - 1)
      // Core
      g.fillStyle(0xFFFFFF, 0.9)
      g.fillCircle(s, s, (s - 1) * 0.6)
      g.generateTexture(`snowflake-${size}`, s * 2, s * 2)
      g.destroy()
    }

    // Enhanced snow particle emitter with multiple sizes
    this.snowParticles = this.add.particles(0, 0, 'snowflake-1', {
      x: { min: -300, max: this.cameras.main.width + 300 },
      y: -60,
      lifespan: 10000,
      speedY: { min: 20, max: 50 },
      speedX: { min: -30, max: 30 },
      scale: { start: 0.8, end: 0.3 },
      alpha: { start: 0.8, end: 0 },
      rotate: { min: 0, max: 360 },
      frequency: 150,
      quantity: 1
    })
    this.snowParticles.setScrollFactor(0)
    this.snowParticles.setDepth(1000)

    // Add smaller background snow
    this.snowParticlesBg = this.add.particles(0, 0, 'snowflake-0', {
      x: { min: -200, max: this.cameras.main.width + 200 },
      y: -40,
      lifespan: 12000,
      speedY: { min: 15, max: 35 },
      speedX: { min: -20, max: 20 },
      scale: { start: 0.5, end: 0.2 },
      alpha: { start: 0.5, end: 0 },
      rotate: { min: 0, max: 360 },
      frequency: 250,
      quantity: 1
    })
    this.snowParticlesBg.setScrollFactor(0)
    this.snowParticlesBg.setDepth(999)

    // Add larger foreground snow (rare)
    this.snowParticlesFg = this.add.particles(0, 0, 'snowflake-2', {
      x: { min: -100, max: this.cameras.main.width + 100 },
      y: -80,
      lifespan: 8000,
      speedY: { min: 40, max: 70 },
      speedX: { min: -15, max: 15 },
      scale: { start: 1, end: 0.4 },
      alpha: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 360 },
      frequency: 800,
      quantity: 1
    })
    this.snowParticlesFg.setScrollFactor(0)
    this.snowParticlesFg.setDepth(1001)
  }

  setupCameraControls() {
    // WASD / Arrow keys for panning
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    })

    // Disable Phaser keyboard capture when typing in inputs
    // This prevents WASD from moving camera while typing
    document.addEventListener('focusin', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        this.input.keyboard.enabled = false
        this.keyboardDisabled = true
      }
    })

    document.addEventListener('focusout', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Small delay to prevent re-enabling during focus switch between inputs
        setTimeout(() => {
          const active = document.activeElement
          if (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA') {
            this.input.keyboard.enabled = true
            this.keyboardDisabled = false
          }
        }, 50)
      }
    })

    // Track if we're dragging to pan
    this.isPanning = false

    // Mouse drag to pan (right-click or middle-click)
    this.input.on('pointerdown', (pointer) => {
      if (pointer.button === 1 || pointer.button === 2) {
        this.isPanning = true
      }
    })

    this.input.on('pointerup', (pointer) => {
      if (pointer.button === 1 || pointer.button === 2) {
        this.isPanning = false
      }
    })

    this.input.on('pointermove', (pointer) => {
      if (this.isPanning && pointer.isDown) {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom
      }
    })

    // Scroll wheel: zoom by default, pan with Shift (vertical) or Ctrl (horizontal)
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const panSpeed = 30 / this.cameras.main.zoom

      if (pointer.event.shiftKey) {
        // Shift + scroll = pan vertically
        this.cameras.main.scrollY += deltaY * 0.5
      } else if (pointer.event.ctrlKey || pointer.event.metaKey) {
        // Ctrl/Cmd + scroll = pan horizontally
        this.cameras.main.scrollX += deltaY * 0.5
        pointer.event.preventDefault() // Prevent browser back/forward on Ctrl+scroll
      } else {
        // Normal scroll = zoom
        const zoom = this.cameras.main.zoom
        const newZoom = Phaser.Math.Clamp(zoom - deltaY * 0.001, 0.3, 2)
        this.cameras.main.setZoom(newZoom)
      }
    })

    // Edge scrolling - pan when mouse is near screen edges
    this.edgeScrollMargin = 50
    this.edgeScrollSpeed = 8

    // Center camera on town
    const centerX = this.mapWidth * this.tileWidth / 2
    const centerY = this.mapHeight * this.tileHeight / 2
    this.cameras.main.centerOn(centerX, centerY)
  }

  createMap() {
    this.mapLayer = this.add.container(0, 0)

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const isoX = (x - y) * this.tileWidth / 2
        const isoY = (x + y) * this.tileHeight / 2

        // Varied terrain
        let tileKey = 'tile-grass'
        const noise = Math.sin(x * 0.5) * Math.cos(y * 0.7)
        if (noise > 0.5) tileKey = 'tile-dirt'
        if (noise < -0.7) tileKey = 'tile-stone'

        const tile = this.add.image(isoX, isoY, tileKey)
        tile.setOrigin(0.5, 0.5)
        tile.setInteractive()
        tile.gridX = x
        tile.gridY = y

        // Hover effect - icy blue glow with smooth transition
        tile.on('pointerover', () => {
          this.tweens.add({
            targets: tile,
            alpha: 0.85,
            duration: 150,
            ease: 'Sine.easeOut'
          })
          tile.setTint(0xC0E8FF)
        })
        tile.on('pointerout', () => {
          this.tweens.add({
            targets: tile,
            alpha: 1,
            duration: 150,
            ease: 'Sine.easeOut'
          })
          tile.clearTint()
        })

        this.mapLayer.add(tile)
      }
    }

    // Offset to center
    this.mapLayer.x = this.cameras.main.width / 2
    this.mapLayer.y = 150
  }

  setupInput() {
    // Track if we clicked on an interactive object
    this.clickedOnObject = false

    // Left click to start box selection (only if not on object)
    this.input.on('pointerdown', (pointer) => {
      if (pointer.button === 0 && !this.clickedOnObject) {
        this.selectionStart = { x: pointer.worldX, y: pointer.worldY }
      }
      // Reset flag after a frame
      this.time.delayedCall(50, () => { this.clickedOnObject = false })
    })

    // Drag selection box + broadcast cursor
    this.input.on('pointermove', (pointer) => {
      // Broadcast cursor position for multiplayer
      if (this.multiplayer?.isConnected()) {
        this.multiplayer.sendCursor(pointer.worldX, pointer.worldY)
      }

      if (this.selectionStart && pointer.isDown && pointer.button === 0) {
        this.drawSelectionBox(pointer.worldX, pointer.worldY)
      }
    })

    // Release to finalize box selection
    this.input.on('pointerup', (pointer) => {
      if (pointer.button === 0 && this.selectionStart) {
        // Only do box selection if we dragged (not a click on object)
        const dx = Math.abs(pointer.worldX - this.selectionStart.x)
        const dy = Math.abs(pointer.worldY - this.selectionStart.y)
        if (dx > 10 || dy > 10) {
          this.finalizeSelection(pointer.worldX, pointer.worldY)
        }
        this.selectionBox.clear()
        this.selectionStart = null
      }
    })

    // Right click to issue command
    this.input.on('pointerdown', (pointer) => {
      if (pointer.button === 2 && this.selectedUnits.length > 0) {
        this.issueCommand(pointer.worldX, pointer.worldY)
      }
    })

    // Prevent context menu
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  drawSelectionBox(endX, endY) {
    this.selectionBox.clear()
    // Club Penguin icy blue selection with glow
    this.selectionBox.lineStyle(4, 0x00BFFF, 0.8)
    this.selectionBox.fillStyle(0x87CEEB, 0.25)

    const x = Math.min(this.selectionStart.x, endX)
    const y = Math.min(this.selectionStart.y, endY)
    const w = Math.abs(endX - this.selectionStart.x)
    const h = Math.abs(endY - this.selectionStart.y)

    this.selectionBox.fillRect(x, y, w, h)
    this.selectionBox.strokeRect(x, y, w, h)

    // Inner glow line
    this.selectionBox.lineStyle(2, 0xFFFFFF, 0.4)
    this.selectionBox.strokeRect(x + 2, y + 2, w - 4, h - 4)
  }

  finalizeSelection(endX, endY) {
    // Clear previous selection
    this.selectedUnits.forEach(u => u.deselect())
    this.selectedUnits = []

    const rect = new Phaser.Geom.Rectangle(
      Math.min(this.selectionStart.x, endX),
      Math.min(this.selectionStart.y, endY),
      Math.abs(endX - this.selectionStart.x),
      Math.abs(endY - this.selectionStart.y)
    )

    // If it's a click (small rect), select single unit under cursor
    if (rect.width < 5 && rect.height < 5) {
      this.units.forEach(unit => {
        const worldPos = this.unitLayer.getWorldTransformMatrix().transformPoint(unit.x, unit.y)
        if (Phaser.Geom.Rectangle.Contains(
          new Phaser.Geom.Rectangle(endX - 15, endY - 15, 30, 30),
          worldPos.x, worldPos.y
        )) {
          this.selectedUnits.push(unit)
          unit.select()
        }
      })
    } else {
      // Box selection
      this.units.forEach(unit => {
        const worldPos = this.unitLayer.getWorldTransformMatrix().transformPoint(unit.x, unit.y)
        if (Phaser.Geom.Rectangle.Contains(rect, worldPos.x, worldPos.y)) {
          this.selectedUnits.push(unit)
          unit.select()
        }
      })
    }

    // Emit event for UI
    this.events.emit('selectionChanged', this.selectedUnits)

    // Broadcast selection to multiplayer
    if (this.multiplayer?.isConnected()) {
      const selectedIds = this.selectedUnits.map(u => u.id)
      this.multiplayer.sendSelection(selectedIds)
    }
  }

  issueCommand(worldX, worldY) {
    // Find what was clicked (tile position)
    // For now, just move units there
    this.selectedUnits.forEach(unit => {
      unit.moveTo(worldX, worldY)
    })
  }

  // Create dust puff effect at position
  createDustPuff(x, y) {
    for (let i = 0; i < 4; i++) {
      const puff = this.add.image(x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-4, 4), 'dust-puff')
      puff.setAlpha(0.6)
      puff.setScale(0.3)
      this.effectsLayer.add(puff)

      this.tweens.add({
        targets: puff,
        y: puff.y - 15,
        x: puff.x + Phaser.Math.Between(-10, 10),
        alpha: 0,
        scale: 0.8,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => puff.destroy()
      })
    }
  }

  // Create sparkle effect at position
  createSparkles(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      const sparkle = this.add.image(
        x + Phaser.Math.Between(-15, 15),
        y + Phaser.Math.Between(-15, 15),
        'sparkle'
      )
      sparkle.setAlpha(0)
      sparkle.setScale(0.5)
      this.effectsLayer.add(sparkle)

      this.tweens.add({
        targets: sparkle,
        alpha: { from: 0, to: 1 },
        scale: { from: 0.3, to: 0.8 },
        duration: 200,
        delay: i * 100,
        yoyo: true,
        onComplete: () => sparkle.destroy()
      })
    }
  }

  async loadTownState() {
    try {
      const state = await this.api.getStatus()
      // If no real data, use demo state
      if (!state.rigs?.length && !state.polecats?.length) {
        this.createDemoState()
      } else {
        this.updateFromState(state)
      }
    } catch (e) {
      console.warn('Could not load town state:', e)
      // Create demo state
      this.createDemoState()
    }
  }

  createDemoState() {
    // Central Town (Mayor's area) - this is the hub
    this.addVillage('Town Center', null, 20, 20, true)
  }

  // Add a new village to the map
  addVillage(name, repoUrl = null, centerX = null, centerY = null, isHub = false) {
    // Calculate position for new village
    if (centerX === null || centerY === null) {
      const villageIndex = this.villages.length
      const angle = (villageIndex * Math.PI * 2) / Math.max(1, villageIndex)
      const radius = this.villageSpacing
      centerX = 20 + Math.cos(angle) * radius
      centerY = 20 + Math.sin(angle) * radius
    }

    const village = {
      name,
      repoUrl,
      centerX: Math.floor(centerX),
      centerY: Math.floor(centerY),
      isHub,
      polecats: [],
      buildings: []
    }

    this.villages.push(village)

    if (isHub) {
      // Central hub with Mayor HQ
      this.addBuilding('townhall', 'Mayor HQ', centerX, centerY, 'building-townhall')
      this.addBuilding('refinery', 'Refinery', centerX - 3, centerY - 2, 'building-refinery')
      this.addBuilding('barracks', 'Barracks', centerX - 2, centerY + 2, 'building-barracks')

      // Mayor (special click handler)
      const mayor = this.addUnit('mayor', 'Mayor', centerX, centerY - 1, 'unit-mayor', 'idle')
      if (mayor) {
        mayor.sprite.on('pointerdown', () => {
          this.events.emit('mayorClicked')
        })
      }

      this.addUnit('deacon', 'Deacon', centerX - 1, centerY, 'unit-deacon', 'idle')
      this.addUnit('refinery-agent', 'Refinery', centerX - 3, centerY - 1, 'unit-refinery', 'idle')
    } else {
      // Project village
      const rigId = `rig-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      this.addBuilding(rigId, name, centerX, centerY, 'building-rig')
      village.buildings.push(rigId)

      // Add a signpost or marker
      this.addBuilding(`sign-${rigId}`, name, centerX - 1, centerY + 1, 'building-barracks')

      // Add path/road connecting to hub (visual only)
      this.addVillagePath(20, 20, centerX, centerY)
    }

    // Notify UI
    this.events.emit('villageAdded', village)

    return village
  }

  // Add visual path between villages
  addVillagePath(fromX, fromY, toX, toY) {
    const pathGraphics = this.add.graphics()
    pathGraphics.lineStyle(8, 0xD2B48C, 0.6)

    const from = this.gridToIso(fromX, fromY)
    const to = this.gridToIso(toX, toY)

    pathGraphics.beginPath()
    pathGraphics.moveTo(from.x, from.y)
    pathGraphics.lineTo(to.x, to.y)
    pathGraphics.strokePath()

    // Add to map layer so it's under buildings
    this.mapLayer.add(pathGraphics)
  }

  // Add a polecat to a specific village
  addPolecatToVillage(villageName, polecatName) {
    const village = this.villages.find(v => v.name.toLowerCase() === villageName.toLowerCase())
    if (!village) return null

    // Position near village center
    const offsetX = Phaser.Math.Between(-2, 2)
    const offsetY = Phaser.Math.Between(-2, 2)

    const unit = this.addUnit(
      `polecat-${polecatName}`,
      polecatName,
      village.centerX + offsetX,
      village.centerY + offsetY,
      'unit-polecat-idle',
      'idle'
    )

    if (unit) {
      village.polecats.push(polecatName)
    }

    return unit
  }

  // Pan camera to a village
  panToVillage(villageName) {
    const village = this.villages.find(v => v.name.toLowerCase() === villageName.toLowerCase())
    if (!village) return

    const { x, y } = this.gridToIso(village.centerX, village.centerY)

    this.tweens.add({
      targets: this.cameras.main,
      scrollX: x - this.cameras.main.width / 2,
      scrollY: y - this.cameras.main.height / 2,
      duration: 800,
      ease: 'Sine.easeInOut'
    })
  }

  updateFromState(state) {
    // First create the central hub
    this.addVillage('Town Center', null, 20, 20, true)

    // Add rigs as villages around the hub
    if (state.rigs && state.rigs.length > 0) {
      // Filter out special rigs that are part of the hub
      const hubRigs = ['mayor', 'deacon', 'refinery']
      const projectRigs = state.rigs.filter(r => !hubRigs.includes(r.name))

      projectRigs.forEach((rig, i) => {
        // Position in a circle around the hub
        const angle = (i * Math.PI * 2) / Math.max(projectRigs.length, 1) - Math.PI / 2
        const radius = 10
        const cx = 20 + Math.cos(angle) * radius
        const cy = 20 + Math.sin(angle) * radius

        // Choose building type based on name
        let buildingType = 'building-rig'
        if (rig.name.includes('test')) buildingType = 'building-barracks'

        this.addBuilding(`rig-${rig.name}`, rig.name, Math.floor(cx), Math.floor(cy), buildingType)

        // Track as village
        this.villages.push({
          name: rig.name,
          centerX: Math.floor(cx),
          centerY: Math.floor(cy),
          isHub: false,
          polecats: []
        })
      })
    }

    // Add polecats to their rigs
    if (state.polecats) {
      state.polecats.forEach((pc, i) => {
        const status = pc.status === 'working' ? 'unit-polecat-working' :
                       pc.status === 'stuck' ? 'unit-polecat-stuck' : 'unit-polecat-idle'

        // Find the village this polecat belongs to
        const village = this.villages.find(v => v.name === pc.rig)
        let gridX = 13 + i
        let gridY = 8 + i

        if (village) {
          // Position near the village center
          gridX = village.centerX + Phaser.Math.Between(-2, 2)
          gridY = village.centerY + Phaser.Math.Between(-2, 2)
          village.polecats.push(pc.name)
        }

        this.addUnit(`polecat-${pc.name}`, pc.name, gridX, gridY, status, pc.status)
      })
    }

    // Emit event to update village navigator
    this.events.emit('villageAdded', this.villages[0])
  }

  addBuilding(id, name, gridX, gridY, spriteKey) {
    const { x, y } = this.gridToIso(gridX, gridY)

    const building = this.add.image(x, y, spriteKey)
    building.setOrigin(0.5, 1)
    building.id = id
    building.buildingName = name
    building.gridX = gridX
    building.gridY = gridY
    building.setInteractive()

    // Make building interactive
    building.setInteractive({ useHandCursor: true })

    // Hover tooltip - icy glow with smooth transition
    building.on('pointerover', () => {
      this.tweens.add({
        targets: building,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 150,
        ease: 'Back.easeOut'
      })
      building.setTint(0xD0F0FF)
      this.events.emit('showTooltip', { name, type: 'building', x: building.x, y: building.y })
    })
    building.on('pointerout', () => {
      this.tweens.add({
        targets: building,
        scaleX: 1,
        scaleY: 1,
        duration: 150,
        ease: 'Sine.easeOut'
      })
      building.clearTint()
      this.events.emit('hideTooltip')
    })
    // Click to show building info
    building.on('pointerdown', () => {
      this.clickedOnObject = true
      // Click feedback
      this.tweens.add({
        targets: building,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true
      })
      this.events.emit('buildingClicked', { id, name, type: spriteKey })
    })

    this.buildingLayer.add(building)
    this.buildings.set(id, building)

    // Sort by Y for proper overlap
    this.buildingLayer.sort('y')
  }

  addUnit(id, name, gridX, gridY, spriteKey, status) {
    const { x, y } = this.gridToIso(gridX, gridY)

    const unit = this.add.container(x, y)
    const sprite = this.add.image(0, 0, spriteKey)
    sprite.setOrigin(0.5, 1)

    // Enhanced selection ring (larger for 2x sprites)
    const selectionRing = this.add.image(0, 4, 'selection-ring')
    selectionRing.setOrigin(0.5, 0.5)
    selectionRing.setVisible(false)

    unit.add([selectionRing, sprite])
    unit.sprite = sprite
    unit.selectionRing = selectionRing
    unit.id = id
    unit.unitName = name
    unit.status = status
    unit.gridX = gridX
    unit.gridY = gridY
    unit.progress = 0
    unit.tokensUsed = 0
    unit.assignedAt = null
    unit.rig = null

    // Stub methods for compatibility - actual progress shown in UI card
    unit.updateProgress = (progress, tokensUsed, assignedAt) => {
      unit.progress = progress || 0
      unit.tokensUsed = tokensUsed || 0
      unit.assignedAt = assignedAt
    }

    unit.setWarningLevel = (level) => {
      // Visual warning via sprite tint instead of separate graphics
      if (level === 0) {
        sprite.clearTint()
      } else if (level === 1) {
        sprite.setTint(0xFFFF88)  // Yellow tint
      } else if (level === 2) {
        sprite.setTint(0xFFAA44)  // Orange tint
      } else if (level === 3) {
        sprite.setTint(0xFF6666)  // Red tint
      }
    }

    // Selection methods with pulsing animation
    unit.select = () => {
      selectionRing.setVisible(true)
      // Pulsing glow effect
      if (unit.pulseAnim) unit.pulseAnim.stop()
      unit.pulseAnim = this.tweens.add({
        targets: selectionRing,
        scaleX: { from: 1, to: 1.15 },
        scaleY: { from: 1, to: 1.15 },
        alpha: { from: 1, to: 0.7 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
      // Sparkle effect on selection
      this.createSparkles(x, y - 20, 4)
    }
    unit.deselect = () => {
      selectionRing.setVisible(false)
      if (unit.pulseAnim) {
        unit.pulseAnim.stop()
        selectionRing.setScale(1)
        selectionRing.setAlpha(1)
      }
    }

    // Movement with waddle animation and dust effects
    unit.moveTo = (worldX, worldY) => {
      // Dust puff on start
      this.createDustPuff(unit.x, unit.y)

      // Waddle side-to-side while moving (enhanced)
      this.tweens.add({
        targets: sprite,
        angle: { from: -12, to: 12 },
        duration: 120,
        yoyo: true,
        repeat: 4,
        ease: 'Sine.easeInOut'
      })

      // Main movement
      this.tweens.add({
        targets: unit,
        x: worldX,
        y: worldY,
        duration: 700,
        ease: 'Quad.easeInOut',
        onComplete: () => {
          sprite.setAngle(0)
          // Bounce on arrival
          this.tweens.add({
            targets: sprite,
            scaleY: { from: 0.9, to: 1 },
            scaleX: { from: 1.1, to: 1 },
            duration: 150,
            ease: 'Back.easeOut'
          })
          // Dust puff on landing
          this.createDustPuff(worldX, worldY)
        }
      })
    }

    // Make interactive - Club Penguin style hover and click
    sprite.setInteractive({ useHandCursor: true })
    sprite.on('pointerover', () => {
      sprite.setTint(0xFFB6C1) // Light pink hover
      this.tweens.add({
        targets: sprite,
        y: -4,
        duration: 100,
        ease: 'Back.easeOut'
      })
      this.events.emit('showTooltip', { name, type: 'penguin', status, x: unit.x, y: unit.y - 30 })
    })
    sprite.on('pointerout', () => {
      sprite.clearTint()
      this.tweens.add({
        targets: sprite,
        y: 0,
        duration: 100,
        ease: 'Sine.easeOut'
      })
      this.events.emit('hideTooltip')
    })
    // Direct click selection
    sprite.on('pointerdown', () => {
      this.clickedOnObject = true
      // Clear previous selection
      this.selectedUnits.forEach(u => u.deselect())
      this.selectedUnits = [unit]
      unit.select()
      this.events.emit('selectionChanged', this.selectedUnits)
      // Click feedback
      this.tweens.add({
        targets: sprite,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 50,
        yoyo: true
      })
      // Broadcast to multiplayer
      if (this.multiplayer?.isConnected()) {
        this.multiplayer.sendSelection([unit.id])
      }
    })

    this.unitLayer.add(unit)
    this.units.set(id, unit)

    // Enhanced idle animation with breathing and occasional blink
    if (status === 'idle') {
      // Breathing effect (subtle scale)
      this.tweens.add({
        targets: sprite,
        scaleY: { from: 1, to: 1.02 },
        scaleX: { from: 1, to: 0.98 },
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })

      // Gentle bob
      this.tweens.add({
        targets: sprite,
        y: -3,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 500)
      })

      // Occasional look-around (random rotation)
      this.time.addEvent({
        delay: Phaser.Math.Between(3000, 6000),
        callback: () => {
          if (unit.active) {
            this.tweens.add({
              targets: sprite,
              angle: Phaser.Math.Between(-8, 8),
              duration: 300,
              yoyo: true,
              ease: 'Sine.easeInOut'
            })
          }
        },
        loop: true
      })
    }

    // Working animation (busy typing/working motion)
    if (status === 'working') {
      this.tweens.add({
        targets: sprite,
        scaleX: { from: 1, to: 1.08 },
        scaleY: { from: 1, to: 0.92 },
        duration: 250,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })

      // Occasional progress sparkle
      this.time.addEvent({
        delay: 2000,
        callback: () => {
          if (unit.active) {
            this.createSparkles(unit.x, unit.y - 25, 2)
          }
        },
        loop: true
      })
    }

    // Stuck animation (worried jitter)
    if (status === 'stuck') {
      this.tweens.add({
        targets: sprite,
        x: { from: -2, to: 2 },
        duration: 100,
        yoyo: true,
        repeat: -1,
        ease: 'Linear'
      })
    }

    // Sort units by Y
    this.unitLayer.sort('y')

    return unit
  }

  gridToIso(gridX, gridY) {
    const offsetX = this.mapLayer.x
    const offsetY = this.mapLayer.y
    return {
      x: offsetX + (gridX - gridY) * this.tileWidth / 2,
      y: offsetY + (gridX + gridY) * this.tileHeight / 2
    }
  }

  update() {
    // Skip keyboard camera controls if user is typing in an input field
    const activeElement = document.activeElement
    const isTyping = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')

    // Camera movement from keyboard (only when not typing)
    if (!isTyping) {
      const camSpeed = 12 / this.cameras.main.zoom
      if (this.cursors.left.isDown || this.wasd.left.isDown) {
        this.cameras.main.scrollX -= camSpeed
      }
      if (this.cursors.right.isDown || this.wasd.right.isDown) {
        this.cameras.main.scrollX += camSpeed
      }
      if (this.cursors.up.isDown || this.wasd.up.isDown) {
        this.cameras.main.scrollY -= camSpeed
      }
      if (this.cursors.down.isDown || this.wasd.down.isDown) {
        this.cameras.main.scrollY += camSpeed
      }
    }

    // Edge scrolling - pan when mouse near screen edges
    const pointer = this.input.activePointer
    const margin = this.edgeScrollMargin || 50
    const speed = (this.edgeScrollSpeed || 8) / this.cameras.main.zoom

    if (pointer.x < margin) {
      this.cameras.main.scrollX -= speed
    } else if (pointer.x > this.cameras.main.width - margin) {
      this.cameras.main.scrollX += speed
    }

    if (pointer.y < margin) {
      this.cameras.main.scrollY -= speed
    } else if (pointer.y > this.cameras.main.height - margin) {
      this.cameras.main.scrollY += speed
    }
  }

  async refreshState() {
    try {
      const state = await this.api.getStatus()

      // Get settings from UI scene for threshold calculations
      const uiScene = this.scene.get('UIScene')
      const settings = uiScene?.settings || {
        stuckTokenThreshold: 25000,
        stuckTimeThreshold: 1800000,
        warningTokenThreshold: 20000,
        warningTimeThreshold: 1440000
      }

      // Update unit states
      if (state.polecats) {
        state.polecats.forEach(pc => {
          const unit = this.units.get(`polecat-${pc.name}`)
          if (unit) {
            const oldStatus = unit.status
            unit.status = pc.status
            unit.rig = pc.rig
            unit.issue = pc.issue

            // Update sprite based on status
            const newKey = pc.status === 'working' ? 'unit-polecat-working' :
                          pc.status === 'stuck' ? 'unit-polecat-stuck' : 'unit-polecat-idle'
            unit.sprite.setTexture(newKey)

            // Play sea lion animation if just became stuck
            if (oldStatus !== 'stuck' && pc.status === 'stuck') {
              this.playSeaLionAttack(unit)
            }

            // Update progress if available
            if (unit.updateProgress) {
              unit.updateProgress(pc.progress || 0, pc.tokensUsed || 0, pc.assignedAt)
            }

            // Calculate warning level based on thresholds
            if (pc.status === 'working' && unit.setWarningLevel) {
              const tokensUsed = pc.tokensUsed || 0
              const elapsed = pc.assignedAt ? Date.now() - new Date(pc.assignedAt).getTime() : 0

              // Calculate percentage of thresholds
              const tokenPercent = tokensUsed / settings.stuckTokenThreshold
              const timePercent = elapsed / settings.stuckTimeThreshold

              const maxPercent = Math.max(tokenPercent, timePercent)

              if (maxPercent >= 0.9) {
                unit.setWarningLevel(2)  // Orange - 90%
              } else if (maxPercent >= 0.8) {
                unit.setWarningLevel(1)  // Yellow - 80%
              } else {
                unit.setWarningLevel(0)  // No warning
              }
            } else if (pc.status === 'stuck' && unit.setWarningLevel) {
              unit.setWarningLevel(3)  // Red - stuck
            } else if (unit.setWarningLevel) {
              unit.setWarningLevel(0)  // Clear warning
            }
          }
        })
      }
      this.events.emit('stateUpdated', state)

      // Update village navigator in UI
      if (uiScene?.updateVillageNavigator) {
        uiScene.updateVillageNavigator()
      }
      if (uiScene?.updateMiniStatusBar) {
        uiScene.updateMiniStatusBar()
      }
    } catch (e) {
      // Silently fail on refresh
    }
  }

  // Sea lion attack animation when polecat gets stuck (killed)
  playSeaLionAttack(unit) {
    const unitX = unit.x
    const unitY = unit.y
    const unitId = unit.id
    const unitName = unit.unitName

    console.log('Sea lion attack!', { unitX, unitY, unitId, unitName })

    // Create sea lion emerging from below - add directly to scene with high depth
    const seaLion = this.add.image(unitX, unitY + 80, 'sea-lion')
    seaLion.setOrigin(0.5, 1)
    seaLion.setScale(3.0)
    seaLion.setDepth(9999)

    // Water splash effect
    const splash = this.add.graphics()
    splash.setPosition(unitX, unitY + 60)
    splash.setDepth(9998)
    splash.fillStyle(0x3498DB, 0.8)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      const dist = 20 + Math.random() * 15
      splash.fillCircle(Math.cos(angle) * dist, Math.sin(angle) * dist, 6 + Math.random() * 4)
    }

    // Animation sequence
    // 1. Sea lion emerges with splash
    this.tweens.add({
      targets: seaLion,
      y: unitY - 10,
      scale: 5.0,
      duration: 500,
      ease: 'Back.easeOut'
    })

    // Splash fades
    this.tweens.add({
      targets: splash,
      alpha: 0,
      duration: 400,
      delay: 300
    })

    // 2. Sea lion lunges at penguin
    this.tweens.add({
      targets: seaLion,
      x: unitX + 20,
      y: unitY - 20,
      duration: 300,
      delay: 550,
      ease: 'Power3'
    })

    // 3. Penguin shakes in terror
    this.tweens.add({
      targets: unit.sprite,
      x: { from: -6, to: 6 },
      duration: 50,
      delay: 550,
      yoyo: true,
      repeat: 6,
      ease: 'Linear'
    })

    // 4. Sea lion grabs penguin and drags it down!
    this.tweens.add({
      targets: [seaLion, unit],
      y: unitY + 150,
      duration: 600,
      delay: 900,
      ease: 'Power2'
    })

    // Penguin spins as it's dragged
    this.tweens.add({
      targets: unit.sprite,
      angle: 720,
      duration: 600,
      delay: 900,
      ease: 'Linear'
    })

    // Both fade out as they go under
    this.tweens.add({
      targets: [seaLion, unit],
      alpha: 0,
      duration: 500,
      delay: 1100,
      onComplete: () => {
        seaLion.destroy()
        splash.destroy()
        // Remove the unit from the game
        this.units.delete(unitId)
        unit.destroy()

        // Also remove from village's polecat list
        for (const village of this.villages) {
          const idx = village.polecats?.indexOf(unitName)
          if (idx > -1) {
            village.polecats.splice(idx, 1)
          }
        }

        // Notify UI
        this.events.emit('selectionChanged', [])
      }
    })

    // 5. Big splash as they go under
    this.tweens.add({
      targets: splash,
      scale: 1.5,
      alpha: 0,
      duration: 500,
      delay: 800,
      onComplete: () => {
        splash.destroy()
      }
    })

    // Create bubbles rising up after
    this.time.delayedCall(1100, () => {
      for (let i = 0; i < 5; i++) {
        const bubble = this.add.graphics()
        bubble.fillStyle(0x87CEEB, 0.6)
        bubble.fillCircle(0, 0, 3 + Math.random() * 3)
        bubble.setPosition(unitX + (Math.random() - 0.5) * 30, unitY + 50)
        this.effectsLayer.add(bubble)

        this.tweens.add({
          targets: bubble,
          y: unitY - 20,
          alpha: 0,
          duration: 800 + Math.random() * 400,
          delay: i * 100,
          ease: 'Sine.easeOut',
          onComplete: () => bubble.destroy()
        })
      }
    })
  }
}
