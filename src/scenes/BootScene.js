import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Show loading bar - Club Penguin style
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    const progressBox = this.add.graphics()
    progressBox.fillStyle(0x0077B6, 0.9)
    progressBox.fillRoundedRect(width/2 - 165, height/2 - 30, 330, 60, 15)
    progressBox.lineStyle(3, 0xFFFFFF, 1)
    progressBox.strokeRoundedRect(width/2 - 165, height/2 - 30, 330, 60, 15)

    const progressBar = this.add.graphics()

    const loadingText = this.add.text(width/2, height/2 - 60, 'Waddling to Club Penguin...', {
      font: '20px Fredoka',
      fill: '#0077B6',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    this.load.on('progress', (value) => {
      progressBar.clear()
      progressBar.fillStyle(0x7EC8E3, 1)
      progressBar.fillRoundedRect(width/2 - 155, height/2 - 20, 310 * value, 40, 10)
    })
  }

  create() {
    // Generate all sprites procedurally (Club Penguin style!)
    this.generateSprites()
    this.scene.start('GameScene')
  }

  generateSprites() {
    // Snowy isometric tiles (2x resolution: 128x64)
    this.generateIsoTile('tile-grass', 0xFFFFFF, 0xE8F4FC)    // Fresh snow
    this.generateIsoTile('tile-dirt', 0xB0D4F1, 0x8FC1E3)     // Packed snow/ice
    this.generateIsoTile('tile-stone', 0x7EC8E3, 0x5BA3C6)    // Ice

    // Club Penguin Buildings (2x resolution)
    this.generateIgloo('building-rig')                         // Rig = Igloo
    this.generateSkiLodge('building-townhall')                 // Mayor HQ = Ski Lodge
    this.generateCoffeeShop('building-refinery')               // Refinery = Coffee Shop
    this.generatePetShop('building-barracks')                  // Barracks = Pet Shop

    // Penguin units (2.4x resolution: 48x56)
    this.generatePenguin('unit-polecat-idle', 0x3498DB, 'propeller')    // Blue propeller hat
    this.generatePenguin('unit-polecat-working', 0xF1C40F, 'hardhat')   // Yellow hard hat
    this.generatePenguin('unit-polecat-stuck', 0xE74C3C, 'warning')     // Red warning
    this.generatePenguin('unit-mayor', 0xFFD700, 'crown')               // Gold crown
    this.generatePenguin('unit-deacon', 0x9B59B6, 'wizard')             // Purple wizard hat
    this.generatePenguin('unit-refinery', 0xFFFFFF, 'chef')             // Chef hat

    // Selection ring (icy blue - local player) - enhanced with glow
    this.generateSelectionRing()

    // Multiplayer: colored cursors and selection rings
    this.generateMultiplayerSprites()

    // Resource icons (2x resolution: 32x32)
    this.generateCoinIcon('icon-tokens')
    this.generateFishIcon('icon-issues')
    this.generateStampIcon('icon-convoys')

    // Effect textures
    this.generateDustPuff()
    this.generateSparkle()

    // Sea lion for stuck animation
    this.generateSeaLion()
  }

  generateMultiplayerSprites() {
    // User colors matching server
    const colors = [
      { name: 'red', hex: 0xE74C3C },
      { name: 'green', hex: 0x2ECC71 },
      { name: 'blue', hex: 0x3498DB },
      { name: 'purple', hex: 0x9B59B6 },
      { name: 'orange', hex: 0xE67E22 },
      { name: 'pink', hex: 0xE91E8C }
    ]

    colors.forEach(color => {
      this.generateColoredCursor(color.name, color.hex)
      this.generateColoredSelectionRing(color.name, color.hex)
    })
  }

  generateColoredCursor(colorName, colorHex) {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const size = 32  // 2x from 24

    // Cursor pointer shape with shadow
    g.fillStyle(0x000000, 0.3)
    g.beginPath()
    g.moveTo(2, 2)
    g.lineTo(2, 26)
    g.lineTo(9, 20)
    g.lineTo(13, 30)
    g.lineTo(17, 29)
    g.lineTo(13, 19)
    g.lineTo(21, 19)
    g.closePath()
    g.fillPath()

    // Main cursor
    g.fillStyle(colorHex, 1)
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(0, 24)
    g.lineTo(7, 18)
    g.lineTo(11, 28)
    g.lineTo(15, 27)
    g.lineTo(11, 17)
    g.lineTo(19, 17)
    g.closePath()
    g.fillPath()

    // White outline for visibility
    g.lineStyle(2, 0xFFFFFF, 0.9)
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(0, 24)
    g.lineTo(7, 18)
    g.lineTo(11, 28)
    g.lineTo(15, 27)
    g.lineTo(11, 17)
    g.lineTo(19, 17)
    g.closePath()
    g.strokePath()

    g.generateTexture(`cursor-${colorName}`, size, size)
    g.destroy()
  }

  generateColoredSelectionRing(colorName, colorHex) {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const size = 48  // 2x from 24

    // Outer glow layers
    for (let i = 3; i >= 0; i--) {
      g.lineStyle(4 + i * 2, colorHex, 0.15 - i * 0.03)
      g.strokeEllipse(size/2, size/2 + 4, 44 + i * 4, 24 + i * 2)
    }

    // Main ring
    g.lineStyle(3, colorHex, 1)
    g.strokeEllipse(size/2, size/2 + 4, 40, 20)

    // Inner highlight
    g.lineStyle(1, 0xFFFFFF, 0.5)
    g.strokeEllipse(size/2, size/2 + 3, 36, 16)

    g.generateTexture(`selection-ring-${colorName}`, size, size)
    g.destroy()
  }

  generateIsoTile(key, topColor, edgeColor) {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const w = 128, h = 64  // 2x from 64x32

    // Diamond shape (isometric tile) - gradient from center to edge
    // Base color
    g.fillStyle(topColor, 1)
    g.beginPath()
    g.moveTo(w/2, 0)
    g.lineTo(w, h/2)
    g.lineTo(w/2, h)
    g.lineTo(0, h/2)
    g.closePath()
    g.fillPath()

    // Subtle gradient using layered shapes (lighter center)
    g.fillStyle(0xFFFFFF, 0.15)
    g.beginPath()
    g.moveTo(w/2, 8)
    g.lineTo(w - 16, h/2)
    g.lineTo(w/2, h - 8)
    g.lineTo(16, h/2)
    g.closePath()
    g.fillPath()

    g.fillStyle(0xFFFFFF, 0.1)
    g.beginPath()
    g.moveTo(w/2, 16)
    g.lineTo(w - 32, h/2)
    g.lineTo(w/2, h - 16)
    g.lineTo(32, h/2)
    g.closePath()
    g.fillPath()

    // Ice crack patterns on non-grass tiles
    if (key !== 'tile-grass') {
      g.lineStyle(1, edgeColor, 0.4)
      g.beginPath()
      g.moveTo(w * 0.3, h * 0.4)
      g.lineTo(w * 0.4, h * 0.5)
      g.lineTo(w * 0.35, h * 0.6)
      g.stroke()
      g.beginPath()
      g.moveTo(w * 0.6, h * 0.3)
      g.lineTo(w * 0.65, h * 0.45)
      g.stroke()
    }

    // Sparkle dots (snow glitter)
    g.fillStyle(0xFFFFFF, 0.8)
    g.fillCircle(w * 0.25, h * 0.35, 2)
    g.fillCircle(w * 0.6, h * 0.5, 2.5)
    g.fillCircle(w * 0.5, h * 0.25, 2)
    g.fillCircle(w * 0.75, h * 0.6, 1.5)
    g.fillCircle(w * 0.35, h * 0.65, 1.5)

    // Footprint impressions (randomly placed)
    g.fillStyle(edgeColor, 0.2)
    g.fillEllipse(w * 0.4, h * 0.55, 4, 2)
    g.fillEllipse(w * 0.45, h * 0.52, 4, 2)

    // Soft edge lines
    g.lineStyle(1, edgeColor, 0.5)
    g.beginPath()
    g.moveTo(w/2, 0)
    g.lineTo(w, h/2)
    g.lineTo(w/2, h)
    g.lineTo(0, h/2)
    g.closePath()
    g.strokePath()

    g.generateTexture(key, w, h)
    g.destroy()
  }

  generateIgloo(key) {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const w = 80, h = 72  // 2x from 40x36

    // Ground shadow (gradient)
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0x87CEEB, 0.15 - i * 0.025)
      g.fillEllipse(w/2, h - 4 + i, 72 - i * 4, 16 - i * 2)
    }

    // Igloo dome base (darker edge for depth)
    g.fillStyle(0xE8E8E8, 1)
    g.fillEllipse(w/2, h - 28, 64, 40)

    // Igloo dome main (white)
    g.fillStyle(0xFFFFFF, 1)
    g.fillEllipse(w/2, h - 30, 60, 36)

    // Dome gradient highlight (top lighter)
    g.fillStyle(0xFFFFFF, 1)
    g.fillEllipse(w/2, h - 36, 48, 24)

    // Side shading (left darker)
    g.fillStyle(0xD0E8F0, 0.5)
    g.fillEllipse(w/2 - 16, h - 26, 20, 28)

    // Top highlight (right side)
    g.fillStyle(0xFFFFFF, 0.8)
    g.fillEllipse(w/2 + 8, h - 38, 16, 12)

    // Ice block lines
    g.lineStyle(1, 0xB0D4F1, 0.6)
    g.beginPath()
    g.arc(w/2, h - 28, 28, Math.PI, 0)
    g.stroke()
    g.beginPath()
    g.arc(w/2, h - 28, 20, Math.PI * 1.1, Math.PI * 0.1, true)
    g.stroke()
    g.beginPath()
    g.moveTo(w/2 - 24, h - 20)
    g.lineTo(w/2 + 24, h - 20)
    g.stroke()

    // Door entrance with depth
    g.fillStyle(0x1A2530, 1)
    g.fillEllipse(w/2, h - 12, 20, 16)
    // Door inner shadow
    g.fillStyle(0x0A1520, 1)
    g.fillEllipse(w/2, h - 10, 14, 10)

    // Snow on top (lumpy)
    g.fillStyle(0xFFFFFF, 1)
    g.fillEllipse(w/2 - 8, h - 52, 12, 6)
    g.fillEllipse(w/2 + 4, h - 54, 16, 8)
    g.fillEllipse(w/2 + 12, h - 50, 10, 5)

    // Sparkle on dome
    g.fillStyle(0xFFFFFF, 0.9)
    g.fillCircle(w/2 + 12, h - 40, 2)
    g.fillCircle(w/2 - 8, h - 44, 1.5)

    g.generateTexture(key, w, h)
    g.destroy()
  }

  generateSkiLodge(key) {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const w = 128, h = 104  // 2x from 64x52

    // Ground shadow (gradient)
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0x87CEEB, 0.15 - i * 0.025)
      g.fillEllipse(w/2, h - 4 + i, 112 - i * 6, 20 - i * 2)
    }

    // Main building base (wood - darker bottom)
    g.fillStyle(0x6B3510, 1)
    g.fillRect(16, 40, 96, 56)

    // Main building (warm brown wood)
    g.fillStyle(0x8B4513, 1)
    g.fillRect(16, 38, 96, 54)

    // Wood grain effect
    g.lineStyle(1, 0x6B3510, 0.3)
    for (let y = 44; y < 90; y += 8) {
      g.beginPath()
      g.moveTo(18, y)
      g.lineTo(110, y)
      g.stroke()
    }

    // Lighter wood panel (right side for 3D effect)
    g.fillStyle(0xA0522D, 1)
    g.fillRect(72, 38, 40, 54)

    // Roof base (darker snow)
    g.fillStyle(0xE0E8EC, 1)
    g.beginPath()
    g.moveTo(w/2, 6)
    g.lineTo(w - 2, 44)
    g.lineTo(4, 44)
    g.closePath()
    g.fillPath()

    // Roof main (snowy white)
    g.fillStyle(0xFFFFFF, 1)
    g.beginPath()
    g.moveTo(w/2, 8)
    g.lineTo(w - 6, 42)
    g.lineTo(6, 42)
    g.closePath()
    g.fillPath()

    // Roof shadow (right side)
    g.fillStyle(0xE8F0F4, 1)
    g.beginPath()
    g.moveTo(w/2, 12)
    g.lineTo(w - 10, 40)
    g.lineTo(w/2, 40)
    g.closePath()
    g.fillPath()

    // Snow lumps on roof edge
    g.fillStyle(0xFFFFFF, 1)
    g.fillEllipse(20, 43, 16, 6)
    g.fillEllipse(50, 44, 20, 7)
    g.fillEllipse(90, 43, 18, 6)

    // Windows with warm glow
    this.drawWindow(g, 28, 52, 20, 20)
    this.drawWindow(g, 80, 52, 20, 20)

    // Door
    g.fillStyle(0x4A2808, 1)
    g.fillRoundedRect(54, 64, 20, 32, 3)
    // Door panels
    g.lineStyle(1, 0x3A1A04, 0.5)
    g.strokeRect(56, 68, 7, 12)
    g.strokeRect(65, 68, 7, 12)
    // Door handle
    g.fillStyle(0xFFD700, 1)
    g.fillCircle(70, 80, 3)
    g.fillStyle(0xFFE44D, 1)
    g.fillCircle(69, 79, 1.5)

    // Chimney with smoke
    g.fillStyle(0x8B0000, 1)
    g.fillRect(92, 12, 16, 24)
    g.fillStyle(0xA52A2A, 1)
    g.fillRect(92, 12, 8, 24)
    // Chimney cap
    g.fillStyle(0x6B0000, 1)
    g.fillRect(90, 10, 20, 4)

    // Smoke puffs (gradient)
    for (let i = 0; i < 3; i++) {
      const puffY = 6 - i * 8
      const puffSize = 6 - i * 1.5
      g.fillStyle(0xFFFFFF, 0.6 - i * 0.15)
      g.fillCircle(100 + i * 3, puffY, puffSize)
    }

    g.generateTexture(key, w, h)
    g.destroy()
  }

  drawWindow(g, x, y, w, h) {
    // Window glow (warm light)
    g.fillStyle(0xFFD080, 0.4)
    g.fillRect(x - 2, y - 2, w + 4, h + 4)

    // Window base
    g.fillStyle(0xFFE4B5, 1)
    g.fillRect(x, y, w, h)

    // Inner glow gradient
    g.fillStyle(0xFFF8DC, 1)
    g.fillRect(x + 2, y + 2, w - 4, h - 4)

    // Window frame
    g.lineStyle(2, 0x654321, 1)
    g.strokeRect(x, y, w, h)

    // Cross frame
    g.lineStyle(1.5, 0x654321, 1)
    g.beginPath()
    g.moveTo(x + w/2, y)
    g.lineTo(x + w/2, y + h)
    g.moveTo(x, y + h/2)
    g.lineTo(x + w, y + h/2)
    g.stroke()
  }

  generateCoffeeShop(key) {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const w = 96, h = 88  // 2x from 48x44

    // Ground shadow
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0x87CEEB, 0.15 - i * 0.025)
      g.fillEllipse(w/2, h - 4 + i, 88 - i * 5, 16 - i * 2)
    }

    // Building base (darker)
    g.fillStyle(0xA05010, 1)
    g.fillRect(12, 32, 72, 48)

    // Building main (cozy brown)
    g.fillStyle(0xD2691E, 1)
    g.fillRect(12, 30, 72, 46)

    // Side panel (3D effect)
    g.fillStyle(0xB85C14, 1)
    g.fillRect(60, 30, 24, 46)

    // Snowy roof
    g.fillStyle(0xE8F0F4, 1)
    g.beginPath()
    g.moveTo(w/2, 4)
    g.lineTo(w - 8, 36)
    g.lineTo(8, 36)
    g.closePath()
    g.fillPath()

    g.fillStyle(0xFFFFFF, 1)
    g.beginPath()
    g.moveTo(w/2, 6)
    g.lineTo(w - 10, 34)
    g.lineTo(10, 34)
    g.closePath()
    g.fillPath()

    // Snow lumps
    g.fillEllipse(25, 35, 14, 5)
    g.fillEllipse(w/2, 36, 16, 6)
    g.fillEllipse(70, 35, 12, 5)

    // Coffee cup sign with glow
    g.fillStyle(0xFFE4B5, 0.4)
    g.fillCircle(w/2, 52, 18)
    g.fillStyle(0xFFFFFF, 1)
    g.fillCircle(w/2, 52, 14)
    g.lineStyle(2, 0xD2691E, 1)
    g.strokeCircle(w/2, 52, 14)

    // Coffee in cup
    g.fillStyle(0x8B4513, 1)
    g.fillCircle(w/2, 52, 10)
    g.fillStyle(0x6B3510, 1)
    g.fillCircle(w/2 + 2, 54, 6)

    // Steam from cup (simple lines)
    g.lineStyle(2, 0xFFFFFF, 0.8)
    g.beginPath()
    g.moveTo(w/2 - 3, 36)
    g.lineTo(w/2 - 4, 30)
    g.lineTo(w/2 - 2, 26)
    g.stroke()
    g.beginPath()
    g.moveTo(w/2 + 3, 36)
    g.lineTo(w/2 + 4, 30)
    g.lineTo(w/2 + 2, 24)
    g.stroke()

    // Door
    g.fillStyle(0x4A2808, 1)
    g.fillRoundedRect(w/2 - 10, 60, 20, 20, 3)
    g.fillStyle(0xFFD700, 1)
    g.fillCircle(w/2 + 6, 70, 2)

    g.generateTexture(key, w, h)
    g.destroy()
  }

  generatePetShop(key) {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const w = 88, h = 80  // 2x from 44x40

    // Ground shadow
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0x87CEEB, 0.15 - i * 0.025)
      g.fillEllipse(w/2, h - 4 + i, 80 - i * 5, 16 - i * 2)
    }

    // Building base
    g.fillStyle(0x7B4996, 1)
    g.fillRect(12, 28, 64, 44)

    // Building main (fun purple)
    g.fillStyle(0x9B59B6, 1)
    g.fillRect(12, 26, 64, 42)

    // Side panel
    g.fillStyle(0x8B4AA6, 1)
    g.fillRect(52, 26, 24, 42)

    // Snowy roof
    g.fillStyle(0xE8F0F4, 1)
    g.beginPath()
    g.moveTo(w/2, 4)
    g.lineTo(w - 8, 32)
    g.lineTo(8, 32)
    g.closePath()
    g.fillPath()

    g.fillStyle(0xFFFFFF, 1)
    g.beginPath()
    g.moveTo(w/2, 6)
    g.lineTo(w - 10, 30)
    g.lineTo(10, 30)
    g.closePath()
    g.fillPath()

    // Snow lumps
    g.fillEllipse(22, 31, 12, 5)
    g.fillEllipse(w/2, 32, 14, 5)
    g.fillEllipse(66, 31, 10, 4)

    // Paw print sign
    g.fillStyle(0xFFFFFF, 1)
    g.fillCircle(w/2, 48, 10)
    g.fillCircle(w/2 - 8, 40, 4)
    g.fillCircle(w/2 + 8, 40, 4)
    g.fillCircle(w/2 - 6, 56, 4)
    g.fillCircle(w/2 + 6, 56, 4)

    // Sign glow
    g.lineStyle(2, 0xFFB6C1, 0.6)
    g.strokeCircle(w/2, 48, 12)

    // Door
    g.fillStyle(0x5C3483, 1)
    g.fillRoundedRect(w/2 - 10, 56, 20, 20, 3)
    g.fillStyle(0xFFD700, 1)
    g.fillCircle(w/2 + 6, 66, 2)

    g.generateTexture(key, w, h)
    g.destroy()
  }

  generatePenguin(key, accentColor, hatType) {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const size = 48  // 2.4x from 20

    // Ground shadow (gradient layers)
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0x87CEEB, 0.15 - i * 0.025)
      g.fillEllipse(size/2, size - 4 + i, 28 - i * 3, 10 - i)
    }

    // Penguin body (black with gradient shading)
    // Back darker
    g.fillStyle(0x0A0A0A, 1)
    g.fillEllipse(size/2, size - 16, 26, 22)

    // Main body
    g.fillStyle(0x1A1A1A, 1)
    g.fillEllipse(size/2, size - 17, 24, 20)

    // Left edge highlight (subtle 3D)
    g.fillStyle(0x2A2A2A, 0.6)
    g.fillEllipse(size/2 - 6, size - 20, 8, 14)

    // Flippers/wings
    g.fillStyle(0x1A1A1A, 1)
    g.fillEllipse(size/2 - 14, size - 14, 6, 12)
    g.fillEllipse(size/2 + 14, size - 14, 6, 12)

    // White belly with gradient
    g.fillStyle(0xFFFFFF, 1)
    g.fillEllipse(size/2, size - 14, 14, 12)

    // Belly shading (subtle gradient)
    g.fillStyle(0xF8F8F8, 0.7)
    g.fillEllipse(size/2 + 2, size - 12, 8, 8)

    // Head
    g.fillStyle(0x0A0A0A, 1)
    g.fillCircle(size/2, 14, 13)
    g.fillStyle(0x1A1A1A, 1)
    g.fillCircle(size/2, 14, 12)

    // Head highlight
    g.fillStyle(0x2A2A2A, 0.5)
    g.fillEllipse(size/2 - 4, 11, 6, 8)

    // Eyes (white with shine)
    g.fillStyle(0xFFFFFF, 1)
    g.fillEllipse(size/2 - 5, 12, 5, 6)
    g.fillEllipse(size/2 + 5, 12, 5, 6)

    // Pupils
    g.fillStyle(0x000000, 1)
    g.fillCircle(size/2 - 4, 13, 2.5)
    g.fillCircle(size/2 + 6, 13, 2.5)

    // Eye highlights (sparkle)
    g.fillStyle(0xFFFFFF, 1)
    g.fillCircle(size/2 - 5, 11, 1.5)
    g.fillCircle(size/2 + 5, 11, 1.5)

    // Beak (orange with shading)
    g.fillStyle(0xFF6B35, 1)
    g.beginPath()
    g.moveTo(size/2, 17)
    g.lineTo(size/2 - 5, 23)
    g.lineTo(size/2 + 5, 23)
    g.closePath()
    g.fillPath()

    // Beak highlight
    g.fillStyle(0xFF8B55, 0.6)
    g.beginPath()
    g.moveTo(size/2 - 1, 18)
    g.lineTo(size/2 - 3, 21)
    g.lineTo(size/2 + 1, 21)
    g.closePath()
    g.fillPath()

    // Feet (orange with shading)
    g.fillStyle(0xE55B25, 1)
    g.fillEllipse(size/2 - 7, size - 3, 9, 4)
    g.fillEllipse(size/2 + 7, size - 3, 9, 4)
    g.fillStyle(0xFF6B35, 1)
    g.fillEllipse(size/2 - 7, size - 4, 8, 3)
    g.fillEllipse(size/2 + 7, size - 4, 8, 3)

    // Hat based on type
    this.drawHat(g, size, accentColor, hatType)

    g.generateTexture(key, size, size + 8)
    g.destroy()
  }

  drawHat(g, size, accentColor, hatType) {
    // Create darker shade manually (shift color darker)
    const colorObj = Phaser.Display.Color.ValueToColor(accentColor)
    const darkerAccent = Phaser.Display.Color.GetColor(
      Math.max(0, colorObj.red - 40),
      Math.max(0, colorObj.green - 40),
      Math.max(0, colorObj.blue - 40)
    )

    switch(hatType) {
      case 'propeller':
        // Propeller cap base
        g.fillStyle(accentColor, 1)
        g.fillEllipse(size/2, 5, 14, 8)
        g.fillStyle(darkerAccent, 0.5)
        g.fillEllipse(size/2 + 2, 6, 8, 5)

        // Cap top
        g.fillStyle(accentColor, 1)
        g.fillCircle(size/2, 2, 5)

        // Propeller stem
        g.fillStyle(0xFFFFFF, 1)
        g.fillRect(size/2 - 2, -2, 4, 5)

        // Propeller blades
        g.fillStyle(accentColor, 1)
        g.fillEllipse(size/2 - 7, -1, 8, 3)
        g.fillEllipse(size/2 + 7, -1, 8, 3)
        g.fillStyle(darkerAccent, 0.5)
        g.fillEllipse(size/2 - 6, 0, 6, 2)
        g.fillEllipse(size/2 + 6, 0, 6, 2)
        break

      case 'hardhat':
        // Hard hat dome
        g.fillStyle(accentColor, 1)
        g.fillEllipse(size/2, 3, 16, 10)
        // Brim
        g.fillRect(size/2 - 12, 6, 24, 4)
        // Highlight
        g.fillStyle(0xFFFFFF, 0.3)
        g.fillEllipse(size/2 - 4, 1, 8, 5)
        // Shadow
        g.fillStyle(darkerAccent, 0.4)
        g.fillEllipse(size/2 + 4, 5, 8, 4)
        break

      case 'warning':
        // Warning triangle
        g.fillStyle(0xE74C3C, 1)
        g.beginPath()
        g.moveTo(size/2, -6)
        g.lineTo(size/2 + 10, 8)
        g.lineTo(size/2 - 10, 8)
        g.closePath()
        g.fillPath()

        // Inner triangle
        g.fillStyle(0xFF6B6B, 0.5)
        g.beginPath()
        g.moveTo(size/2, -3)
        g.lineTo(size/2 + 6, 5)
        g.lineTo(size/2 - 6, 5)
        g.closePath()
        g.fillPath()

        // Exclamation mark
        g.fillStyle(0xFFFFFF, 1)
        g.fillRect(size/2 - 1.5, -2, 3, 6)
        g.fillCircle(size/2, 6, 2)
        break

      case 'crown':
        // Crown base
        g.fillStyle(0xFFD700, 1)
        g.fillRect(size/2 - 10, 3, 20, 6)

        // Crown points
        g.beginPath()
        g.moveTo(size/2 - 10, 3)
        g.lineTo(size/2 - 10, -2)
        g.lineTo(size/2 - 6, 3)
        g.fill()
        g.beginPath()
        g.moveTo(size/2 - 3, 3)
        g.lineTo(size/2, -5)
        g.lineTo(size/2 + 3, 3)
        g.fill()
        g.beginPath()
        g.moveTo(size/2 + 6, 3)
        g.lineTo(size/2 + 10, -2)
        g.lineTo(size/2 + 10, 3)
        g.fill()

        // Gems
        g.fillStyle(0xE74C3C, 1)
        g.fillCircle(size/2, 5, 3)
        g.fillStyle(0x3498DB, 1)
        g.fillCircle(size/2 - 6, 5, 2)
        g.fillCircle(size/2 + 6, 5, 2)

        // Crown highlight
        g.fillStyle(0xFFE44D, 0.5)
        g.fillRect(size/2 - 8, 4, 6, 2)
        break

      case 'wizard':
        // Wizard hat cone
        g.fillStyle(0x9B59B6, 1)
        g.beginPath()
        g.moveTo(size/2, -10)
        g.lineTo(size/2 + 14, 8)
        g.lineTo(size/2 - 14, 8)
        g.closePath()
        g.fillPath()

        // Hat shading
        g.fillStyle(0x7D3C98, 0.5)
        g.beginPath()
        g.moveTo(size/2, -10)
        g.lineTo(size/2 + 14, 8)
        g.lineTo(size/2, 8)
        g.closePath()
        g.fillPath()

        // Hat brim
        g.fillStyle(0x9B59B6, 1)
        g.fillEllipse(size/2, 8, 16, 4)

        // Stars and moon
        g.fillStyle(0xFFD700, 1)
        g.fillCircle(size/2 - 5, -2, 2)
        g.fillCircle(size/2 + 4, 0, 2)
        g.fillStyle(0xC0C0C0, 1)
        g.fillCircle(size/2 + 2, -4, 3)
        break

      case 'chef':
        // Chef hat puffs
        g.fillStyle(0xFFFFFF, 1)
        g.fillCircle(size/2, -2, 8)
        g.fillCircle(size/2 - 8, 2, 6)
        g.fillCircle(size/2 + 8, 2, 6)
        g.fillCircle(size/2 - 5, -6, 5)
        g.fillCircle(size/2 + 5, -6, 5)

        // Hat band
        g.fillRect(size/2 - 10, 5, 20, 4)

        // Shading
        g.fillStyle(0xF0F0F0, 0.5)
        g.fillCircle(size/2 + 4, 0, 6)
        g.fillCircle(size/2 + 6, -4, 4)
        break
    }
  }

  generateSelectionRing() {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const size = 48  // 2x from 24

    // Outer glow layers for pulsing effect
    for (let i = 3; i >= 0; i--) {
      g.lineStyle(4 + i * 2, 0x00BFFF, 0.15 - i * 0.03)
      g.strokeEllipse(size/2, size/2 + 4, 44 + i * 4, 24 + i * 2)
    }

    // Main ring
    g.lineStyle(3, 0x87CEEB, 1)
    g.strokeEllipse(size/2, size/2 + 4, 40, 20)

    // Inner highlight
    g.lineStyle(1.5, 0xFFFFFF, 0.6)
    g.strokeEllipse(size/2, size/2 + 3, 36, 16)

    g.generateTexture('selection-ring', size, size)
    g.destroy()
  }

  generateCoinIcon(key) {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const size = 32  // 2x from 16

    // Outer glow
    g.fillStyle(0xFFD700, 0.3)
    g.fillCircle(size/2, size/2, 15)

    // Gold coin base (darker)
    g.fillStyle(0xB8860B, 1)
    g.fillCircle(size/2, size/2 + 1, 13)

    // Gold coin main
    g.fillStyle(0xFFD700, 1)
    g.fillCircle(size/2, size/2, 13)

    // Gradient shine (top-left lighter)
    g.fillStyle(0xFFEA00, 1)
    g.fillEllipse(size/2 - 3, size/2 - 3, 8, 8)

    // Sparkle highlight
    g.fillStyle(0xFFFFFF, 0.8)
    g.fillCircle(size/2 - 4, size/2 - 4, 3)

    // Inner circle detail
    g.lineStyle(1.5, 0xB8860B, 0.6)
    g.strokeCircle(size/2, size/2, 9)

    // Dollar sign or star
    g.fillStyle(0xB8860B, 0.8)
    g.fillCircle(size/2, size/2, 3)

    g.generateTexture(key, size, size)
    g.destroy()
  }

  generateFishIcon(key) {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const size = 32  // 2x from 16

    // Glow
    g.fillStyle(0x3498DB, 0.2)
    g.fillEllipse(size/2, size/2, 28, 18)

    // Fish body shadow
    g.fillStyle(0x2980B9, 1)
    g.fillEllipse(size/2, size/2 + 1, 20, 12)

    // Fish body main
    g.fillStyle(0x3498DB, 1)
    g.fillEllipse(size/2, size/2, 20, 11)

    // Body gradient
    g.fillStyle(0x5DADE2, 0.6)
    g.fillEllipse(size/2 - 2, size/2 - 2, 12, 6)

    // Tail
    g.fillStyle(0x2980B9, 1)
    g.beginPath()
    g.moveTo(size - 6, size/2)
    g.lineTo(size, size/2 - 7)
    g.lineTo(size, size/2 + 7)
    g.closePath()
    g.fillPath()

    // Tail highlight
    g.fillStyle(0x3498DB, 0.7)
    g.beginPath()
    g.moveTo(size - 6, size/2)
    g.lineTo(size - 2, size/2 - 4)
    g.lineTo(size - 2, size/2 + 2)
    g.closePath()
    g.fillPath()

    // Fin
    g.fillStyle(0x2980B9, 1)
    g.beginPath()
    g.moveTo(size/2, size/2 - 4)
    g.lineTo(size/2 - 3, size/2 - 10)
    g.lineTo(size/2 + 4, size/2 - 4)
    g.closePath()
    g.fillPath()

    // Eye
    g.fillStyle(0xFFFFFF, 1)
    g.fillCircle(size/2 - 5, size/2, 4)
    g.fillStyle(0x000000, 1)
    g.fillCircle(size/2 - 5, size/2, 2)
    // Eye shine
    g.fillStyle(0xFFFFFF, 1)
    g.fillCircle(size/2 - 6, size/2 - 1, 1)

    g.generateTexture(key, size, size)
    g.destroy()
  }

  generateStampIcon(key) {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const size = 32  // 2x from 16

    // Outer glow
    g.fillStyle(0x9B59B6, 0.2)
    g.fillRoundedRect(2, 2, 28, 28, 4)

    // Stamp base (darker)
    g.fillStyle(0x7D3C98, 1)
    g.fillRoundedRect(4, 5, 24, 24, 4)

    // Stamp main
    g.fillStyle(0x9B59B6, 1)
    g.fillRoundedRect(4, 4, 24, 24, 4)

    // Inner gradient
    g.fillStyle(0xAF7AC5, 0.5)
    g.fillRoundedRect(6, 6, 12, 12, 3)

    // Perforated edge effect
    g.fillStyle(0xFFFFFF, 0.3)
    for (let i = 0; i < 6; i++) {
      g.fillCircle(6 + i * 4, 4, 1.5)
      g.fillCircle(6 + i * 4, 28, 1.5)
      g.fillCircle(4, 6 + i * 4, 1.5)
      g.fillCircle(28, 6 + i * 4, 1.5)
    }

    // Star in center
    g.fillStyle(0xFFD700, 1)
    g.fillCircle(size/2, size/2, 6)
    g.fillStyle(0xFFE44D, 1)
    g.fillCircle(size/2 - 1, size/2 - 1, 3)

    // Star points
    g.fillStyle(0xFFD700, 1)
    const cx = size/2, cy = size/2
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 - 90) * Math.PI / 180
      const px = cx + Math.cos(angle) * 8
      const py = cy + Math.sin(angle) * 8
      g.fillCircle(px, py, 2)
    }

    g.generateTexture(key, size, size)
    g.destroy()
  }

  generateDustPuff() {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const size = 16

    // Soft dust particle
    for (let i = 3; i >= 0; i--) {
      g.fillStyle(0xFFFFFF, 0.3 - i * 0.06)
      g.fillCircle(size/2, size/2, 6 + i * 2)
    }
    g.fillStyle(0xFFFFFF, 0.5)
    g.fillCircle(size/2, size/2, 4)

    g.generateTexture('dust-puff', size, size)
    g.destroy()
  }

  generateSparkle() {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const size = 12

    // 4-pointed sparkle
    g.fillStyle(0xFFFFFF, 1)
    g.beginPath()
    g.moveTo(size/2, 0)
    g.lineTo(size/2 + 1.5, size/2 - 1.5)
    g.lineTo(size, size/2)
    g.lineTo(size/2 + 1.5, size/2 + 1.5)
    g.lineTo(size/2, size)
    g.lineTo(size/2 - 1.5, size/2 + 1.5)
    g.lineTo(0, size/2)
    g.lineTo(size/2 - 1.5, size/2 - 1.5)
    g.closePath()
    g.fillPath()

    g.generateTexture('sparkle', size, size)
    g.destroy()
  }

  generateSeaLion() {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    const width = 64
    const height = 48

    // Shadow on water
    g.fillStyle(0x2980B9, 0.4)
    g.fillEllipse(width/2, height - 6, 40, 10)

    // Water splash effect
    g.fillStyle(0x3498DB, 0.6)
    g.fillEllipse(width/2 - 20, height - 8, 12, 6)
    g.fillEllipse(width/2 + 20, height - 8, 12, 6)

    // Sea lion body (dark gray-brown)
    g.fillStyle(0x5D4E37, 1)
    // Back/body
    g.fillEllipse(width/2, height - 14, 30, 14)

    // Lighter belly
    g.fillStyle(0x8B7355, 1)
    g.fillEllipse(width/2, height - 10, 22, 10)

    // Neck and head
    g.fillStyle(0x5D4E37, 1)
    g.fillEllipse(width/2 + 8, height - 24, 14, 16)

    // Head
    g.fillStyle(0x6B5B45, 1)
    g.fillCircle(width/2 + 14, height - 32, 10)

    // Snout
    g.fillStyle(0x5D4E37, 1)
    g.fillEllipse(width/2 + 22, height - 30, 8, 6)

    // Nose
    g.fillStyle(0x1A1A1A, 1)
    g.fillCircle(width/2 + 28, height - 30, 3)

    // Eyes
    g.fillStyle(0x000000, 1)
    g.fillCircle(width/2 + 16, height - 34, 3)
    // Eye highlight
    g.fillStyle(0xFFFFFF, 1)
    g.fillCircle(width/2 + 15, height - 35, 1.5)

    // Whiskers
    g.lineStyle(1, 0x1A1A1A, 0.6)
    g.lineBetween(width/2 + 24, height - 28, width/2 + 34, height - 26)
    g.lineBetween(width/2 + 24, height - 30, width/2 + 35, height - 30)
    g.lineBetween(width/2 + 24, height - 32, width/2 + 34, height - 34)

    // Flippers
    g.fillStyle(0x4A3F2F, 1)
    // Front flipper (raised, grabbing)
    g.fillEllipse(width/2 + 2, height - 18, 10, 6)
    // Back flippers
    g.fillEllipse(width/2 - 18, height - 8, 8, 5)

    // Mouth (slightly open, menacing)
    g.lineStyle(2, 0x8B4513, 1)
    g.beginPath()
    g.arc(width/2 + 22, height - 28, 4, 0.2, Math.PI - 0.2, false)
    g.strokePath()

    g.generateTexture('sea-lion', width, height)
    g.destroy()
  }
}
