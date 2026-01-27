# Club Penguin Style Redesign Plan

## Overview

Transform the current Age of Empires-style Gastown GUI into a Club Penguin-themed interface. The good news: the current implementation is **100% procedurally generated** with no external assets, so this is primarily a visual/color/style overhaul.

---

## Current vs Target Style

| Aspect | Current (Age of Empires) | Target (Club Penguin) |
|--------|--------------------------|----------------------|
| Background | Dark navy (#1a1a2e) | Bright sky blue + snow |
| Font | "Press Start 2P" (pixel) | Rounded, friendly (Fredoka One or similar) |
| Terrain | Brown/green isometric dirt & grass | White/light blue snow & ice |
| Buildings | Medieval tan/brown structures | Igloos, ice buildings, ski lodge |
| Units | Colored circles with status | Cute penguins with colors |
| UI Panels | Dark backgrounds, gold borders | Bright blue panels, rounded corners |
| Buttons | Square military-style | Rounded, colorful, playful |
| Palette | Earthy browns, greens, grays | Whites, sky blues, pinks, purples |

---

## Files to Modify

### 1. `index.html`
- Change font from "Press Start 2P" to a friendly rounded font (e.g., "Fredoka One" or "Comic Neue")
- Update background color to light blue

### 2. `src/scenes/BootScene.js`
**The heart of the visual redesign - all sprites generated here**

#### Tile Generation (generateTiles)
- Replace grass/dirt/stone with snow/ice/packed-snow variants
- Colors: White (#FFFFFF), Light blue (#E8F4FC), Powder blue (#B0D4F1)
- Add sparkle/shimmer effects to ice tiles

#### Building Generation (generateBuildings)
Create Club Penguin-themed structures:
- **Mayor HQ** → **Ski Lodge** (brown wood with snowy roof)
- **Refinery** → **Coffee Shop** (cozy warm colors)
- **Barracks** → **Pet Shop** (colorful with paw prints)
- **Rig** → **Igloo** (classic white dome with door)
- All buildings get snow-capped roofs

#### Unit Generation (generateUnits)
Transform into penguins:
- Oval black body with white belly
- Orange beak and feet
- Different colored accessories/hats for status:
  - **Idle** → Blue propeller hat
  - **Working** → Hard hat (yellow)
  - **Stuck** → Red warning sign
  - **Mayor** → Gold crown
  - **Deacon** → Purple wizard hat
  - **Refinery** → Chef hat (coffee shop worker)

#### UI Elements
- Replace gold borders with rounded blue ice borders
- Add snowflake decorations
- Resource icons: Coins (yellow), Fish (blue), Stamps (green)

### 3. `src/scenes/GameScene.js`
- Update tile generation colors
- Adjust grid lines to be subtle white/light blue
- Add occasional snow particle effects (optional enhancement)
- Keep isometric mechanics (works well for Club Penguin too)

### 4. `src/scenes/UIScene.js`
**Redesign the HUD panels**

#### Resource Bar (Top)
- Background: Light blue with white rounded border
- Text: Dark blue instead of white
- Resources renamed conceptually:
  - Tokens → Coins
  - Issues → Fish
  - Convoys → Stamps
- Town name styling: Playful, maybe with penguin emoji

#### Command Panel
- Background: Icy blue gradient
- Rounded corners (15px radius)
- White/light borders instead of gold
- Buttons: Bright colors, rounded, with hover animations
  - SLING WORK → Green with snowflake icon
  - VIEW HOOK → Blue with magnifying glass
  - MAIL → Pink with envelope
  - STOP → Red (keep warning color)

#### Minimap
- Snow-white background
- Building markers as colored dots
- Blue water features (if any)
- Rounded frame

#### Tooltip
- Rounded white background
- Drop shadow for depth
- Cute icons next to info

---

## Color Palette

```
Primary:
- Sky Blue:     #7EC8E3 (backgrounds)
- Snow White:   #FFFFFF (terrain, highlights)
- Ice Blue:     #B0D4F1 (accents)
- Deep Blue:    #0077B6 (text, borders)

Accents:
- Penguin Black: #1A1A1A (penguin bodies)
- Orange:        #FF6B35 (beaks, feet)
- Pink:          #FF69B4 (decorations)
- Purple:        #9B59B6 (special items)
- Gold:          #FFD700 (coins, VIP items)

Status Colors:
- Working Green: #2ECC71
- Warning Red:   #E74C3C
- Info Blue:     #3498DB
```

---

## Implementation Order

### Phase 1: Foundation
1. Update `index.html` - font and base background
2. Update `BootScene.js` - tile colors (snow terrain)
3. Test: Should see white/blue isometric snow world

### Phase 2: Buildings
4. Redesign building sprites in `BootScene.js`
5. Add snow-cap details to roofs
6. Update building color mapping in `GameScene.js`

### Phase 3: Units (Penguins!)
7. Create penguin sprite generation in `BootScene.js`
8. Different penguin variants for each unit type
9. Update status animations (waddle instead of bob?)

### Phase 4: UI Overhaul
10. Redesign resource bar in `UIScene.js`
11. Redesign command panel
12. Redesign minimap
13. Update tooltips

### Phase 5: Polish
14. Add snow particle effects (optional)
15. Sound effects placeholders (optional)
16. Final color/spacing tweaks

---

## Technical Notes

- **No new dependencies needed** - Phaser handles everything
- **All changes are visual** - game logic stays identical
- **Procedural generation** - no image assets to create/import
- **Backward compatible** - server/API integration unchanged

---

## Estimated Scope

- `index.html`: ~5 lines changed
- `BootScene.js`: ~150-200 lines modified (sprite generation)
- `GameScene.js`: ~20-30 lines (colors, maybe particles)
- `UIScene.js`: ~100-150 lines (panel styling, colors)

Total: Approximately 300-400 lines of changes across 4 files.
