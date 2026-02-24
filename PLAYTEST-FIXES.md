# Playtester UX Fixes — Implementation Plan

> Generated: 2026-02-24  
> Based on code review of the current Phaser 3 / TypeScript monorepo.

---

## Current Code Structure Summary

```
packages/
  shared/src/
    index.ts              ← All shared types (TowerConfig, EnemyState, WaveConfig, MapConfig…)
    data/
      towers.ts           ← TOWER_CONFIGS record — all tower stats & upgrades
      waves.ts            ← WAVE_CONFIGS array — all 20 wave definitions
      maps.ts             ← MAP_CONFIGS record — map_01 waypoints, buildZones, decorations

  client/src/
    scenes/
      GameScene.ts        ← World rendering, input, placement logic, camera
      HudScene.ts         ← All HUD panels, TowerPanel, sell panel, chat, wave banner
    ui/
      TowerPanel.ts       ← Right-sidebar tower list (always visible during game)
      TowerInspector.ts   ← Click-a-tower popup: stats, upgrade, sell, targeting
      EnemyInspector.ts   ← Click-an-enemy popup: HP, speed, armor, statuses
      Tooltip.ts          ← Generic floating tooltip used by TowerPanel
    GameClient.ts         ← Server connection, state relay to scenes
    assets/manifest.ts    ← TOWER_ASSETS keyed by configId (buildingKey, idleKey, projKey…)

  server/src/
    game/GameSimulation.ts ← Authoritative tick logic
    systems/WaveScheduler.ts ← Wave timing
    rooms/GameRoom.ts      ← Colyseus room, handles client commands
```

### Key patterns to be aware of

- **Event bus**: `HudScene ↔ GameScene` communicate via `gameScene.events.emit(...)`.  
  E.g. `tower-selected`, `tower-deselected`, `placed-tower-clicked`, `sell-panel-close`.
- **`selectedTowerId`** in GameScene drives placement mode — when non-null, mouse move shows ghost overlay.
- **`isValidBuildTile()`** in GameScene currently checks only `buildZones` from MapConfig.
- **TowerPanel** is created inside `HudScene.showTowerPanelForClass()` and wired with a `setSelectionCallback`.
- **Font sizes** across the inspection panels are uniformly small (10–14px) — they were designed without considering zoom level.
- **`WAVE_CONFIGS`** is already imported in HudScene (used for the wave banner enemy summary).
- **Camera zoom** is set once in `GameScene.setupDemoMap()` to fit the map, then never changed again.

---

## Fix #1 — Tower Shop / Buy Menu

**Complexity: M**

### What changes

Currently the tower list (`TowerPanel`) is a permanent right-side sidebar visible at all times after class selection. The fix turns it into a **modal shop** that:

1. Shows a **"🛒 Shop"** button in the HUD (bottom-left, next to the class icon).
2. Clicking the button opens a shop overlay. Picking a tower enters placement mode and closes the shop.
3. Right-clicking or pressing Escape while placing cancels placement and returns to normal cursor.

### Files to modify

#### `packages/client/src/scenes/HudScene.ts`

- In `createHudElements()`: add a "🛒 Shop" button next to `classIcon` (around `x=70, y=H-70` → shift class icon or place shop button at `x=130`).
- Refactor `showTowerPanelForClass()`: instead of creating the panel permanently, store the configs and only create the TowerPanel container when the button is clicked.
- Add `openShop()` / `closeShop()` methods that toggle TowerPanel visibility.
- After a tower is selected via TowerPanel's `setSelectionCallback`, call `closeShop()`.
- Add a backdrop rectangle (`setInteractive`) that closes the shop when clicking outside.

```typescript
// Rough sketch of new shop button in createHudElements():
const shopBtn = this.createShopButton(130, H - 70);
shopBtn.setScrollFactor(0).setDepth(101);

// openShop():
private openShop(): void {
  if (this.shopOpen) return;
  this.shopOpen = true;
  this.shopBackdrop = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0)
    .setScrollFactor(0).setDepth(99).setInteractive();
  this.shopBackdrop.on('pointerdown', () => this.closeShop());
  this.towerPanel?.setVisible(true);
}
```

#### `packages/client/src/ui/TowerPanel.ts`

