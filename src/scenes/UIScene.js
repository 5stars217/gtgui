import Phaser from 'phaser'
import { GasTownAPI } from '../api/GasTownAPI.js'

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' })
    this.api = new GasTownAPI()
  }

  init(data) {
    this.gameScene = data.gameScene
  }

  create() {
    // Create UI containers (Club Penguin style!)
    this.createResourceBar()
    this.createMinimap()
    this.createCommandPanel()
    this.createTooltip()
    this.createNewProjectButton()

    // Listen for game events
    if (this.gameScene) {
      this.gameScene.events.on('selectionChanged', this.updateSelection, this)
      this.gameScene.events.on('showTooltip', this.showTooltip, this)
      this.gameScene.events.on('hideTooltip', this.hideTooltip, this)
      this.gameScene.events.on('stateUpdated', this.updateResources, this)
      this.gameScene.events.on('multiplayerConnected', this.onMultiplayerConnected, this)
      this.gameScene.events.on('usersUpdated', this.updateConnectedUsers, this)
      this.gameScene.events.on('buildingClicked', this.onBuildingClicked, this)
      this.gameScene.events.on('mayorClicked', this.openMayorChat, this)
    }

    // Create Mayor chat panel (hidden initially)
    this.createMayorChatPanel()

    // Create village navigator
    this.createVillageNavigator()

    // Listen for new villages
    if (this.gameScene) {
      this.gameScene.events.on('villageAdded', this.updateVillageNavigator, this)
    }

    // Handle resize
    this.scale.on('resize', this.handleResize, this)
  }

  // Helper to darken a color
  darkenColor(color, amount) {
    const c = Phaser.Display.Color.ValueToColor(color)
    return Phaser.Display.Color.GetColor(
      Math.max(0, c.red - amount),
      Math.max(0, c.green - amount),
      Math.max(0, c.blue - amount)
    )
  }

  // Draw glossy gradient panel
  drawGlossyPanel(graphics, x, y, width, height, color, cornerRadius = 15) {
    // Shadow
    graphics.fillStyle(0x000000, 0.25)
    graphics.fillRoundedRect(x + 3, y + 3, width, height, cornerRadius)

    // Main panel (darker bottom)
    const darkColor = this.darkenColor(color, 30)
    graphics.fillStyle(darkColor, 0.95)
    graphics.fillRoundedRect(x, y, width, height, cornerRadius)

    // Top gradient (lighter)
    graphics.fillStyle(color, 0.98)
    graphics.fillRoundedRect(x, y, width, height * 0.6, { tl: cornerRadius, tr: cornerRadius, bl: 0, br: 0 })

    // Inner highlight (glossy effect)
    graphics.fillStyle(0xFFFFFF, 0.15)
    graphics.fillRoundedRect(x + 3, y + 3, width - 6, height * 0.35, { tl: cornerRadius - 2, tr: cornerRadius - 2, bl: 0, br: 0 })

    // Border
    graphics.lineStyle(2, 0xFFFFFF, 0.6)
    graphics.strokeRoundedRect(x, y, width, height, cornerRadius)

    // Inner shadow line
    graphics.lineStyle(1, 0x000000, 0.1)
    graphics.strokeRoundedRect(x + 2, y + 2, width - 4, height - 4, cornerRadius - 2)
  }

  createResourceBar() {
    const width = this.cameras.main.width

    // Top bar background - glossy icy blue
    this.topBar = this.add.graphics()
    this.drawGlossyPanel(this.topBar, 10, 8, width - 20, 50, 0x0077B6, 14)

    // Resource displays (Club Penguin style - coins, fish, stamps)
    // Now using 32px icons
    this.resources = {
      tokens: { icon: 'icon-tokens', value: 0, x: 45, label: 'Coins', displayValue: 0 },
      issues: { icon: 'icon-issues', value: 0, x: 200, label: 'Fish', displayValue: 0 },
      convoys: { icon: 'icon-convoys', value: 0, x: 355, label: 'Stamps', displayValue: 0 }
    }

    Object.entries(this.resources).forEach(([key, res]) => {
      // Icon with glow container
      const iconContainer = this.add.container(res.x, 33)

      // Icon glow
      const glow = this.add.graphics()
      glow.fillStyle(0xFFFFFF, 0.2)
      glow.fillCircle(0, 0, 20)
      iconContainer.add(glow)

      res.iconSprite = this.add.image(0, 0, res.icon).setScale(0.9)
      iconContainer.add(res.iconSprite)

      res.text = this.add.text(res.x + 28, 22, `${res.label}: ${res.value}`, {
        font: 'bold 16px Fredoka',
        fill: '#FFFFFF',
        stroke: '#005588',
        strokeThickness: 3
      })

      // Hover effect on icon
      const hitZone = this.add.zone(res.x, 33, 50, 40).setInteractive()
      hitZone.on('pointerover', () => {
        this.tweens.add({
          targets: res.iconSprite,
          scale: 1.1,
          duration: 100,
          ease: 'Back.easeOut'
        })
        glow.clear()
        glow.fillStyle(0xFFFFFF, 0.4)
        glow.fillCircle(0, 0, 22)
      })
      hitZone.on('pointerout', () => {
        this.tweens.add({
          targets: res.iconSprite,
          scale: 0.9,
          duration: 100,
          ease: 'Sine.easeOut'
        })
        glow.clear()
        glow.fillStyle(0xFFFFFF, 0.2)
        glow.fillCircle(0, 0, 20)
      })
    })

    // Town name with penguin flair
    this.townName = this.add.text(width - 30, 18, 'PENGUIN TOWN', {
      font: 'bold 20px Fredoka',
      fill: '#FFFFFF',
      stroke: '#005588',
      strokeThickness: 4
    }).setOrigin(1, 0)

    // Status text
    this.statusText = this.add.text(width - 30, 40, 'Waddle on!', {
      font: '13px Fredoka',
      fill: '#B0E0E6'
    }).setOrigin(1, 0)

    // Connected users indicator
    this.createUsersIndicator()
  }

  // Animate resource counter
  animateResourceCounter(res, newValue) {
    if (res.displayValue === newValue) return

    const startValue = res.displayValue
    const diff = newValue - startValue

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 500,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => {
        const current = Math.round(startValue + diff * tween.getValue())
        res.displayValue = current
        res.text.setText(`${res.label}: ${current}`)
      },
      onComplete: () => {
        res.displayValue = newValue
        res.text.setText(`${res.label}: ${newValue}`)
        // Pop effect
        this.tweens.add({
          targets: res.iconSprite,
          scale: { from: 1.2, to: 0.9 },
          duration: 150,
          ease: 'Back.easeOut'
        })
      }
    })
  }

  createUsersIndicator() {
    const width = this.cameras.main.width

    // Users container (positioned in middle-right of top bar)
    this.usersContainer = this.add.container(width - 220, 33)

    // "Online:" label
    this.usersLabel = this.add.text(0, 0, 'Online:', {
      font: 'bold 12px Fredoka',
      fill: '#B0E0E6'
    }).setOrigin(1, 0.5)

    // User dots container (will show colored dots for each user)
    this.userDots = this.add.container(10, 0)

    this.usersContainer.add([this.usersLabel, this.userDots])

    // Initially hidden until multiplayer connects
    this.usersContainer.setVisible(false)
  }

  onMultiplayerConnected(multiplayer) {
    this.multiplayer = multiplayer
    this.usersContainer.setVisible(true)
    this.statusText.setText('Connected!')

    // Show self as first user
    this.updateConnectedUsers([])
  }

  updateConnectedUsers(users) {
    // Clear existing dots
    this.userDots.removeAll(true)

    // Add self dot (always first, with a special indicator)
    const selfDot = this.add.graphics()
    selfDot.fillStyle(0xFFFFFF, 1)
    selfDot.fillCircle(0, 0, 8)
    selfDot.lineStyle(2, 0x2ECC71, 1)
    selfDot.strokeCircle(0, 0, 8)
    // Pulse animation
    this.tweens.add({
      targets: selfDot,
      scaleX: { from: 1, to: 1.2 },
      scaleY: { from: 1, to: 1.2 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
    this.userDots.add(selfDot)

    // Add dots for other users
    users.forEach((user, i) => {
      const colorHex = parseInt(user.color.hex.replace('#', ''), 16)
      const dot = this.add.graphics()
      dot.fillStyle(colorHex, 1)
      dot.fillCircle(20 + i * 20, 0, 7)
      dot.lineStyle(2, 0xFFFFFF, 0.8)
      dot.strokeCircle(20 + i * 20, 0, 7)

      // Tooltip on hover
      const hitArea = this.add.zone(20 + i * 20, 0, 18, 18)
      hitArea.setInteractive()
      hitArea.on('pointerover', () => {
        this.showUserTooltip(user, hitArea.x, hitArea.y)
      })
      hitArea.on('pointerout', () => {
        this.hideUserTooltip()
      })

      this.userDots.add([dot, hitArea])
    })

    // Update count in status
    const count = users.length + 1
    this.statusText.setText(`${count} penguin${count !== 1 ? 's' : ''} online`)
  }

  showUserTooltip(user, x, y) {
    if (!this.userTooltip) {
      this.userTooltip = this.add.container(0, 0)
      const bg = this.add.graphics()
      this.drawGlossyPanel(bg, 0, 0, 110, 34, 0xFFFFFF, 8)
      this.userTooltipText = this.add.text(55, 17, '', {
        font: 'bold 12px Fredoka',
        fill: '#0077B6'
      }).setOrigin(0.5)
      this.userTooltip.add([bg, this.userTooltipText])
    }

    this.userTooltipText.setText(user.name)
    this.userTooltip.setPosition(x - 55, y + 25)
    this.userTooltip.setVisible(true)
  }

  hideUserTooltip() {
    if (this.userTooltip) {
      this.userTooltip.setVisible(false)
    }
  }

  createMinimap() {
    const minimapSize = 160
    const padding = 15
    const x = this.cameras.main.width - minimapSize - padding
    const y = this.cameras.main.height - minimapSize - padding

    // Minimap frame - glossy style
    this.minimapBg = this.add.graphics()
    this.drawGlossyPanel(this.minimapBg, x - 10, y - 30, minimapSize + 20, minimapSize + 40, 0x0077B6, 14)

    // Minimap terrain (snowy) with inner shadow
    this.minimap = this.add.graphics()
    // Inner shadow
    this.minimap.fillStyle(0x5BA3C6, 0.5)
    this.minimap.fillRoundedRect(x + 2, y + 2, minimapSize - 4, minimapSize - 4, 8)
    // Main area
    this.minimap.fillStyle(0xE8F4FC, 1)
    this.minimap.fillRoundedRect(x, y, minimapSize, minimapSize, 8)

    // Snow texture pattern
    this.minimap.fillStyle(0xFFFFFF, 0.6)
    for (let i = 0; i < 30; i++) {
      this.minimap.fillCircle(
        x + Math.random() * minimapSize,
        y + Math.random() * minimapSize,
        1.5
      )
    }

    // Buildings on minimap (colorful dots with glow)
    this.minimapMarkers = this.add.graphics()
    // Ski lodge
    this.minimapMarkers.fillStyle(0x8B4513, 0.3)
    this.minimapMarkers.fillCircle(x + 80, y + 80, 10)
    this.minimapMarkers.fillStyle(0x8B4513, 1)
    this.minimapMarkers.fillCircle(x + 80, y + 80, 6)
    // Coffee shop
    this.minimapMarkers.fillStyle(0xD2691E, 0.3)
    this.minimapMarkers.fillCircle(x + 50, y + 60, 8)
    this.minimapMarkers.fillStyle(0xD2691E, 1)
    this.minimapMarkers.fillCircle(x + 50, y + 60, 5)
    // Pet shop
    this.minimapMarkers.fillStyle(0x9B59B6, 0.3)
    this.minimapMarkers.fillCircle(x + 110, y + 100, 8)
    this.minimapMarkers.fillStyle(0x9B59B6, 1)
    this.minimapMarkers.fillCircle(x + 110, y + 100, 5)
    // Igloo
    this.minimapMarkers.fillStyle(0xFFFFFF, 0.5)
    this.minimapMarkers.fillCircle(x + 130, y + 50, 8)
    this.minimapMarkers.fillStyle(0xFFFFFF, 1)
    this.minimapMarkers.fillCircle(x + 130, y + 50, 5)
    this.minimapMarkers.lineStyle(1, 0x87CEEB, 1)
    this.minimapMarkers.strokeCircle(x + 130, y + 50, 5)

    // Viewport indicator with glow
    this.viewportIndicator = this.add.graphics()
    this.viewportIndicator.fillStyle(0xFF6B35, 0.2)
    this.viewportIndicator.fillRoundedRect(x + 50, y + 50, 50, 40, 4)
    this.viewportIndicator.lineStyle(2, 0xFF6B35, 0.9)
    this.viewportIndicator.strokeRoundedRect(x + 50, y + 50, 50, 40, 4)

    // Label with icon
    this.add.text(x + minimapSize/2, y - 18, 'MAP', {
      font: 'bold 15px Fredoka',
      fill: '#FFFFFF',
      stroke: '#005588',
      strokeThickness: 2
    }).setOrigin(0.5, 0)
  }

  createCommandPanel() {
    // Selection card - Club Penguin player card style with frosted glass effect
    // Initially hidden, shown when something is selected
    this.selectionCard = this.add.container(20, 70)
    this.selectionCard.setVisible(false)
    this.selectionCard.setAlpha(0)

    const cardWidth = 220
    const cardHeight = 300

    // Card background with frosted glass effect
    const cardBg = this.add.graphics()

    // Outer glow
    cardBg.fillStyle(0x87CEEB, 0.3)
    cardBg.fillRoundedRect(-5, -5, cardWidth + 10, cardHeight + 10, 24)

    // Shadow
    cardBg.fillStyle(0x000000, 0.25)
    cardBg.fillRoundedRect(5, 5, cardWidth, cardHeight, 22)

    // Main card - frosted white
    cardBg.fillStyle(0xFFFFFF, 0.95)
    cardBg.fillRoundedRect(0, 0, cardWidth, cardHeight, 22)

    // Blue header gradient
    cardBg.fillStyle(0x005588, 1)
    cardBg.fillRoundedRect(0, 0, cardWidth, 70, { tl: 22, tr: 22, bl: 0, br: 0 })
    cardBg.fillStyle(0x0077B6, 0.9)
    cardBg.fillRoundedRect(0, 0, cardWidth, 45, { tl: 22, tr: 22, bl: 0, br: 0 })

    // Header shine
    cardBg.fillStyle(0xFFFFFF, 0.15)
    cardBg.fillRoundedRect(4, 4, cardWidth - 8, 20, { tl: 18, tr: 18, bl: 0, br: 0 })

    // Border
    cardBg.lineStyle(3, 0x0077B6, 1)
    cardBg.strokeRoundedRect(0, 0, cardWidth, cardHeight, 22)

    // Avatar circle background with gradient
    const avatarBg = this.add.graphics()
    avatarBg.fillStyle(0x87CEEB, 0.5)
    avatarBg.fillCircle(cardWidth/2, 55, 42)
    avatarBg.fillStyle(0xFFFFFF, 1)
    avatarBg.fillCircle(cardWidth/2, 55, 38)
    avatarBg.lineStyle(4, 0x0077B6, 1)
    avatarBg.strokeCircle(cardWidth/2, 55, 38)
    // Inner ring
    avatarBg.lineStyle(2, 0x87CEEB, 0.5)
    avatarBg.strokeCircle(cardWidth/2, 55, 32)

    // Avatar sprite (will be updated when selected)
    this.cardAvatar = this.add.image(cardWidth/2, 55, 'unit-polecat-idle')
    this.cardAvatar.setScale(0.8)

    // Name with better typography
    this.cardName = this.add.text(cardWidth/2, 105, 'Penguin', {
      font: 'bold 20px Fredoka',
      fill: '#0077B6'
    }).setOrigin(0.5, 0)

    // Status badge background
    this.cardStatusBg = this.add.graphics()
    this.cardStatus = this.add.text(cardWidth/2, 132, 'IDLE', {
      font: 'bold 13px Fredoka',
      fill: '#FFFFFF'
    }).setOrigin(0.5, 0)

    // Action buttons container
    this.cardButtons = this.add.container(12, 165)

    // Close button with hover effect
    const closeBtnBg = this.add.graphics()
    closeBtnBg.fillStyle(0xFF6B6B, 0.8)
    closeBtnBg.fillCircle(cardWidth - 18, 18, 14)
    closeBtnBg.fillStyle(0xFFFFFF, 0.3)
    closeBtnBg.fillCircle(cardWidth - 20, 16, 6)

    const closeBtn = this.add.text(cardWidth - 18, 18, 'X', {
      font: 'bold 14px Fredoka',
      fill: '#FFFFFF'
    }).setOrigin(0.5)

    const closeZone = this.add.zone(cardWidth - 18, 18, 28, 28).setInteractive({ useHandCursor: true })
    closeZone.on('pointerover', () => {
      closeBtnBg.clear()
      closeBtnBg.fillStyle(0xFF4444, 1)
      closeBtnBg.fillCircle(cardWidth - 18, 18, 15)
      closeBtnBg.fillStyle(0xFFFFFF, 0.3)
      closeBtnBg.fillCircle(cardWidth - 20, 16, 6)
    })
    closeZone.on('pointerout', () => {
      closeBtnBg.clear()
      closeBtnBg.fillStyle(0xFF6B6B, 0.8)
      closeBtnBg.fillCircle(cardWidth - 18, 18, 14)
      closeBtnBg.fillStyle(0xFFFFFF, 0.3)
      closeBtnBg.fillCircle(cardWidth - 20, 16, 6)
    })
    closeZone.on('pointerdown', () => this.hideSelectionCard())

    this.selectionCard.add([cardBg, avatarBg, this.cardAvatar, this.cardName,
                           this.cardStatusBg, this.cardStatus, this.cardButtons,
                           closeBtnBg, closeBtn, closeZone])

    // Keep old panel reference for compatibility
    this.commandPanel = this.add.graphics()
    this.panelTitle = this.add.text(0, 0, '').setVisible(false)
    this.selectionInfo = this.add.text(0, 0, '').setVisible(false)
    this.buttonContainer = this.add.container(0, 0).setVisible(false)
  }

  showSelectionCard(unit) {
    this.selectedUnit = unit
    this.selectionCard.setVisible(true)

    // Animated entry
    this.selectionCard.setX(-200)
    this.selectionCard.setAlpha(0)
    this.tweens.add({
      targets: this.selectionCard,
      x: 20,
      alpha: 1,
      duration: 250,
      ease: 'Back.easeOut'
    })

    // Update avatar with bounce
    const spriteKey = unit.sprite?.texture?.key || 'unit-polecat-idle'
    this.cardAvatar.setTexture(spriteKey)
    this.cardAvatar.setScale(0)
    this.tweens.add({
      targets: this.cardAvatar,
      scale: 0.8,
      duration: 300,
      delay: 100,
      ease: 'Back.easeOut'
    })

    // Update name
    this.cardName.setText(unit.unitName || 'Unknown')

    // Update status badge
    const status = unit.status || 'idle'
    this.cardStatusBg.clear()

    let statusColor, statusText
    switch(status) {
      case 'working':
        statusColor = 0x2ECC71
        statusText = 'WORKING'
        break
      case 'stuck':
        statusColor = 0xE74C3C
        statusText = 'NEEDS HELP!'
        break
      default:
        statusColor = 0x3498DB
        statusText = 'IDLE'
    }

    const textWidth = this.cardStatus.width + 24
    // Badge with gradient
    const darkStatus = this.darkenColor(statusColor, 40)
    this.cardStatusBg.fillStyle(darkStatus, 1)
    this.cardStatusBg.fillRoundedRect(110 - textWidth/2, 130, textWidth, 24, 12)
    this.cardStatusBg.fillStyle(statusColor, 1)
    this.cardStatusBg.fillRoundedRect(110 - textWidth/2, 128, textWidth, 22, 11)
    // Shine
    this.cardStatusBg.fillStyle(0xFFFFFF, 0.25)
    this.cardStatusBg.fillRoundedRect(110 - textWidth/2 + 3, 130, textWidth - 6, 8, { tl: 8, tr: 8, bl: 0, br: 0 })

    this.cardStatus.setText(statusText)

    // Create contextual action buttons
    this.createCardButtons(status)

    this.statusText.setText(`Selected: ${unit.unitName}`)
  }

  createCardButtons(status) {
    this.cardButtons.removeAll(true)

    const buttonWidth = 196
    const buttonHeight = 40
    let buttons = []

    // Different buttons based on status
    if (status === 'idle') {
      buttons = [
        { label: 'ASSIGN WORK', action: 'sling', color: 0x2ECC71, icon: '>' },
        { label: 'SEND MESSAGE', action: 'mail', color: 0x9B59B6, icon: '@' }
      ]
    } else if (status === 'working') {
      buttons = [
        { label: 'VIEW PROGRESS', action: 'hook', color: 0x3498DB, icon: '?' },
        { label: 'SEND MESSAGE', action: 'mail', color: 0x9B59B6, icon: '@' },
        { label: 'STOP WORK', action: 'stop', color: 0xE74C3C, icon: '!' }
      ]
    } else if (status === 'stuck') {
      buttons = [
        { label: 'VIEW PROBLEM', action: 'hook', color: 0xE74C3C, icon: '!' },
        { label: 'SEND HELP', action: 'mail', color: 0x9B59B6, icon: '@' },
        { label: 'REASSIGN WORK', action: 'sling', color: 0x2ECC71, icon: '>' },
        { label: 'STOP', action: 'stop', color: 0x95A5A6, icon: 'X' }
      ]
    }

    buttons.forEach((btn, i) => {
      const y = i * (buttonHeight + 10)
      const darkColor = this.darkenColor(btn.color, 50)

      const bg = this.add.graphics()

      // Default button state
      const drawButton = (pressed = false, hover = false) => {
        bg.clear()
        const yOffset = pressed ? 2 : 0

        // Shadow
        if (!pressed) {
          bg.fillStyle(0x000000, 0.2)
          bg.fillRoundedRect(2, y + 3, buttonWidth - 4, buttonHeight, 12)
        }

        // Main button
        bg.fillStyle(darkColor, 1)
        bg.fillRoundedRect(0, y + yOffset + 2, buttonWidth, buttonHeight - 2, 12)
        bg.fillStyle(hover ? btn.color : this.darkenColor(btn.color, 10), 1)
        bg.fillRoundedRect(0, y + yOffset, buttonWidth, buttonHeight - 2, 12)

        // Top highlight (glossy)
        bg.fillStyle(0xFFFFFF, pressed ? 0.2 : 0.35)
        bg.fillRoundedRect(3, y + yOffset + 3, buttonWidth - 6, buttonHeight * 0.35, { tl: 10, tr: 10, bl: 0, br: 0 })

        // Border
        bg.lineStyle(1, 0xFFFFFF, 0.3)
        bg.strokeRoundedRect(0, y + yOffset, buttonWidth, buttonHeight - 2, 12)
      }

      drawButton()

      const text = this.add.text(buttonWidth/2, y + buttonHeight/2 - 1, btn.label, {
        font: 'bold 14px Fredoka',
        fill: '#FFFFFF',
        stroke: '#00000033',
        strokeThickness: 1
      }).setOrigin(0.5)

      const zone = this.add.zone(buttonWidth/2, y + buttonHeight/2, buttonWidth, buttonHeight)
      zone.setInteractive({ useHandCursor: true })

      zone.on('pointerover', () => {
        drawButton(false, true)
        this.tweens.add({
          targets: [bg, text],
          y: '-=2',
          duration: 80,
          ease: 'Sine.easeOut'
        })
      })

      zone.on('pointerout', () => {
        drawButton(false, false)
        this.tweens.add({
          targets: [bg, text],
          y: '+=2',
          duration: 80,
          ease: 'Sine.easeOut'
        })
      })

      zone.on('pointerdown', () => {
        drawButton(true, true)
        text.setY(y + buttonHeight/2 + 1)
      })

      zone.on('pointerup', () => {
        drawButton(false, true)
        text.setY(y + buttonHeight/2 - 1)
        this.executeCommand(btn.action)
      })

      this.cardButtons.add([bg, text, zone])
    })
  }

  hideSelectionCard() {
    // Animated exit
    this.tweens.add({
      targets: this.selectionCard,
      x: -220,
      alpha: 0,
      duration: 200,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.selectionCard.setVisible(false)
      }
    })

    this.selectedUnit = null
    // Clear selection in game scene
    if (this.gameScene) {
      this.gameScene.selectedUnits.forEach(u => u.deselect())
      this.gameScene.selectedUnits = []
    }
    this.statusText.setText('Click a penguin!')
  }

  showBuildingCard(building) {
    // Reuse selection card for buildings
    this.selectionCard.setVisible(true)
    this.selectedUnit = null
    this.selectedBuilding = building

    // Animated entry
    this.selectionCard.setX(-200)
    this.selectionCard.setAlpha(0)
    this.tweens.add({
      targets: this.selectionCard,
      x: 20,
      alpha: 1,
      duration: 250,
      ease: 'Back.easeOut'
    })

    // Update avatar to building sprite
    this.cardAvatar.setTexture(building.type)
    this.cardAvatar.setScale(0)
    this.tweens.add({
      targets: this.cardAvatar,
      scale: 0.6,
      duration: 300,
      delay: 100,
      ease: 'Back.easeOut'
    })

    // Update name
    this.cardName.setText(building.name)

    // Status for building
    this.cardStatusBg.clear()
    this.cardStatusBg.fillStyle(0x6B3510, 1)
    this.cardStatusBg.fillRoundedRect(55, 130, 100, 24, 12)
    this.cardStatusBg.fillStyle(0x8B4513, 1)
    this.cardStatusBg.fillRoundedRect(55, 128, 100, 22, 11)
    this.cardStatusBg.fillStyle(0xFFFFFF, 0.25)
    this.cardStatusBg.fillRoundedRect(58, 130, 94, 8, { tl: 8, tr: 8, bl: 0, br: 0 })
    this.cardStatus.setText('BUILDING')

    // Building-specific buttons
    this.createBuildingButtons(building)

    this.statusText.setText(`Viewing: ${building.name}`)
  }

  createBuildingButtons(building) {
    this.cardButtons.removeAll(true)

    const buttonWidth = 196
    const buttonHeight = 40

    const buttons = [
      { label: 'SPAWN POLECAT', action: 'spawn', color: 0x2ECC71 },
      { label: 'VIEW POLECATS', action: 'list', color: 0x3498DB }
    ]

    // Add clone button for rigs
    if (building.type === 'building-rig') {
      buttons.push({ label: 'CLONE REPO', action: 'clone', color: 0x9B59B6 })
    }

    buttons.forEach((btn, i) => {
      const y = i * (buttonHeight + 10)
      const darkColor = this.darkenColor(btn.color, 50)

      const bg = this.add.graphics()

      const drawButton = (pressed = false, hover = false) => {
        bg.clear()
        const yOffset = pressed ? 2 : 0

        if (!pressed) {
          bg.fillStyle(0x000000, 0.2)
          bg.fillRoundedRect(2, y + 3, buttonWidth - 4, buttonHeight, 12)
        }

        bg.fillStyle(darkColor, 1)
        bg.fillRoundedRect(0, y + yOffset + 2, buttonWidth, buttonHeight - 2, 12)
        bg.fillStyle(hover ? btn.color : this.darkenColor(btn.color, 10), 1)
        bg.fillRoundedRect(0, y + yOffset, buttonWidth, buttonHeight - 2, 12)

        bg.fillStyle(0xFFFFFF, pressed ? 0.2 : 0.35)
        bg.fillRoundedRect(3, y + yOffset + 3, buttonWidth - 6, buttonHeight * 0.35, { tl: 10, tr: 10, bl: 0, br: 0 })

        bg.lineStyle(1, 0xFFFFFF, 0.3)
        bg.strokeRoundedRect(0, y + yOffset, buttonWidth, buttonHeight - 2, 12)
      }

      drawButton()

      const text = this.add.text(buttonWidth/2, y + buttonHeight/2 - 1, btn.label, {
        font: 'bold 14px Fredoka',
        fill: '#FFFFFF'
      }).setOrigin(0.5)

      const zone = this.add.zone(buttonWidth/2, y + buttonHeight/2, buttonWidth, buttonHeight)
      zone.setInteractive({ useHandCursor: true })

      zone.on('pointerover', () => drawButton(false, true))
      zone.on('pointerout', () => drawButton(false, false))
      zone.on('pointerdown', () => {
        drawButton(true, true)
        text.setY(y + buttonHeight/2 + 1)
      })
      zone.on('pointerup', () => {
        drawButton(false, true)
        text.setY(y + buttonHeight/2 - 1)
        this.executeBuildingCommand(btn.action, building)
      })

      this.cardButtons.add([bg, text, zone])
    })
  }

  async executeBuildingCommand(action, building) {
    const rigName = building.name

    switch(action) {
      case 'spawn':
        try {
          this.statusText.setText('Spawning polecat...')
          const result = await this.api.spawnPolecat(rigName)
          this.statusText.setText(`Spawned: ${result.name}`)
          await this.showModal({
            title: 'POLECAT SPAWNED!',
            message: `New polecat "${result.name}" is ready to work!`,
            showCancel: false
          })
          if (this.gameScene) this.gameScene.refreshState()
        } catch(e) {
          this.statusText.setText('Spawn failed')
          await this.showModal({
            title: 'SPAWN FAILED',
            message: e.message,
            showCancel: false
          })
        }
        break
      case 'list':
        try {
          const polecats = await this.api.getPolecats(rigName)
          const list = polecats.length > 0
            ? polecats.map(p => `• ${p.name} (${p.status})`).join('\n')
            : 'No polecats yet'
          await this.showModal({
            title: `POLECATS IN ${rigName.toUpperCase()}`,
            message: list,
            showCancel: false
          })
        } catch(e) {
          await this.showModal({
            title: 'ERROR',
            message: e.message,
            showCancel: false
          })
        }
        break
      case 'clone':
        const repo = await this.showModal({
          title: 'CLONE REPO',
          message: `Clone a repository into ${rigName}`,
          inputType: 'text',
          placeholder: 'https://github.com/user/repo'
        })
        if (repo) {
          try {
            this.statusText.setText('Cloning...')
            await this.api.cloneRepo(rigName, repo)
            this.statusText.setText('Cloned!')
            await this.showModal({
              title: 'SUCCESS!',
              message: `Cloned ${repo} into ${rigName}`,
              showCancel: false
            })
          } catch(e) {
            this.statusText.setText('Clone failed')
            await this.showModal({
              title: 'CLONE FAILED',
              message: e.message,
              showCancel: false
            })
          }
        }
        break
    }
  }

  drawButton(graphics, x, y, width, height, color, raised = false) {
    const darkColor = this.darkenColor(color, 50)

    // Shadow
    if (raised) {
      graphics.fillStyle(0x000000, 0.25)
      graphics.fillRoundedRect(x + 2, y + 4, width, height, 12)
    }

    // Base
    graphics.fillStyle(darkColor, 1)
    graphics.fillRoundedRect(x, y + 2, width, height, 12)

    // Main button
    graphics.fillStyle(color, 1)
    graphics.fillRoundedRect(x, y, width, height, 12)

    // Top highlight (glossy)
    graphics.fillStyle(0xFFFFFF, 0.35)
    graphics.fillRoundedRect(x + 3, y + 3, width - 6, height * 0.35, { tl: 10, tr: 10, bl: 0, br: 0 })

    // Border
    graphics.lineStyle(1, 0xFFFFFF, 0.3)
    graphics.strokeRoundedRect(x, y, width, height, 12)
  }

  createTooltip() {
    this.tooltip = this.add.container(0, 0)
    this.tooltip.setVisible(false)

    const bg = this.add.graphics()

    // Frosted glass tooltip
    bg.fillStyle(0x000000, 0.15)
    bg.fillRoundedRect(4, 4, 170, 65, 12)
    bg.fillStyle(0xFFFFFF, 0.95)
    bg.fillRoundedRect(0, 0, 170, 65, 12)
    bg.fillStyle(0xF8FCFF, 0.8)
    bg.fillRoundedRect(2, 2, 166, 30, { tl: 10, tr: 10, bl: 0, br: 0 })
    bg.lineStyle(2, 0x0077B6, 0.8)
    bg.strokeRoundedRect(0, 0, 170, 65, 12)

    this.tooltipText = this.add.text(14, 12, '', {
      font: 'bold 13px Fredoka',
      fill: '#0077B6',
      wordWrap: { width: 150 }
    })

    this.tooltip.add([bg, this.tooltipText])
  }

  showTooltip(data) {
    let text = data.name
    if (data.status) text += `\nStatus: ${data.status}`
    if (data.type) text += `\nType: ${data.type}`

    this.tooltipText.setText(text)
    this.tooltip.setPosition(data.x + 25, data.y - 80)
    this.tooltip.setVisible(true)

    // Fade in
    this.tooltip.setAlpha(0)
    this.tweens.add({
      targets: this.tooltip,
      alpha: 1,
      duration: 100
    })
  }

  hideTooltip() {
    this.tooltip.setVisible(false)
  }

  updateSelection(units) {
    if (units.length === 0) {
      this.hideSelectionCard()
    } else if (units.length === 1) {
      this.showSelectionCard(units[0])
    } else {
      // Multiple selection - show first one for now
      this.showSelectionCard(units[0])
      this.statusText.setText(`${units.length} penguins selected`)
    }
  }

  onBuildingClicked(building) {
    this.showBuildingCard(building)
  }

  updateResources(state) {
    if (state.tokens !== undefined) {
      this.animateResourceCounter(this.resources.tokens, state.tokens)
    }
    if (state.openIssues !== undefined) {
      this.animateResourceCounter(this.resources.issues, state.openIssues)
    }
    if (state.activeConvoys !== undefined) {
      this.animateResourceCounter(this.resources.convoys, state.activeConvoys)
    }
  }

  executeCommand(action) {
    // Get selected unit from card
    const unit = this.selectedUnit

    if (!unit) {
      window.alert('Select a penguin first!')
      return
    }

    const agentId = unit.id || 'unknown'
    console.log('Executing command:', action, 'on', agentId)

    switch(action) {
      case 'sling':
        this.doSling(agentId)
        break
      case 'hook':
        this.doViewHook(agentId)
        break
      case 'mail':
        this.doSendMail(agentId)
        break
      case 'stop':
        this.doStop(agentId)
        break
    }
  }

  async doSling(agentId) {
    const issueId = await this.showModal({
      title: 'ASSIGN WORK',
      message: `Sling work to ${agentId}`,
      inputType: 'text',
      placeholder: '#123 or issue URL'
    })
    if (!issueId) return

    try {
      this.statusText.setText('Slinging...')
      await this.api.sling(agentId, issueId.replace('#', ''))
      this.statusText.setText(`Slung ${issueId} to ${agentId}!`)
      await this.showModal({
        title: 'WORK ASSIGNED!',
        message: `Successfully slung ${issueId} to ${agentId}`,
        showCancel: false
      })
    } catch (e) {
      this.statusText.setText('Sling failed')
      await this.showModal({
        title: 'SLING FAILED',
        message: e.message,
        showCancel: false
      })
    }
  }

  async doViewHook(agentId) {
    try {
      this.statusText.setText('Loading hook...')
      const result = await this.api.getHook(agentId)
      const hook = result.hook || 'No active hook'
      this.statusText.setText('Hook loaded')
      await this.showModal({
        title: 'CURRENT HOOK',
        message: `${agentId}:\n\n${hook}`,
        showCancel: false
      })
    } catch (e) {
      this.statusText.setText('Failed to load hook')
      await this.showModal({
        title: 'HOOK ERROR',
        message: e.message,
        showCancel: false
      })
    }
  }

  async doSendMail(agentId) {
    const message = await this.showModal({
      title: 'SEND MESSAGE',
      message: `Send a message to ${agentId}`,
      inputType: 'text',
      placeholder: 'Type your message...'
    })
    if (!message) return

    const subject = await this.showModal({
      title: 'SUBJECT',
      message: 'Enter subject (optional)',
      inputType: 'text',
      placeholder: 'Subject line...'
    }) || ''

    try {
      this.statusText.setText('Sending mail...')
      await this.api.sendMail(agentId, subject, message)
      this.statusText.setText('Mail sent!')
      await this.showModal({
        title: 'MESSAGE SENT!',
        message: `Your message was delivered to ${agentId}`,
        showCancel: false
      })
    } catch (e) {
      this.statusText.setText('Mail failed')
      await this.showModal({
        title: 'SEND FAILED',
        message: e.message,
        showCancel: false
      })
    }
  }

  async doStop(agentId) {
    const confirm = await this.showModal({
      title: 'EMERGENCY STOP',
      message: `Stop ${agentId}?\n\nThis will halt the agent immediately.`,
      showCancel: true
    })
    if (!confirm) return

    try {
      this.statusText.setText('Stopping...')
      await this.api.stop(agentId)
      this.statusText.setText(`${agentId} stopped!`)
      await this.showModal({
        title: 'STOPPED',
        message: `${agentId} has been stopped`,
        showCancel: false
      })
    } catch (e) {
      this.statusText.setText('Stop failed')
      await this.showModal({
        title: 'STOP FAILED',
        message: e.message,
        showCancel: false
      })
    }
  }

  // Mayor Chat Panel
  createMayorChatPanel() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const panelWidth = 360
    const panelHeight = 450

    this.mayorChat = this.add.container(width - panelWidth - 20, 70)
    this.mayorChat.setVisible(false)
    this.mayorChat.setDepth(900)

    // Panel background
    const bg = this.add.graphics()
    // Shadow
    bg.fillStyle(0x000000, 0.3)
    bg.fillRoundedRect(5, 5, panelWidth, panelHeight, 20)
    // Main panel
    bg.fillStyle(0xFFFFFF, 0.98)
    bg.fillRoundedRect(0, 0, panelWidth, panelHeight, 20)
    // Header
    bg.fillStyle(0x8B4513, 1)
    bg.fillRoundedRect(0, 0, panelWidth, 65, { tl: 20, tr: 20, bl: 0, br: 0 })
    bg.fillStyle(0x6B3510, 1)
    bg.fillRoundedRect(0, 45, panelWidth, 20, 0)
    // Header shine
    bg.fillStyle(0xFFFFFF, 0.15)
    bg.fillRoundedRect(4, 4, panelWidth - 8, 20, { tl: 16, tr: 16, bl: 0, br: 0 })
    // Border
    bg.lineStyle(3, 0x8B4513, 1)
    bg.strokeRoundedRect(0, 0, panelWidth, panelHeight, 20)

    // Mayor avatar
    const avatarBg = this.add.graphics()
    avatarBg.fillStyle(0xFFFFFF, 1)
    avatarBg.fillCircle(45, 35, 28)
    avatarBg.lineStyle(3, 0x6B3510, 1)
    avatarBg.strokeCircle(45, 35, 28)

    const mayorAvatar = this.add.image(45, 35, 'unit-mayor').setScale(0.6)

    // Title
    const title = this.add.text(85, 20, 'MAYOR', {
      font: 'bold 22px Fredoka',
      fill: '#FFFFFF',
      stroke: '#6B3510',
      strokeThickness: 2
    })

    const subtitle = this.add.text(85, 44, 'Town Manager', {
      font: '13px Fredoka',
      fill: '#D2B48C'
    })

    // Close button
    const closeBtn = this.add.graphics()
    closeBtn.fillStyle(0xFF6B6B, 0.9)
    closeBtn.fillCircle(panelWidth - 25, 25, 14)
    const closeX = this.add.text(panelWidth - 25, 25, '×', {
      font: 'bold 20px Fredoka',
      fill: '#FFFFFF'
    }).setOrigin(0.5)
    const closeZone = this.add.zone(panelWidth - 25, 25, 28, 28).setInteractive({ useHandCursor: true })
    closeZone.on('pointerdown', () => this.closeMayorChat())

    // Chat history area
    const chatBg = this.add.graphics()
    chatBg.fillStyle(0xF5F5F5, 1)
    chatBg.fillRoundedRect(12, 75, panelWidth - 24, panelHeight - 150, 12)

    // Chat messages container (will scroll)
    this.chatMessages = this.add.container(20, 85)
    this.chatHistory = []
    this.chatScrollY = 0

    // Input area background
    const inputBg = this.add.graphics()
    inputBg.fillStyle(0xE8F4FC, 1)
    inputBg.fillRoundedRect(12, panelHeight - 65, panelWidth - 80, 45, 10)
    inputBg.lineStyle(2, 0x0077B6, 0.5)
    inputBg.strokeRoundedRect(12, panelHeight - 65, panelWidth - 80, 45, 10)

    // Send button
    const sendBtn = this.add.graphics()
    this.drawButton(sendBtn, panelWidth - 60, panelHeight - 65, 48, 45, 0x2ECC71, true)
    const sendText = this.add.text(panelWidth - 36, panelHeight - 42, '➤', {
      font: 'bold 20px Fredoka',
      fill: '#FFFFFF'
    }).setOrigin(0.5)
    const sendZone = this.add.zone(panelWidth - 36, panelHeight - 42, 48, 45).setInteractive({ useHandCursor: true })
    sendZone.on('pointerdown', () => this.sendMayorMessage())

    this.mayorChat.add([bg, avatarBg, mayorAvatar, title, subtitle, closeBtn, closeX, closeZone,
                        chatBg, this.chatMessages, inputBg, sendBtn, sendText, sendZone])

    // Add welcome message
    this.addMayorMessage("mayor", "Welcome to Penguin Town! I'm the Mayor. I can help you:\n\n• Create new projects\n• Clone repos\n• Assign work to polecats\n\nWhat would you like to do?")
  }

  openMayorChat() {
    this.mayorChat.setVisible(true)
    this.mayorChat.setAlpha(0)
    this.mayorChat.setX(this.cameras.main.width)

    this.tweens.add({
      targets: this.mayorChat,
      x: this.cameras.main.width - 380,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut'
    })

    // Create DOM input for chat
    if (!this.chatInput) {
      this.chatInput = document.createElement('input')
      this.chatInput.type = 'text'
      this.chatInput.placeholder = 'Ask the Mayor...'
      this.chatInput.style.cssText = `
        position: fixed;
        right: 100px;
        bottom: calc(100vh - ${70 + 450 - 55}px);
        width: 250px;
        height: 30px;
        font-family: Fredoka, sans-serif;
        font-size: 14px;
        border: none;
        background: transparent;
        outline: none;
        color: #333;
      `
      document.body.appendChild(this.chatInput)

      this.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && this.chatInput.value.trim()) {
          this.sendMayorMessage()
        }
      })
    }
    this.chatInput.style.display = 'block'
    this.chatInput.focus()
  }

  closeMayorChat() {
    this.tweens.add({
      targets: this.mayorChat,
      x: this.cameras.main.width + 50,
      alpha: 0,
      duration: 200,
      ease: 'Back.easeIn',
      onComplete: () => this.mayorChat.setVisible(false)
    })

    if (this.chatInput) {
      this.chatInput.style.display = 'none'
    }
  }

  addMayorMessage(sender, text) {
    const isUser = sender === 'user'
    const yPos = this.chatHistory.length * 70

    const msgContainer = this.add.container(0, yPos)

    // Message bubble
    const bubble = this.add.graphics()
    const bubbleWidth = 300
    const textObj = this.add.text(isUser ? bubbleWidth - 10 : 10, 8, text, {
      font: '13px Fredoka',
      fill: isUser ? '#FFFFFF' : '#333333',
      wordWrap: { width: bubbleWidth - 30 }
    })
    if (isUser) textObj.setOrigin(1, 0)

    const bubbleHeight = Math.max(40, textObj.height + 16)

    if (isUser) {
      bubble.fillStyle(0x0077B6, 1)
      bubble.fillRoundedRect(bubbleWidth - textObj.width - 24, 0, textObj.width + 20, bubbleHeight, 12)
    } else {
      bubble.fillStyle(0xE8E8E8, 1)
      bubble.fillRoundedRect(0, 0, textObj.width + 20, bubbleHeight, 12)
    }

    msgContainer.add([bubble, textObj])
    this.chatMessages.add(msgContainer)
    this.chatHistory.push({ sender, text })

    // Scroll to bottom
    const maxScroll = Math.max(0, (this.chatHistory.length * 70) - 280)
    this.chatMessages.y = 85 - maxScroll
  }

  async sendMayorMessage() {
    const text = this.chatInput?.value?.trim()
    if (!text) return

    this.chatInput.value = ''
    this.addMayorMessage('user', text)

    // Process the message
    await this.processMayorCommand(text)
  }

  async processMayorCommand(text) {
    const lower = text.toLowerCase()

    // Simple command parsing
    if (lower.includes('new project') || lower.includes('create project') || lower.includes('start project')) {
      this.addMayorMessage('mayor', "Great! Let's create a new project. What would you like to name it?")
      this.mayorState = 'awaiting_project_name'
      return
    }

    if (lower.includes('clone') && (lower.includes('github') || lower.includes('repo'))) {
      // Extract URL if present
      const urlMatch = text.match(/https?:\/\/[^\s]+|github\.com\/[^\s]+/)
      if (urlMatch) {
        const url = urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`
        this.addMayorMessage('mayor', `I'll clone ${url} for you. What should I name this project?`)
        this.mayorState = 'awaiting_clone_name'
        this.pendingRepoUrl = url
        return
      }
      this.addMayorMessage('mayor', "Sure! What's the repository URL you'd like to clone?")
      this.mayorState = 'awaiting_repo_url'
      return
    }

    if (lower.includes('work on') || lower.includes('assign') || lower.includes('issue')) {
      const issueMatch = text.match(/#?(\d+)/)
      if (issueMatch) {
        this.addMayorMessage('mayor', `I'll assign issue #${issueMatch[1]}. Which polecat should work on it?`)
        this.mayorState = 'awaiting_polecat_for_issue'
        this.pendingIssue = issueMatch[1]
        return
      }
      this.addMayorMessage('mayor', "Which issue number would you like to assign? (e.g., #123)")
      this.mayorState = 'awaiting_issue_number'
      return
    }

    if (lower.includes('spawn') || lower.includes('new polecat') || lower.includes('create polecat')) {
      this.addMayorMessage('mayor', "I'll spawn a new polecat. Which project should they join?")
      this.mayorState = 'awaiting_spawn_project'
      return
    }

    if (lower.includes('list') || lower.includes('show') || lower.includes('projects') || lower.includes('villages')) {
      const villages = this.gameScene?.villages || []
      if (villages.length === 0) {
        this.addMayorMessage('mayor', "No projects yet! Say 'new project' to create one.")
      } else {
        const list = villages.map(v => `• ${v.name} (${v.polecats?.length || 0} polecats)`).join('\n')
        this.addMayorMessage('mayor', `Here are your projects:\n\n${list}`)
      }
      return
    }

    if (lower.includes('help')) {
      this.addMayorMessage('mayor', "I can help you with:\n\n• 'New project' - Create a village\n• 'Clone [url]' - Import a repo\n• 'Assign #123' - Give work\n• 'Spawn polecat' - New worker\n• 'List projects' - See all villages")
      return
    }

    // Handle state-based responses
    if (this.mayorState === 'awaiting_project_name') {
      const name = text.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
      this.addMayorMessage('mayor', `Creating project "${name}"...`)
      try {
        await this.api.createRig(name)
        if (this.gameScene) {
          this.gameScene.addVillage(name)
        }
        this.addMayorMessage('mayor', `Done! "${name}" village is ready. Want me to clone a repo into it?`)
        this.currentProject = name
        this.mayorState = 'awaiting_clone_confirm'
      } catch (e) {
        this.addMayorMessage('mayor', `Oops! Failed to create project: ${e.message}`)
        this.mayorState = null
      }
      return
    }

    if (this.mayorState === 'awaiting_repo_url') {
      const url = text.startsWith('http') ? text : `https://${text}`
      this.addMayorMessage('mayor', "Got it! What should I name this project?")
      this.pendingRepoUrl = url
      this.mayorState = 'awaiting_clone_name'
      return
    }

    if (this.mayorState === 'awaiting_clone_name') {
      const name = text.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
      this.addMayorMessage('mayor', `Creating "${name}" and cloning the repo...`)
      try {
        await this.api.createRig(name)
        await this.api.cloneRepo(name, this.pendingRepoUrl)
        if (this.gameScene) {
          this.gameScene.addVillage(name, this.pendingRepoUrl)
        }
        this.addMayorMessage('mayor', `Success! "${name}" is set up with the repo. Shall I spawn a polecat to work on it?`)
        this.currentProject = name
        this.mayorState = 'awaiting_spawn_confirm'
      } catch (e) {
        this.addMayorMessage('mayor', `Failed: ${e.message}`)
        this.mayorState = null
      }
      return
    }

    if (this.mayorState === 'awaiting_clone_confirm') {
      if (lower.includes('yes') || lower.includes('sure') || lower.includes('ok')) {
        this.addMayorMessage('mayor', "What's the repo URL?")
        this.mayorState = 'awaiting_repo_for_existing'
      } else {
        this.addMayorMessage('mayor', "No problem! Let me know if you need anything else.")
        this.mayorState = null
      }
      return
    }

    if (this.mayorState === 'awaiting_repo_for_existing') {
      const url = text.startsWith('http') ? text : `https://${text}`
      this.addMayorMessage('mayor', `Cloning into "${this.currentProject}"...`)
      try {
        await this.api.cloneRepo(this.currentProject, url)
        this.addMayorMessage('mayor', "Cloned! Want me to spawn a polecat?")
        this.mayorState = 'awaiting_spawn_confirm'
      } catch (e) {
        this.addMayorMessage('mayor', `Clone failed: ${e.message}`)
        this.mayorState = null
      }
      return
    }

    if (this.mayorState === 'awaiting_spawn_confirm') {
      if (lower.includes('yes') || lower.includes('sure') || lower.includes('ok')) {
        this.addMayorMessage('mayor', "Spawning a polecat...")
        try {
          const result = await this.api.spawnPolecat(this.currentProject)
          if (this.gameScene) {
            this.gameScene.addPolecatToVillage(this.currentProject, result.name)
          }
          this.addMayorMessage('mayor', `${result.name} has joined! Give them an issue number to work on.`)
          this.currentPolecat = result.name
          this.mayorState = 'awaiting_issue_for_polecat'
        } catch (e) {
          this.addMayorMessage('mayor', `Spawn failed: ${e.message}`)
          this.mayorState = null
        }
      } else {
        this.addMayorMessage('mayor', "Alright! The project is ready whenever you need it.")
        this.mayorState = null
      }
      return
    }

    if (this.mayorState === 'awaiting_issue_for_polecat') {
      const issueMatch = text.match(/#?(\d+)/)
      if (issueMatch) {
        this.addMayorMessage('mayor', `Assigning #${issueMatch[1]} to ${this.currentPolecat}...`)
        try {
          await this.api.sling(`${this.currentProject}/polecats/${this.currentPolecat}`, issueMatch[1])
          this.addMayorMessage('mayor', `Done! ${this.currentPolecat} is now working on #${issueMatch[1]}. 🎉`)
          if (this.gameScene) {
            this.gameScene.refreshState()
          }
        } catch (e) {
          this.addMayorMessage('mayor', `Assignment failed: ${e.message}`)
        }
        this.mayorState = null
      } else {
        this.addMayorMessage('mayor', "I need an issue number, like #123 or just 123")
      }
      return
    }

    // Default response
    this.addMayorMessage('mayor', "I'm not sure what you mean. Try 'help' to see what I can do!")
    this.mayorState = null
  }

  handleResize(gameSize) {
    const width = gameSize.width
    const height = gameSize.height

    // Reposition UI elements
    if (this.topBar) {
      this.topBar.clear()
      this.drawGlossyPanel(this.topBar, 10, 8, width - 20, 50, 0x0077B6, 14)
    }

    if (this.townName) {
      this.townName.setPosition(width - 30, 18)
    }

    if (this.statusText) {
      this.statusText.setPosition(width - 30, 40)
    }
  }

  createVillageNavigator() {
    // Village navigator - small panel to jump between villages
    const x = 20
    const y = this.cameras.main.height - 200
    const width = 150

    this.villageNav = this.add.container(x, y)
    this.villageNav.setDepth(100)

    // Background
    this.villageNavBg = this.add.graphics()
    this.villageNav.add(this.villageNavBg)

    // Title
    this.villageNavTitle = this.add.text(width/2, 12, 'VILLAGES', {
      font: 'bold 12px Fredoka',
      fill: '#FFFFFF',
      stroke: '#005588',
      strokeThickness: 2
    }).setOrigin(0.5, 0)
    this.villageNav.add(this.villageNavTitle)

    // Village buttons container
    this.villageButtons = this.add.container(0, 35)
    this.villageNav.add(this.villageButtons)

    this.updateVillageNavigator()
  }

  updateVillageNavigator() {
    const villages = this.gameScene?.villages || []
    const width = 150
    const buttonHeight = 32

    // Clear existing buttons
    this.villageButtons.removeAll(true)

    // Calculate panel height
    const panelHeight = 45 + villages.length * (buttonHeight + 5)

    // Redraw background
    this.villageNavBg.clear()
    this.drawGlossyPanel(this.villageNavBg, 0, 0, width, panelHeight, 0x0077B6, 12)

    // Add button for each village
    villages.forEach((village, i) => {
      const y = i * (buttonHeight + 5)

      const btn = this.add.graphics()
      const color = village.isHub ? 0x8B4513 : 0x2ECC71

      // Button background
      btn.fillStyle(this.darkenColor(color, 30), 1)
      btn.fillRoundedRect(8, y + 2, width - 16, buttonHeight - 2, 8)
      btn.fillStyle(color, 1)
      btn.fillRoundedRect(8, y, width - 16, buttonHeight - 2, 8)
      // Shine
      btn.fillStyle(0xFFFFFF, 0.2)
      btn.fillRoundedRect(10, y + 2, width - 20, 10, { tl: 6, tr: 6, bl: 0, br: 0 })

      // Label
      const label = this.add.text(width/2, y + buttonHeight/2 - 1, village.name, {
        font: 'bold 11px Fredoka',
        fill: '#FFFFFF'
      }).setOrigin(0.5)

      // Polecat count
      const count = this.add.text(width - 20, y + buttonHeight/2 - 1, `${village.polecats?.length || 0}`, {
        font: '10px Fredoka',
        fill: '#FFFFFF',
        backgroundColor: '#00000033',
        padding: { x: 4, y: 2 }
      }).setOrigin(1, 0.5)

      // Interaction
      const zone = this.add.zone(width/2, y + buttonHeight/2, width - 16, buttonHeight)
      zone.setInteractive({ useHandCursor: true })

      zone.on('pointerover', () => {
        btn.clear()
        btn.fillStyle(this.darkenColor(color, 10), 1)
        btn.fillRoundedRect(8, y + 2, width - 16, buttonHeight - 2, 8)
        btn.fillStyle(color, 1)
        btn.fillRoundedRect(8, y - 2, width - 16, buttonHeight - 2, 8)
        btn.fillStyle(0xFFFFFF, 0.3)
        btn.fillRoundedRect(10, y, width - 20, 10, { tl: 6, tr: 6, bl: 0, br: 0 })
        label.setY(y + buttonHeight/2 - 3)
        count.setY(y + buttonHeight/2 - 3)
      })

      zone.on('pointerout', () => {
        btn.clear()
        btn.fillStyle(this.darkenColor(color, 30), 1)
        btn.fillRoundedRect(8, y + 2, width - 16, buttonHeight - 2, 8)
        btn.fillStyle(color, 1)
        btn.fillRoundedRect(8, y, width - 16, buttonHeight - 2, 8)
        btn.fillStyle(0xFFFFFF, 0.2)
        btn.fillRoundedRect(10, y + 2, width - 20, 10, { tl: 6, tr: 6, bl: 0, br: 0 })
        label.setY(y + buttonHeight/2 - 1)
        count.setY(y + buttonHeight/2 - 1)
      })

      zone.on('pointerdown', () => {
        if (this.gameScene) {
          this.gameScene.panToVillage(village.name)
        }
      })

      this.villageButtons.add([btn, label, count, zone])
    })

    // Reposition the navigator based on new height
    this.villageNav.setY(this.cameras.main.height - panelHeight - 80)
  }

  createNewProjectButton() {
    // "New Project" button in bottom left corner
    const x = 20
    const y = this.cameras.main.height - 65
    const width = 150
    const height = 48

    this.newProjectBtn = this.add.container(x, y)

    const bg = this.add.graphics()
    this.drawButton(bg, 0, 0, width, height, 0x9B59B6, true)

    const text = this.add.text(width/2, height/2, '+ NEW PROJECT', {
      font: 'bold 15px Fredoka',
      fill: '#FFFFFF',
      stroke: '#00000044',
      strokeThickness: 1
    }).setOrigin(0.5)

    const zone = this.add.zone(width/2, height/2, width, height)
    zone.setInteractive({ useHandCursor: true })

    zone.on('pointerover', () => {
      bg.clear()
      this.drawButton(bg, 0, -3, width, height, 0x8E44AD, true)
      text.setY(height/2 - 3)
    })

    zone.on('pointerout', () => {
      bg.clear()
      this.drawButton(bg, 0, 0, width, height, 0x9B59B6, true)
      text.setY(height/2)
    })

    zone.on('pointerdown', () => {
      bg.clear()
      this.drawButton(bg, 0, 2, width, height, 0x7D3C98, false)
      text.setY(height/2 + 2)
    })

    zone.on('pointerup', () => {
      bg.clear()
      this.drawButton(bg, 0, 0, width, height, 0x9B59B6, true)
      text.setY(height/2)
      this.showNewProjectDialog()
    })

    this.newProjectBtn.add([bg, text, zone])
  }

  // Club Penguin style modal dialog
  showModal(options) {
    return new Promise((resolve) => {
      const { title, message, placeholder, defaultValue, showCancel = true } = options
      const width = this.cameras.main.width
      const height = this.cameras.main.height
      const modalWidth = 380
      const modalHeight = options.inputType ? 240 : 180

      // Modal container
      this.modal = this.add.container(width/2, height/2)
      this.modal.setDepth(1000)

      // Backdrop
      const backdrop = this.add.graphics()
      backdrop.fillStyle(0x000000, 0.6)
      backdrop.fillRect(-width/2, -height/2, width, height)
      backdrop.setInteractive(new Phaser.Geom.Rectangle(-width/2, -height/2, width, height), Phaser.Geom.Rectangle.Contains)

      // Modal card
      const card = this.add.graphics()
      // Outer glow
      card.fillStyle(0x87CEEB, 0.5)
      card.fillRoundedRect(-modalWidth/2 - 6, -modalHeight/2 - 6, modalWidth + 12, modalHeight + 12, 24)
      // Shadow
      card.fillStyle(0x000000, 0.3)
      card.fillRoundedRect(-modalWidth/2 + 6, -modalHeight/2 + 6, modalWidth, modalHeight, 22)
      // Main card
      card.fillStyle(0xFFFFFF, 0.98)
      card.fillRoundedRect(-modalWidth/2, -modalHeight/2, modalWidth, modalHeight, 22)
      // Header
      card.fillStyle(0x0077B6, 1)
      card.fillRoundedRect(-modalWidth/2, -modalHeight/2, modalWidth, 55, { tl: 22, tr: 22, bl: 0, br: 0 })
      card.fillStyle(0x005588, 1)
      card.fillRoundedRect(-modalWidth/2, -modalHeight/2 + 35, modalWidth, 20, 0)
      // Header shine
      card.fillStyle(0xFFFFFF, 0.2)
      card.fillRoundedRect(-modalWidth/2 + 4, -modalHeight/2 + 4, modalWidth - 8, 18, { tl: 18, tr: 18, bl: 0, br: 0 })
      // Border
      card.lineStyle(3, 0x0077B6, 1)
      card.strokeRoundedRect(-modalWidth/2, -modalHeight/2, modalWidth, modalHeight, 22)

      // Title
      const titleText = this.add.text(0, -modalHeight/2 + 28, title, {
        font: 'bold 20px Fredoka',
        fill: '#FFFFFF',
        stroke: '#005588',
        strokeThickness: 2
      }).setOrigin(0.5)

      // Message
      const msgText = this.add.text(0, -modalHeight/2 + 75, message, {
        font: '14px Fredoka',
        fill: '#333333',
        align: 'center',
        wordWrap: { width: modalWidth - 40 }
      }).setOrigin(0.5, 0)

      this.modal.add([backdrop, card, titleText, msgText])

      let inputValue = defaultValue || ''

      // Input field if needed
      if (options.inputType) {
        const inputBg = this.add.graphics()
        inputBg.fillStyle(0xE8F4FC, 1)
        inputBg.fillRoundedRect(-modalWidth/2 + 20, -modalHeight/2 + 110, modalWidth - 40, 40, 10)
        inputBg.lineStyle(2, 0x0077B6, 0.5)
        inputBg.strokeRoundedRect(-modalWidth/2 + 20, -modalHeight/2 + 110, modalWidth - 40, 40, 10)

        // Use DOM input for text entry
        const inputEl = document.createElement('input')
        inputEl.type = 'text'
        inputEl.value = defaultValue || ''
        inputEl.placeholder = placeholder || ''
        inputEl.style.cssText = `
          position: fixed;
          left: ${width/2 - modalWidth/2 + 28}px;
          top: ${height/2 - modalHeight/2 + 115}px;
          width: ${modalWidth - 60}px;
          height: 30px;
          font-family: Fredoka, sans-serif;
          font-size: 16px;
          border: none;
          background: transparent;
          outline: none;
          color: #0077B6;
        `
        document.body.appendChild(inputEl)
        inputEl.focus()

        inputEl.addEventListener('input', (e) => {
          inputValue = e.target.value
        })

        inputEl.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            cleanup()
            resolve(inputValue)
          }
        })

        this.modal.inputEl = inputEl
        this.modal.add([inputBg])
      }

      // Buttons
      const btnY = modalHeight/2 - 45
      const btnWidth = showCancel ? 130 : 180
      const btnSpacing = showCancel ? 150 : 0

      const cleanup = () => {
        if (this.modal.inputEl) {
          this.modal.inputEl.remove()
        }
        this.modal.destroy()
        this.modal = null
      }

      // OK button
      const okBtn = this.add.graphics()
      this.drawButton(okBtn, showCancel ? 10 : -btnWidth/2, btnY - 18, btnWidth, 36, 0x2ECC71, true)
      const okText = this.add.text(showCancel ? 10 + btnWidth/2 : 0, btnY, 'OK', {
        font: 'bold 16px Fredoka',
        fill: '#FFFFFF'
      }).setOrigin(0.5)
      const okZone = this.add.zone(showCancel ? 10 + btnWidth/2 : 0, btnY, btnWidth, 36)
      okZone.setInteractive({ useHandCursor: true })
      okZone.on('pointerover', () => {
        okBtn.clear()
        this.drawButton(okBtn, showCancel ? 10 : -btnWidth/2, btnY - 20, btnWidth, 36, 0x27AE60, true)
        okText.setY(btnY - 2)
      })
      okZone.on('pointerout', () => {
        okBtn.clear()
        this.drawButton(okBtn, showCancel ? 10 : -btnWidth/2, btnY - 18, btnWidth, 36, 0x2ECC71, true)
        okText.setY(btnY)
      })
      okZone.on('pointerdown', () => {
        cleanup()
        resolve(inputValue || true)
      })

      this.modal.add([okBtn, okText, okZone])

      // Cancel button
      if (showCancel) {
        const cancelBtn = this.add.graphics()
        this.drawButton(cancelBtn, -btnWidth - 10, btnY - 18, btnWidth, 36, 0x95A5A6, true)
        const cancelText = this.add.text(-btnWidth/2 - 10, btnY, 'Cancel', {
          font: 'bold 16px Fredoka',
          fill: '#FFFFFF'
        }).setOrigin(0.5)
        const cancelZone = this.add.zone(-btnWidth/2 - 10, btnY, btnWidth, 36)
        cancelZone.setInteractive({ useHandCursor: true })
        cancelZone.on('pointerover', () => {
          cancelBtn.clear()
          this.drawButton(cancelBtn, -btnWidth - 10, btnY - 20, btnWidth, 36, 0x7F8C8D, true)
          cancelText.setY(btnY - 2)
        })
        cancelZone.on('pointerout', () => {
          cancelBtn.clear()
          this.drawButton(cancelBtn, -btnWidth - 10, btnY - 18, btnWidth, 36, 0x95A5A6, true)
          cancelText.setY(btnY)
        })
        cancelZone.on('pointerdown', () => {
          cleanup()
          resolve(null)
        })

        this.modal.add([cancelBtn, cancelText, cancelZone])
      }

      // Animate in
      this.modal.setScale(0.8)
      this.modal.setAlpha(0)
      this.tweens.add({
        targets: this.modal,
        scale: 1,
        alpha: 1,
        duration: 200,
        ease: 'Back.easeOut'
      })
    })
  }

  async showNewProjectDialog() {
    const rigName = await this.showModal({
      title: 'NEW PROJECT',
      message: 'Step 1/3: Enter a name for your project rig',
      inputType: 'text',
      placeholder: 'e.g., my-project'
    })
    if (!rigName) return

    const repoUrl = await this.showModal({
      title: 'CLONE REPO',
      message: 'Step 2/3: Enter repository URL to clone\n(Leave blank to skip)',
      inputType: 'text',
      placeholder: 'https://github.com/user/repo'
    })

    const issueId = await this.showModal({
      title: 'ASSIGN WORK',
      message: 'Step 3/3: Enter issue to sling\n(Leave blank to skip)',
      inputType: 'text',
      placeholder: '#123'
    })

    this.createProject(rigName, repoUrl, issueId)
  }

  async createProject(rigName, repoUrl, issueId) {
    try {
      // Show loading state
      this.statusText.setText('Creating project...')

      // Step 1: Create rig
      await this.api.createRig(rigName)
      console.log(`Created rig: ${rigName}`)

      // Step 2: Clone repo if provided
      if (repoUrl) {
        await this.api.cloneRepo(rigName, repoUrl)
        console.log(`Cloned repo: ${repoUrl}`)
      }

      // Step 3: Spawn a polecat
      const polecat = await this.api.spawnPolecat(rigName)
      console.log(`Spawned polecat: ${polecat.name}`)

      // Step 4: Sling issue if provided
      if (issueId) {
        const cleanIssue = issueId.replace('#', '')
        await this.api.sling(`${rigName}/polecats/${polecat.name}`, cleanIssue)
        console.log(`Slung issue: ${cleanIssue}`)
      }

      this.statusText.setText('Project created!')

      // Notify game scene to refresh and add new building
      if (this.gameScene) {
        this.gameScene.addBuilding(`rig-${rigName}`, rigName, 14, 8, 'building-rig')
        this.gameScene.refreshState()
      }

      await this.showModal({
        title: 'PROJECT CREATED!',
        message: `${rigName} is ready!\n\nPolecat "${polecat.name}" is standing by.`,
        showCancel: false
      })

    } catch (e) {
      console.error('Failed to create project:', e)
      this.statusText.setText('Failed to create project')
      await this.showModal({
        title: 'PROJECT FAILED',
        message: e.message,
        showCancel: false
      })
    }
  }

}