- Minor: ensure `setVisible(false)` works properly (already has `setVisible()` method).
- The callback from `selectTower()` already calls `this.onSelection(configId)` — HudScene just needs to hook `closeShop()` in that callback *before* forwarding to GameScene.

#### `packages/client/src/scenes/GameScene.ts`

- In `handleTowerDeselected()`: already clears `ghostGraphics` and `rangePreview`. No additional changes needed.
- The right-click branch in `handleTileClick()` should also call `this.events.emit('tower-deselected')` after a successful placement (today it only fires on bad tiles or explicit deselect).

**Current placement confirmation flow** (after right-click/cancel, currently missing):
Add to `handleTileClick()` after a successful `tile-clicked` emit:
```typescript
// After successful placement emit:
this.handleTowerDeselected(); // clears ghost + resets selectedTowerId
this.events.emit('tower-deselected'); // tell HudScene to close shop if open
```

---

## Fix #2 — Normal Cursor by Default

**Complexity: S**

### What changes

- Default cursor = OS arrow cursor (`auto`).
- Entering placement mode → cursor becomes `crosshair`.
- Exiting placement mode → cursor resets to `auto`.
- Enemy sprites and tower sprites show `pointer` on hover (enemies already do via `setInteractive({ useHandCursor: true })`).

### Files to modify

#### `packages/client/src/scenes/GameScene.ts`

In `handleTowerSelected()`:
```typescript
private handleTowerSelected(configId: string): void {
  this.selectedTowerId = configId;
  this.input.setDefaultCursor('crosshair'); // ADD THIS
}
```

In `handleTowerDeselected()`:
```typescript
private handleTowerDeselected(): void {
  this.selectedTowerId = null;
  this.ghostGraphics.clear();
  this.rangePreview.clear();
  this.input.setDefaultCursor('auto'); // ADD THIS
}
```

In `create()`, reset cursor on start:
```typescript
this.input.setDefaultCursor('auto'); // ADD in create()
```

Tower sprites in `createTowerVisual()` — make the base image interactive for hover/cursor:
```typescript
base.setInteractive({ useHandCursor: true });
soldier.setInteractive({ useHandCursor: true });
```

Also in `handleMouseMove()`: the existing guard `if (!canPlace || !this.selectedTowerId)` already returns early and clears the ghost — so the overlay logic is already gated. No change needed there.

---

## Fix #3 — Bigger UI Text

**Complexity: S**

### What changes

Scale up all text inside inspection panels. Current sizes are 10–14px which are unreadable at the default camera zoom. Target: roughly **1.5–2× the current sizes**, with panel widths growing proportionally.

### Files to modify

#### `packages/client/src/ui/EnemyInspector.ts`

| Element | Current | Proposed |
|---------|---------|---------|
| Enemy name | 13px | **20px** |
| HP text | 11px | **16px** |
| Stat labels/values | 11px | **16px** |
| Status text | 10px | **14px** |

Also increase `const PW = 190` → **`PW = 260`** and `HP_BAR_H = 8` → **`HP_BAR_H = 12`**.  
Adjust `PANEL_OFFSET_Y = -110` → **`-150`** so the larger panel doesn't overlap the enemy sprite.

Row spacing (`cy += 20`) should increase to **`cy += 26`**.

#### `packages/client/src/ui/TowerInspector.ts`

| Element | Current | Proposed |
|---------|---------|---------|
| Tower name | 14px | **22px** |
| Tier stars | 14px | **18px** |
| Owner text | 11px | **15px** |
| Stat labels/values | 11px | **16px** |
| Upgrade button label | 12px | **16px** |
| Sell button label | 12px | **16px** |
| Targeting label | 11px | **15px** |

Also change `const PW = 240` → **`PW = 300`**.  
Row spacing (`cy += 21`) → **`cy += 28`**.

#### `packages/client/src/ui/TowerPanel.ts`

| Element | Current | Proposed |
|---------|---------|---------|
| Tower name | 12px | **16px** |
| Cost | 11px | **15px** |
| Range | 10px | **14px** |
| Panel title | 18px | **22px** |

Also `panelWidth = 220` → **`panelWidth = 280`** and `itemHeight = 70` → **`itemHeight = 90`**.  
Adjust HudScene panel position from `W - 110` → `W - 140` accordingly.

---

## Fix #4 — Game Speed Controls

**Complexity: M**

### What changes

Add a 3-state toggle in the HUD: **1× / 1.5× / 2×**.

**Architecture decision**: The server runs at a fixed tick rate in `GameLoop.ts`. Client-side Phaser `time.timeScale` would only affect rendering/tweens — the actual game simulation on the server wouldn't speed up. For this to meaningfully speed up gameplay (enemies move faster, towers fire faster), the server must support a speed multiplier.

**Recommended approach**: 
1. Add a `gameSpeed` field to `GameRoom.ts` state.
2. Add a `set_game_speed` client command in `GameRoom.ts`.
3. Apply the multiplier inside `GameLoop.ts` tick calculations (multiply `deltaMs` by speed factor).
4. On the client, also set Phaser `this.scene.time.timeScale` to match so tweens/animations keep in sync.

### Files to modify

#### `packages/shared/src/index.ts`

Add to the `GameState` interface:
```typescript
gameSpeed: 1 | 1.5 | 2;
```

#### `packages/server/src/rooms/GameRoom.ts`

Add command handler:
```typescript
this.onMessage('set_game_speed', (client, speed: 1 | 1.5 | 2) => {
  this.state.gameSpeed = speed;
});
```

#### `packages/server/src/game/GameLoop.ts`

In the tick function, scale the delta:
```typescript
const scaledDelta = deltaMs * this.state.gameSpeed;
// Pass scaledDelta to GameSimulation.tick(scaledDelta)
```

#### `packages/client/src/GameClient.ts`

Add method:
```typescript
setGameSpeed(speed: 1 | 1.5 | 2): void {
  this.network.send('set_game_speed', speed);
}
```

#### `packages/client/src/scenes/HudScene.ts`

Add in `createHudElements()` — a 3-button speed toggle (top-right area, below HP bar):
```typescript
private createSpeedToggle(x: number, y: number): void {
  const speeds: Array<1 | 1.5 | 2> = [1, 1.5, 2];
  // Create 3 small buttons, clicking cycles through speeds
  // On change: gameClient.setGameSpeed(speed)
  //            this.scene.get('GameScene').time.timeScale = speed;
}
```

Position: below the HP bar, top-right area (`W - 120, 78`).

**Note**: If server-side changes are out of scope for a quick fix, a purely client-side workaround is `this.game.loop.sleep()/resume()` + Phaser physics/time scale — but this will cause visual desync with server state.

---

## Fix #5 — Zoom In / Out

**Complexity: S**

### What changes

- **Mouse wheel** scrolls camera zoom (primary method).
- **+/- buttons** in HUD as an accessible fallback.
- Zoom range: clamped between `0.4` (zoomed out) and `2.0` (zoomed in).
- When zoomed in past a threshold, enable **click-drag panning** (camera follows pointer drag).

### Files to modify

#### `packages/client/src/scenes/GameScene.ts`

In `create()`, add wheel listener:
```typescript
this.input.on('wheel', (_ptr: Phaser.Input.Pointer, _objs: unknown, _dx: number, _dy: number, deltaY: number) => {
  const cam = this.cameras.main;
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 2.0;
  const ZOOM_STEP = 0.1;
  const newZoom = Phaser.Math.Clamp(cam.zoom + (deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP), MIN_ZOOM, MAX_ZOOM);
  cam.setZoom(newZoom);
});
```

Add keyboard shortcuts in `create()`:
```typescript
this.input.keyboard?.on('keydown-PLUS',  () => this.adjustZoom(+0.15));
this.input.keyboard?.on('keydown-MINUS', () => this.adjustZoom(-0.15));
this.input.keyboard?.on('keydown-NUMPAD_ADD',      () => this.adjustZoom(+0.15));
this.input.keyboard?.on('keydown-NUMPAD_SUBTRACT', () => this.adjustZoom(-0.15));
```

Add drag-to-pan when zoomed in:
```typescript
// In create():
this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
  if (ptr.isDown && this.cameras.main.zoom > 1.1 && !this.selectedTowerId) {
    this.cameras.main.scrollX -= (ptr.x - ptr.prevPosition.x) / this.cameras.main.zoom;
    this.cameras.main.scrollY -= (ptr.y - ptr.prevPosition.y) / this.cameras.main.zoom;
  }
});
```

(The existing `handleMouseMove` already fires on `pointermove` — the drag logic should be added as a separate conditional block, guarded by `!this.selectedTowerId` to not conflict with placement mode.)

#### `packages/client/src/scenes/HudScene.ts`

Add +/- zoom buttons in `createHudElements()`, positioned top-left or bottom-right:
```typescript
private createZoomButtons(x: number, y: number): void {
  // "−" button → emits 'zoom-out' to GameScene
  // "+" button → emits 'zoom-in' to GameScene
  // "[↺]" reset button → emits 'zoom-reset'
}
```

In `GameScene.create()`, listen for these events:
```typescript
this.events.on('zoom-in',    () => this.adjustZoom(+0.2));
this.events.on('zoom-out',   () => this.adjustZoom(-0.2));
this.events.on('zoom-reset', () => this.cameras.main.setZoom(this.defaultZoom));
```

Store `this.defaultZoom` from `setupDemoMap()` so reset works correctly.

---

## Fix #6 — Tower Descriptions

**Complexity: S**

### What changes

Add a `description` field to `TowerConfig` with a plain-English explanation for each tower, especially the non-obvious ones (Amplifier, Scout Tower, Geyser).

### Files to modify

#### `packages/shared/src/index.ts`

Add optional field to `TowerConfig`:
```typescript
export interface TowerConfig {
  // ... existing fields ...
  description?: string;   // ADD THIS — plain-English tooltip description
}
```

#### `packages/shared/src/data/towers.ts`

Add `description` to every tower entry. Examples:

```typescript
arrow_tower: {
  // ...existing...
  description: 'A reliable single-target tower. Fast attack speed with moderate damage.',
},

amplifier_tower: {
  // ...existing...
  description: 'SUPPORT: Does not attack directly. Instead, boosts the damage of all towers within its range by 15% (20% at tier 2, 25% at tier 3). Stack near clusters of towers for maximum effect.',
},

ballista: {
  // ...existing...
  description: 'High single-shot damage with long range. Slow reload, but hits both ground and air. Best against tanks and bosses.',
},

scout_tower: {
  // ...existing...
  description: 'UTILITY: Reveals invisible enemies within its range. Does not deal damage. Essential when invisible enemies appear in wave 16+.',
},

flame_spire: {
  description: 'Area-of-effect fire tower. Damages all enemies in a radius around the target and applies a burn-over-time effect.',
},

geyser: {
  description: 'Knockback specialist. Low damage, but erupts to push enemies backward along the path, buying time for other towers.',
},
// ... etc for all towers
```

#### `packages/client/src/ui/TowerPanel.ts`

In `buildTooltipText()`, add description as the second line (after the name header):
```typescript
private buildTooltipText(config: TowerConfig): string {
  const lines: string[] = [];
  lines.push(`[ ${config.name} ]`);
  if (config.description) {        // ADD THIS BLOCK
    lines.push('');
    lines.push(config.description);
    lines.push('');
  }
  // ... rest of existing stat lines
}
```

#### `packages/client/src/ui/TowerInspector.ts`

In `buildPanel()`, add a description text block below the tier stars, before the separator:
```typescript
// After tier stars (cy += 18), ADD:
if (this.config?.description) {
  const descText = this.scene.add.text(0, cy, this.config.description, {
    fontSize: '12px',
    fontFamily: 'Arial',
    color: '#ccccdd',
    wordWrap: { width: PW - 24 },
  }).setOrigin(0.5, 0);
  items.push(descText);
  cy += descText.height + 8;
}
```

---

## Fix #7 — Flexible Building Placement

**Complexity: M**

### What changes

Currently `isValidBuildTile()` in `GameScene.ts` returns `true` only if the tile is inside one of the `buildZones` rectangles from MapConfig. The fix opens up all non-path, non-obstacle tiles for building.

**What still blocks placement**:
- Path tiles (`isOnPath()` returns true)
- Occupied tiles (`isTileOccupied()` returns true)
- Tiles with blocking decorations (trees, rocks — see below)

**Decoration tracking problem**: The current `spawnDecorations()` generates decorations *randomly* (ignoring the `decorations` array in `maps.ts`). We need to track which tiles are occupied by decorations.

### Files to modify

#### `packages/client/src/scenes/GameScene.ts`

**Step 1**: Track decoration tiles. Add a class member:
```typescript
private blockedDecoTiles: Set<string> = new Set(); // key = `${tx},${ty}`
```

In `spawnDecorations()`, after placing each deco, mark its tile as blocked:
```typescript
placed.push({ x: tx, y: ty });
const tileKey = `${tx},${ty}`;
// Mark as blocked if it's a tree or rock (not bush — bushes are passable)
if (asset.key.startsWith('deco_tree') || asset.key.startsWith('deco_rock')) {
  this.blockedDecoTiles.add(tileKey);
}
```

**Alternatively** (cleaner): Use the `decorations` array from `MapConfig` which already defines specific tile positions and types. Modify `spawnDecorations()` to read from `map.decorations` for deterministic placement instead of random, and mark `tree` + `rock` types as blocked. This would also make the map layout consistent across sessions.

**Step 2**: Rewrite `isValidBuildTile()`:
```typescript
isValidBuildTile(tileX: number, tileY: number): boolean {
  // Must be within map bounds
  if (tileX < 0 || tileY < 0 || tileX >= this.mapWidth || tileY >= this.mapHeight) {
    return false;
  }
  // Cannot build on path
  if (this.isOnPath(tileX, tileY)) return false;
  // Cannot build on blocked decoration tile
  if (this.blockedDecoTiles.has(`${tileX},${tileY}`)) return false;
  // All other tiles are valid
  return true;
}
```

**Step 3**: Update ghost overlay coloring in `handleMouseMove()`.  
The existing green/red logic already uses `isValidBuildTile()` — no change needed there.

**Step 4**: Server-side — The server also validates placement. In `GameSimulation.ts` or `GameRoom.ts`, the `place_tower` command probably validates against `buildZones` too. That logic must also be updated to match:

#### `packages/server/src/game/GameSimulation.ts` (or `GameRoom.ts`)

Find the `place_tower` handler and replace the buildZone check with:
```typescript
// OLD: const inZone = map.buildZones.some(z => ...)
// NEW: Allow any tile that isn't path
const onPath = isOnPath(x, y, map.waypoints); // use shared path helper
if (onPath) return { ok: false, reason: 'Cannot build on path' };
```

The `isOnPath` logic currently lives only in `GameScene.ts` (client-side). It should be extracted to `packages/shared/src/data/maps.ts` as a pure utility function:
```typescript
export function isOnPath(tx: number, ty: number, waypoints: Vec2[]): boolean {
  // same loop as GameScene.isOnPath()
}
```
Then import it in both `GameScene.ts` and the server-side placement validator.

**Note**: Removing the build-zone restriction entirely may make the game too easy (players can surround the entire path). Consider keeping build zones but expanding them, or adding a tile-cost mechanic. The plan here enables full flexibility as requested.

---

## Fix #8 — Wave Preview Button

**Complexity: M**

### What changes

Add a **"📋 Waves"** button in the HUD (near the wave counter, top-center area). Clicking it opens a scrollable modal that lists all 20 waves with:
- Wave number
- Enemy group breakdown (type, count, HP, speed)
- Threat telegraph quote
- Current wave highlighted

### Files to modify

#### `packages/client/src/scenes/HudScene.ts`

**Button**: Add next to the wave text panel (currently at `W/2 - 110, 14, 220px wide`). Place a small "📋" button at the right edge of the wave panel, or just below it.

**New method `createWavePreviewButton()`**:
```typescript
private createWavePreviewButton(): void {
  const W = this.cameras.main.width;
  // Small button to right of wave panel
  const btn = this.add.text(W / 2 + 120, 26, '📋 Waves', {
    fontSize: '13px',
    fontFamily: 'Arial',
    color: '#aaccff',
    backgroundColor: '#111133',
    padding: { x: 6, y: 3 },
  }).setScrollFactor(0).setDepth(101)
    .setInteractive({ useHandCursor: true });
  btn.on('pointerdown', () => this.toggleWavePreview());
  btn.on('pointerover', () => btn.setColor('#ffffff'));
  btn.on('pointerout',  () => btn.setColor('#aaccff'));
}
```

**New method `showWavePreview(currentWave: number)`**:
```typescript
private showWavePreview(currentWave: number): void {
  if (this.wavePreviewContainer) {
    this.wavePreviewContainer.destroy();
    this.wavePreviewContainer = null;
    return; // toggle off
  }

  const W = this.cameras.main.width;
  const H = this.cameras.main.height;
  const panelW = Math.min(680, W - 40);
  const panelH = Math.min(520, H - 80);

  const container = this.add.container(W / 2, H / 2);
  container.setScrollFactor(0).setDepth(210);

  // Semi-transparent backdrop
  const backdrop = this.add.rectangle(0, 0, W, H, 0x000000, 0.6)
    .setInteractive();
  backdrop.on('pointerdown', () => {
    this.wavePreviewContainer?.destroy();
    this.wavePreviewContainer = null;
  });

  // Panel background
  const bg = this.add.graphics();
  bg.fillStyle(0x060618, 0.97);
  bg.fillRoundedRect(-panelW/2, -panelH/2, panelW, panelH, 12);
  bg.lineStyle(2, 0xffcc00, 0.8);
  bg.strokeRoundedRect(-panelW/2, -panelH/2, panelW, panelH, 12);

  // Title
  const title = this.add.text(0, -panelH/2 + 22, '📋  Wave Preview', {
    fontSize: '22px', fontFamily: '"Arial Black", Arial', color: '#ffcc00',
    stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0.5);

  container.add([backdrop, bg, title]);

  // Wave rows
  const ENEMY_ICONS: Record<string, string> = {
    grunt: '👣', runner: '💨', tank: '🛡', flyer: '🦋',
    invisible: '👻', caster: '🧙', boss: '💀',
  };

  let rowY = -panelH/2 + 52;
  const rowH = 54;
  const visibleWaves = WAVE_CONFIGS.slice(0, 20); // all 20 waves

  for (const wc of visibleWaves) {
    const isCurrentOrPast = wc.wave <= currentWave;
    const isNext = wc.wave === currentWave + 1;
    const rowAlpha = isCurrentOrPast ? 0.4 : 1.0;
    const borderColor = isNext ? 0x00ff88 : wc.wave === currentWave ? 0xffcc00 : 0x333355;

    // Row background
    const rowBg = this.add.graphics();
    rowBg.fillStyle(isNext ? 0x002200 : 0x0a0a1e, rowAlpha);
    rowBg.fillRoundedRect(-panelW/2 + 10, rowY, panelW - 20, rowH - 4, 6);
    rowBg.lineStyle(1, borderColor, 0.7);
    rowBg.strokeRoundedRect(-panelW/2 + 10, rowY, panelW - 20, rowH - 4, 6);

    // Wave # label
    const waveLabel = this.add.text(
      -panelW/2 + 24, rowY + rowH/2 - 2,
      `Wave ${wc.wave}`, {
        fontSize: '14px', fontFamily: '"Arial Black", Arial',
        color: isCurrentOrPast ? '#666666' : isNext ? '#00ff88' : '#ffffff',
      }
    ).setOrigin(0, 0.5).setAlpha(rowAlpha);

    // Enemy groups summary
    const groupStr = wc.groups
      .map(g => `${ENEMY_ICONS[g.enemyType] ?? '👾'} ${g.count}× ${g.enemyType}`)
      .join('   ');
    const groupText = this.add.text(
      -panelW/2 + 95, rowY + rowH/2 - 10,
      groupStr, {
        fontSize: '12px', fontFamily: 'Arial', color: '#ccccdd',
      }
    ).setOrigin(0, 0.5).setAlpha(rowAlpha);

    // Telegraph quote
    if (wc.telegraph) {
      const telegraphText = this.add.text(
        -panelW/2 + 95, rowY + rowH/2 + 10,
        `"${wc.telegraph}"`, {
          fontSize: '11px', fontFamily: 'Arial', fontStyle: 'italic', color: '#7799bb',
        }
      ).setOrigin(0, 0.5).setAlpha(rowAlpha);
      container.add(telegraphText);
    }

    // Bounty gold
    const bountyText = this.add.text(
      panelW/2 - 14, rowY + rowH/2 - 2,
      `+${wc.bountyGold}g/kill`, {
        fontSize: '11px', fontFamily: 'Arial', color: '#ffd700',
      }
    ).setOrigin(1, 0.5).setAlpha(rowAlpha);

    container.add([rowBg, waveLabel, groupText, bountyText]);
    rowY += rowH;

    // Stop before overflowing the panel
    if (rowY + rowH > panelH/2 - 10) break;
  }

  // Close button top-right
  const closeBtn = this.add.text(panelW/2 - 12, -panelH/2 + 12, '✕', {
    fontSize: '16px', color: '#aa6666',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  closeBtn.on('pointerdown', () => {
    this.wavePreviewContainer?.destroy();
    this.wavePreviewContainer = null;
  });
  container.add(closeBtn);

  this.wavePreviewContainer = container;
}
```

Add `private wavePreviewContainer: Phaser.GameObjects.Container | null = null;` to the class.

In `syncState()`, after updating `currentWave`, pass it to any open wave preview for highlighting. Or simply close/reopen when wave changes.

---

## Recommended Implementation Order

| Priority | Fix | Why |
|----------|-----|-----|
| 1 | **#3 — Bigger Text** | Zero risk, immediate readability win, no dependencies |
| 2 | **#2 — Normal Cursor** | 3-line change, dramatically improves feel |
| 3 | **#6 — Tower Descriptions** | Adds data only, no behavior change |
| 4 | **#5 — Zoom** | Client-only, self-contained, quick win |
| 5 | **#8 — Wave Preview** | Additive UI, no breaking changes |
| 6 | **#7 — Flexible Placement** | Requires shared utility extraction (server+client) |
| 7 | **#1 — Shop Menu** | Refactors TowerPanel visibility flow |
| 8 | **#4 — Game Speed** | Requires server changes, most risk |

---

## Dependencies Between Items

```
#1 (Shop) depends on:
  → #2 (Normal cursor) — shop closing should restore cursor; implement #2 first

#7 (Flexible placement) depends on:
  → Extracting isOnPath() to shared/ (benefits both client and server)
  → Deciding whether to use deterministic or random decoration placement

#4 (Game speed) depends on:
  → Server-side: GameLoop.ts tick delta scaling
  → Shared: GameState must include gameSpeed field
  → Client: GameClient must have setGameSpeed() method

#6 (Descriptions) is a prerequisite for:
  → #1 (Shop panel can show descriptions in tower cards)
  → #3 (Inspector panels should show descriptions — do #6 before #3 so the text space is designed in)

#8 (Wave preview) has no dependencies — fully additive.

#5 (Zoom) + #2 (Cursor) interact:
  → When zoomed in and dragging to pan, must NOT trigger placement if a tower is selected.
    The guard `!this.selectedTowerId` in the pan handler handles this.
```

---

## Additional Notes

### Amplifier Tower — Specific Description Needed
The `amplifier_tower` is the most confusing tower. Its `attackPeriodSec: 0` and `baseDamage: 0` look like a broken tower to players. The description must be prominent and clear:

> **"SUPPORT AURA — Does NOT attack. Instead, all towers within range deal 15% more damage. Stack multiple Amplifiers near your core DPS towers for compounding effect. Upgrade to increase the bonus to 20% then 25% and the aura radius."**

Also consider adding a visual indicator in-world: the existing `aura` ellipse on the tower could be made more prominent (larger, animated ring) for Amplifier to visually communicate its support role.

### Flexible Placement — Server Authority
The server currently validates `place_tower` placement against build zones. If the client allows placing anywhere but the server rejects it, players will see ghost placements that silently fail. Ensure server validation is updated in sync with the client change. Look for the placement validation in `packages/server/src/game/GameSimulation.ts` — search for `buildZone` or `isInBuildZone`.

### Wave Preview — Scrolling
With 20 waves at ~54px each = 1080px total, the panel (max ~520px) won't fit all waves. Either:
- Show only the next 8–10 waves from the current one.
- Implement a scroll mask (Phaser `RenderTexture` or `Graphics` mask) — more complex.
- Keep it simple: show waves `currentWave` through `min(currentWave + 9, 20)`.
