# Implementation Plan V1 — Playtest UX Fixes

> Generated: 2026-02-24
> Branch: `feature/playtest-ux-fixes`
> Verified against actual source files in `packages/`

---

## Table of Contents

1. [Execution Order & Parallelization](#execution-order--parallelization)
2. [Feature #1 — Tower Shop Toggle Menu](#feature-1--tower-shop-toggle-menu)
3. [Feature #2 — Normal Cursor by Default](#feature-2--normal-cursor-by-default)
4. [Feature #3 — Bigger UI Text](#feature-3--bigger-ui-text)
5. [Feature #4 — Game Speed Controls](#feature-4--game-speed-controls)
6. [Feature #5 — Zoom In/Out](#feature-5--zoom-inout)
7. [Feature #6 — Tower Descriptions](#feature-6--tower-descriptions)
8. [Feature #7 — Flexible Building Placement](#feature-7--flexible-building-placement)
9. [Feature #8 — Wave Preview Button](#feature-8--wave-preview-button)

---

## Execution Order & Parallelization

### Dependency Graph

```
#2 (Cursor)  ← no deps
#3 (Text)    ← no deps
#6 (Descriptions) ← no deps
#5 (Zoom)    ← no deps
#8 (Wave Preview) ← no deps
#1 (Shop)    ← benefits from #2 being done first (cursor reset on close)
#7 (Placement) ← requires shared utility extraction + server change
#4 (Speed)   ← requires server-side changes, highest risk
```

### Recommended Order

| Phase | Features | Parallelizable? | Rationale |
|-------|----------|-----------------|-----------|
| 1 | #2, #3, #6 | ✅ All three | Zero-risk, independent files, immediate UX wins |
| 2 | #5, #8 | ✅ Both | Client-only, additive, non-overlapping files |
| 3 | #1 | Solo | Refactors TowerPanel/HudScene flow |
| 4 | #7 | Solo | Server + client + shared changes |
| 5 | #4 | Solo | Server tick scaling, highest risk |

### Complexity Estimates

| Feature | Complexity | Files Modified | New Files |
|---------|-----------|---------------|-----------|
| #1 Shop Toggle | M | 2 | 0 |
| #2 Cursor | S | 1 | 0 |
| #3 Bigger Text | S | 3 | 0 |
| #4 Game Speed | L | 4 | 0 |
| #5 Zoom | S | 2 | 0 |
| #6 Descriptions | S | 3 | 0 |
| #7 Flex Placement | M | 3 | 1 (shared util) |
| #8 Wave Preview | M | 1 | 0 |

---

## Feature #1 — Tower Shop Toggle Menu

**Complexity: M**

### Problem
`TowerPanel` is permanently visible as a right sidebar after class selection. Playtesters want a toggleable shop.

### Files to Modify

#### `packages/client/src/scenes/HudScene.ts`

**Current behavior** (verified): `showTowerPanelForClass()` (line ~330) creates a `TowerPanel` at `W - 110` and it stays visible forever. The panel is stored in `this.towerPanel`.

**Changes:**

1. Add new class members:

```typescript
// Add to class properties (after line ~25, near other private members)
private shopOpen = false;
private shopButton: Phaser.GameObjects.Container | null = null;
private shopBackdrop: Phaser.GameObjects.Rectangle | null = null;
private classTowerConfigs: import('@td/shared').TowerConfig[] = [];
```

2. In `createHudElements()`, add shop button after the classIcon creation (after line ~108 where `this.classIcon` is assigned):

```typescript
// ── Shop button (bottom-left, next to class icon) ──────────
this.shopButton = this.createShopButton(150, H - 70);
this.shopButton.setScrollFactor(0).setDepth(101);
this.shopButton.setVisible(false); // hidden until class is selected
```

3. Add `createShopButton` method:

```typescript
private createShopButton(x: number, y: number): Phaser.GameObjects.Container {
  const container = this.add.container(x, y);
  const btnW = 90;
  const btnH = 40;

  const gfx = this.add.graphics();
  const draw = (hover: boolean) => {
    gfx.clear();
    gfx.fillStyle(hover ? 0x224488 : 0x112244, 0.9);
    gfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
    gfx.lineStyle(2, 0x4488ff, 0.8);
    gfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
  };
  draw(false);

  const label = this.add.text(0, 0, '🛒 Shop', {
    fontSize: '14px',
    fontFamily: '"Arial Black", Arial',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);

  const hitArea = this.add.rectangle(0, 0, btnW, btnH, 0, 0)
    .setInteractive({ useHandCursor: true });
  hitArea.on('pointerover', () => draw(true));
  hitArea.on('pointerout', () => draw(false));
  hitArea.on('pointerdown', () => this.toggleShop());

  container.add([gfx, label, hitArea]);
  return container;
}
```

4. Add `toggleShop`, `openShop`, `closeShop` methods:

```typescript
private toggleShop(): void {
  if (this.shopOpen) {
    this.closeShop();
  } else {
    this.openShop();
  }
}

private openShop(): void {
  if (this.shopOpen || this.classTowerConfigs.length === 0) return;
  this.shopOpen = true;

  const W = this.cameras.main.width;
  const H = this.cameras.main.height;

  // Transparent backdrop to close shop on outside click
  this.shopBackdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.15)
    .setScrollFactor(0).setDepth(99).setInteractive();
  this.shopBackdrop.on('pointerdown', () => this.closeShop());

  this.towerPanel?.setVisible(true);

  // Pop-in animation
  const container = this.towerPanel?.getContainer();
  if (container) {
    container.setScale(0.9);
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 150,
      ease: 'Back.Out',
    });
  }
}

private closeShop(): void {
  if (!this.shopOpen) return;
  this.shopOpen = false;

  if (this.shopBackdrop) {
    this.shopBackdrop.destroy();
    this.shopBackdrop = null;
  }

  this.towerPanel?.setVisible(false);
}
```

5. Modify `showTowerPanelForClass()` — hide panel by default after creation:

```typescript
// In showTowerPanelForClass(), REPLACE the final section.
// After: this.towerPanel.setTowerConfigs(classTowers);
// ADD:
this.classTowerConfigs = classTowers;
this.towerPanel.setVisible(false); // Start hidden — opened via shop button
this.shopButton?.setVisible(true); // Show shop button now that class is selected

// In the setSelectionCallback, ADD closeShop():
this.towerPanel.setSelectionCallback((configId) => {
  const gameScene = this.scene.get('GameScene');
  const gameClient = this.registry.get('gameClient') as GameClient;
  if (gameScene) {
    gameScene.events.emit('tower-selected', configId);
  }
  if (gameClient) {
    gameClient.selectTower(configId);
  }
  this.closeShop(); // Close shop after selecting a tower
  this.flashStartWaveButton();
});
```

#### `packages/client/src/ui/TowerPanel.ts`

No structural changes needed. The existing `setVisible(visible)` method (line ~354) already delegates to `this.container.setVisible(visible)`.

**Minor addition**: Add Escape key support to close shop from within HudScene. In `HudScene.create()`:

```typescript
// In create(), after setupChatSystem():
this.input.keyboard?.on('keydown-ESC', () => {
  if (this.shopOpen) {
    this.closeShop();
    // Also deselect tower and reset cursor
    const gameScene = this.scene.get('GameScene');
    gameScene?.events.emit('tower-deselected');
  }
});
```

### Test Strategy
- Verify shop button appears after class selection
- Click shop button → panel appears with tower list
- Select a tower → shop closes, placement mode activates
- Click backdrop → shop closes
- Press Escape → shop closes
- Gold updates still reach TowerPanel when shop is closed (via `setGold()`)

### Risk Assessment
**Low-Medium**. Main risk is breaking the gold-sync flow if `towerPanel` isn't receiving `setGold()` calls when invisible. Verify `syncState()` still calls `this.towerPanel?.setGold(newGold)` — it does (line ~249).

---

## Feature #2 — Normal Cursor by Default

**Complexity: S**

### Files to Modify

#### `packages/client/src/scenes/GameScene.ts`

1. In `create()` (line ~92), after `this.input.on('pointerdown', ...)`:

```typescript
this.input.setDefaultCursor('auto');
```

2. In `handleTowerSelected()` (line ~375):

```typescript
private handleTowerSelected(configId: string): void {
  this.selectedTowerId = configId;
  this.input.setDefaultCursor('crosshair');
}
```

3. In `handleTowerDeselected()` (line ~379):

```typescript
private handleTowerDeselected(): void {
  this.selectedTowerId = null;
  this.ghostGraphics.clear();
  this.rangePreview.clear();
  this.input.setDefaultCursor('auto');
}
```

**Note on existing interactive elements**: Enemy sprites already have `{ useHandCursor: true }` set in `createEnemyVisual()` (line ~499: `sprite.setInteractive({ useHandCursor: true })`). Tower building sprites do NOT currently have `setInteractive()` — they use `getTowerAtTile()` hit detection via tile coords. This is fine; the click-on-tower detection doesn't need cursor change since it works through tile clicking.

### Test Strategy
- Default state: arrow cursor
- Select tower from shop: crosshair cursor
- Place tower or press Escape: back to arrow cursor
- Hover over enemy: pointer/hand cursor (already works)
- Right-click (ping): cursor stays arrow

### Risk Assessment
**Very Low**. Three one-line additions. No behavioral changes.

---

## Feature #3 — Bigger UI Text

**Complexity: S**

### Files to Modify

#### `packages/client/src/ui/EnemyInspector.ts`

**Current values** (verified from source):
- `PW = 190` (line ~5)
- `HP_BAR_H = 8` (line ~7)
- `PANEL_OFFSET_Y = -110` (line ~9)
- Enemy name: `'13px'` (line ~94)
- HP text: `'11px'` (line ~107)
- Stat labels/values: `'11px'` (lines ~129, ~134)
- Status text: `'10px'` (line ~178)
- Row spacing `cy += 20` (line ~138)

**Changes:**

```typescript
// Line 5: const PW = 190 →
const PW = 260;

// Line 7: const HP_BAR_H = 8 →
const HP_BAR_H = 12;

// Line 9: const PANEL_OFFSET_Y = -110 →
const PANEL_OFFSET_Y = -150;

// Line 94: fontSize: '13px' →
fontSize: '20px',

// Line 107: fontSize: '11px' (HP text) →
fontSize: '16px',

// Lines 129, 134: fontSize: '11px' (stat labels/values) →
fontSize: '16px',

// Line 138: cy += 20 →
cy += 26;

// Line 178: fontSize: '10px' (status text) →
fontSize: '14px',
```

#### `packages/client/src/ui/TowerInspector.ts`

**Current values** (verified from source):
- `PW = 240` (line ~49)
- Tower name: `'14px'` (line ~75)
- Tier stars: `'14px'` (line ~83)
- Owner text: `'11px'` (line ~90)
- Stat labels: `'11px'` (line ~103)
- Stat values: `'11px'` (line ~107)
- Row spacing: `cy += 21` (line ~111)
- Upgrade button label: `'12px'` (line ~173)
- Sell button label: `'12px'` (line ~198)
- Targeting label: `'11px'` (line ~216)

**Changes:**

```typescript
// Line 49: const PW = 240 →
const PW = 300;

// Line 75: fontSize: '14px' (tower name) →
fontSize: '22px',

// Line 83: fontSize: '14px' (tier stars) →
fontSize: '18px',

// Line 90: fontSize: '11px' (owner) →
fontSize: '15px',

// Lines 103, 107: fontSize: '11px' (stat labels/values) →
fontSize: '16px',

// Line 111: cy += 21 →
cy += 28;

// Line 173: fontSize: '12px' (upgrade label) →
fontSize: '16px',

// Line 198: fontSize: '12px' (sell label) →
fontSize: '16px',

// Line 216: fontSize: '11px' (targeting label) →
fontSize: '15px',
```

Also adjust the inspector panel position in `HudScene.showTowerInspector()` (line ~500):

```typescript
// Line ~505: const panelX = W - 130 →
const panelX = W - 160;
```

#### `packages/client/src/ui/TowerPanel.ts`

**Current values** (verified from source):
- `panelWidth = 220` (line ~62)
- `itemHeight = 70` (line ~63)
- Tower name: `'12px'` (line ~210)
- Cost: `'11px'` (line ~224)
- Range: `'10px'` (line ~234)
- Panel title: `'18px'` (line ~82)

**Changes:**

```typescript
// Line 62: private panelWidth = 220 →
private panelWidth = 280;

// Line 63: private itemHeight = 70 →
private itemHeight = 90;

// Line 82: fontSize: '18px' (title) →
fontSize: '22px',

// Line 210: fontSize: '12px' (tower name) →
fontSize: '16px',

// Line 224: fontSize: '11px' (cost) →
fontSize: '15px',

// Line 234: fontSize: '10px' (range) →
fontSize: '14px',
```

Also adjust HudScene panel position. In `showTowerPanelForClass()` (line ~338):

```typescript
// Line ~338: const panelX = W - 110 →
const panelX = W - 150;
```

### Test Strategy
- Open each inspector panel (tower, enemy) and verify text is readable
- Verify panels don't overflow screen bounds at default zoom
- Verify HP bars are proportionally wider
- Check tooltip text is still readable

### Risk Assessment
**Very Low**. Pure cosmetic changes. Only risk is panels becoming too large at certain viewport sizes — but the increases are moderate (1.3-1.5x).

---

## Feature #4 — Game Speed Controls

**Complexity: L**

### Files to Modify

#### `packages/shared/src/index.ts`

Add `gameSpeed` to `GameState` interface (line ~125):

```typescript
export interface GameState {
  phase: GamePhase;
  wave: number;
  maxWaves: number;
  baseHp: number;
  maxBaseHp: number;
  economy: EconomyState;
  players: Record<string, PlayerState>;
  towers: Record<string, TowerState>;
  enemies: Record<string, EnemyState>;
  prepTimeRemaining: number;
  tick: number;
  gameSpeed: number; // 1 | 1.5 | 2
}
```

#### `packages/server/src/rooms/GameRoom.ts`

Add `gameSpeed: 1` to initial state (line ~24, in constructor):

```typescript
this.state = {
  // ... existing fields ...
  tick: 0,
  gameSpeed: 1,
};
```

#### `packages/server/src/game/GameLoop.ts`

Modify the tick callback to accept and use game speed. Change the `onTick` signature and `setInterval` body:

```typescript
export class GameLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTime: number = 0;
  private onTick: (dt: number) => void;
  private getSpeed: () => number; // NEW

  isRunning = false;

  constructor(onTick: (dt: number) => void, getSpeed?: () => number) {
    this.onTick = onTick;
    this.getSpeed = getSpeed ?? (() => 1);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();

    this.intervalId = setInterval(() => {
      const now = performance.now();
      let dt = (now - this.lastTime) / 1000;
      dt = Math.min(dt, 0.1);
      this.lastTime = now;
      // Scale dt by game speed
      const scaledDt = dt * this.getSpeed();
      this.onTick(scaledDt);
    }, TICK_DURATION_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }
}
```

**Integration**: Wherever `GameLoop` is constructed (in `GameSimulation` or server setup), pass the speed getter:

```typescript
this.gameLoop = new GameLoop(
  (dt) => this.tick(dt),
  () => this.state.gameSpeed
);
```

#### `packages/client/src/GameClient.ts`

Add method (after `clearTowerSelection()`):

```typescript
async setGameSpeed(speed: number): Promise<void> {
  await this.network.sendCommand({ type: 'set_game_speed', speed } as any);
}
```

Also add `'set_game_speed'` to the `ClientCommand` union in `shared/src/index.ts`:

```typescript
| { type: 'set_game_speed'; speed: number }
```

#### `packages/client/src/scenes/HudScene.ts`

Add speed toggle UI in `createHudElements()`, positioned below the HP bar:

```typescript
// After HP bar creation (around line ~98), add:
this.createSpeedToggle(W - 70, 78);
```

```typescript
private currentSpeed: number = 1;
private speedLabel: Phaser.GameObjects.Text | null = null;

private createSpeedToggle(x: number, y: number): void {
  const speeds = [1, 1.5, 2];
  const btnW = 50;
  const btnH = 22;

  const gfx = this.add.graphics().setScrollFactor(0).setDepth(101);
  const draw = (hover: boolean) => {
    gfx.clear();
    gfx.fillStyle(hover ? 0x334455 : 0x1a1a2e, 0.9);
    gfx.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4);
    gfx.lineStyle(1, 0x6666aa, 0.7);
    gfx.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4);
  };
  draw(false);

  this.speedLabel = this.add.text(x, y, '1×', {
    fontSize: '13px',
    fontFamily: '"Arial Black", Arial',
    color: '#88ccff',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  const hitArea = this.add.rectangle(x, y, btnW, btnH, 0, 0)
    .setScrollFactor(0).setDepth(101)
    .setInteractive({ useHandCursor: true });
  hitArea.on('pointerover', () => draw(true));
  hitArea.on('pointerout', () => draw(false));
  hitArea.on('pointerdown', () => {
    const idx = speeds.indexOf(this.currentSpeed);
    this.currentSpeed = speeds[(idx + 1) % speeds.length];
    this.speedLabel?.setText(`${this.currentSpeed}×`);

    const gameClient = this.registry.get('gameClient') as GameClient;
    gameClient?.setGameSpeed(this.currentSpeed);

    // Also scale client-side Phaser time for tween/animation sync
    const gameScene = this.scene.get('GameScene');
    if (gameScene) {
      gameScene.time.timeScale = this.currentSpeed;
    }
    this.time.timeScale = this.currentSpeed;
  });
}
```

### Test Strategy
- Click speed button cycles through 1× → 1.5× → 2× → 1×
- At 2×, enemies visibly move faster
- At 2×, towers fire more frequently
- Projectile animations still look correct (tweens scale with timeScale)
- Prep timer counts down faster at 2×
- Resets to 1× on new game

### Risk Assessment
**High**. Server-side delta scaling affects ALL game systems (combat, movement, spawning, wave timing). Thorough testing of:
- Enemy movement speed at each game speed
- Tower attack timing (cooldowns)
- Wave spawn intervals
- Prep timer countdown
- No desync between server state and client animations

---

## Feature #5 — Zoom In/Out

**Complexity: S**

### Files to Modify

#### `packages/client/src/scenes/GameScene.ts`

1. Add class member for default zoom (after line ~55):

```typescript
private defaultZoom = 1;
```

2. In `setupDemoMap()`, store the default zoom (after line ~143 where zoom is calculated):

```typescript
// After: this.cameras.main.setZoom(zoom);
this.defaultZoom = zoom;
```

3. In `create()`, add zoom controls (after existing input handlers, around line ~95):

```typescript
// ── Zoom: mouse wheel ─────────────────────────────────────
this.input.on('wheel', (
  _ptr: Phaser.Input.Pointer,
  _objs: unknown[],
  _dx: number,
  _dy: number,
  dz: number
) => {
  this.adjustZoom(dz > 0 ? -0.1 : 0.1);
});

// ── Zoom: keyboard shortcuts ──────────────────────────────
this.input.keyboard?.on('keydown-PLUS', () => this.adjustZoom(0.15));
this.input.keyboard?.on('keydown-MINUS', () => this.adjustZoom(-0.15));
this.input.keyboard?.on('keydown-NUMPAD_ADD', () => this.adjustZoom(0.15));
this.input.keyboard?.on('keydown-NUMPAD_SUBTRACT', () => this.adjustZoom(-0.15));

// ── Pan: drag when zoomed in ──────────────────────────────
this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
  if (
    ptr.isDown &&
    ptr.button === 0 &&
    this.cameras.main.zoom > this.defaultZoom * 1.1 &&
    !this.selectedTowerId
  ) {
    this.cameras.main.scrollX -= (ptr.x - ptr.prevPosition.x) / this.cameras.main.zoom;
    this.cameras.main.scrollY -= (ptr.y - ptr.prevPosition.y) / this.cameras.main.zoom;
  }
});

// ── Listen for HUD zoom button events ─────────────────────
this.events.on('zoom-in', () => this.adjustZoom(0.2));
this.events.on('zoom-out', () => this.adjustZoom(-0.2));
this.events.on('zoom-reset', () => {
  this.cameras.main.setZoom(this.defaultZoom);
  this.cameras.main.centerOn(
    (this.mapWidth * 64) / 2,
    (this.mapHeight * 64) / 2
  );
});
```

**Note**: The existing `handleMouseMove` listener (line ~91: `this.input.on('pointermove', this.handleMouseMove, this)`) will still fire alongside the pan handler. The pan handler's guard `!this.selectedTowerId` prevents conflict with placement mode. Both can coexist because Phaser allows multiple listeners on the same event.

4. Add `adjustZoom` method:

```typescript
private adjustZoom(delta: number): void {
  const cam = this.cameras.main;
  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 2.5;
  const newZoom = Phaser.Math.Clamp(cam.zoom + delta, MIN_ZOOM, MAX_ZOOM);
  cam.setZoom(newZoom);
}
```

#### `packages/client/src/scenes/HudScene.ts`

Add zoom buttons in `createHudElements()`, bottom-right area (before the `// ── Phase announcement` section):

```typescript
// ── Zoom controls (bottom-right) ─────────────────────────
this.createZoomButtons(W - 60, H - 130);
```

```typescript
private createZoomButtons(x: number, y: number): void {
  const btnSize = 32;
  const gap = 6;

  const makeBtn = (label: string, yOff: number, event: string) => {
    const gfx = this.add.graphics().setScrollFactor(0).setDepth(101);
    const bx = x;
    const by = y + yOff;
    const draw = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0x334466 : 0x1a1a2e, 0.88);
      gfx.fillRoundedRect(bx - btnSize / 2, by - btnSize / 2, btnSize, btnSize, 6);
      gfx.lineStyle(1, 0x6666aa, 0.8);
      gfx.strokeRoundedRect(bx - btnSize / 2, by - btnSize / 2, btnSize, btnSize, 6);
    };
    draw(false);

    const text = this.add.text(bx, by, label, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    const hit = this.add.rectangle(bx, by, btnSize, btnSize, 0, 0)
      .setScrollFactor(0).setDepth(101)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => {
      const gameScene = this.scene.get('GameScene');
      gameScene?.events.emit(event);
    });
  };

  makeBtn('+', 0, 'zoom-in');
  makeBtn('−', btnSize + gap, 'zoom-out');
  makeBtn('⟳', (btnSize + gap) * 2, 'zoom-reset');
}
```

### Test Strategy
- Mouse wheel scrolls zoom smoothly
- +/- buttons work
- Reset button returns to original zoom + center
- When zoomed in past default, click-drag pans the camera
- When zoomed in AND placing a tower, drag does NOT pan (placement ghost works correctly)
- All HUD elements remain fixed (they use `setScrollFactor(0)`)

### Risk Assessment
**Low**. Camera zoom is client-only, no server interaction. Main risk is the pan handler conflicting with tile click detection — mitigated by the `!this.selectedTowerId` guard and `ptr.button === 0` check.

---

## Feature #6 — Tower Descriptions

**Complexity: S**

### Files to Modify

#### `packages/shared/src/index.ts`

Add `description` field to `TowerConfig` interface (line ~31):

```typescript
export interface TowerConfig {
  id: string;
  name: string;
  class: ElementType | 'shared';
  category: TowerCategory;
  roles: TowerRole[];
  costGold: number;
  range: number;
  attackPeriodSec: number;
  baseDamage: number;
  splashRadius?: number;
  onHit?: OnHitEffect[];
  targets: TargetType;
  upgrades: TowerUpgrade[];
  description?: string; // NEW — plain-English explanation for players
}
```

#### `packages/shared/src/data/towers.ts`

Add `description` to every tower config entry:

```typescript
arrow_tower: {
  // ...existing fields...
  description: 'A reliable single-target tower. Fast attacks with moderate damage. Ground targets only.',
},

amplifier_tower: {
  // ...existing fields...
  description: 'SUPPORT: Does not attack. Boosts damage of all towers in range by 15% (20% at T2, 25% at T3). Stack near your strongest towers.',
},

ballista: {
  // ...existing fields...
  description: 'High single-shot damage with long range. Slow reload, but hits both ground and air. Best against tanks and bosses.',
},

scout_tower: {
  // ...existing fields...
  description: 'UTILITY: Reveals invisible enemies within range. Does not deal damage. Essential for waves 16+.',
},

flame_spire: {
  // ...existing fields...
  description: 'AoE fire tower. Damages all enemies in a radius and applies a burning DoT effect.',
},

inferno_cannon: {
  // ...existing fields...
  description: 'Heavy fire cannon. High single-target damage with burn effect. Hits both ground and air.',
},

magma_pool: {
  // ...existing fields...
  description: 'Close-range AoE fire trap. Fast attack speed, large splash, strong burn DoT. Place directly on path bends.',
},

tidal_tower: {
  // ...existing fields...
  description: 'AoE water tower with splash. Slows enemies on hit. Good all-around for crowd control.',
},

geyser: {
  // ...existing fields...
  description: 'Knockback specialist. Low damage but erupts to push enemies backward 3 tiles along the path, buying time.',
},

whirlpool: {
  // ...existing fields...
  description: 'AoE slow tower. Large splash radius with strong slow effect. Pairs well with high-damage towers.',
},

frost_turret: {
  // ...existing fields...
  description: 'Single-target ice tower. Applies cold status that slows enemies. Stacking cold can trigger freeze reactions.',
},

blizzard_tower: {
  // ...existing fields...
  description: 'AoE ice tower. Large splash with slow effect. Combine with water towers for freeze combos.',
},

glacial_spike: {
  // ...existing fields...
  description: 'High single-target ice damage with mild slow. A straightforward DPS tower for the ice class.',
},

venom_spitter: {
  // ...existing fields...
  description: 'Fast poison tower. Low base damage but applies a long-lasting poison DoT. Hits air and ground.',
},

plague_spreader: {
  // ...existing fields...
  description: 'Poison tower with moderate damage and good range. Applies DoT that synergizes with other elements.',
},

miasma_cloud: {
  // ...existing fields...
  description: 'AoE poison cloud. Very large splash radius with DoT. Low base damage, but excels at softening groups.',
},
```

#### `packages/client/src/ui/TowerPanel.ts`

In `buildTooltipText()` method (line ~115), add description after the header:

```typescript
private buildTooltipText(config: TowerConfig): string {
  const lines: string[] = [];
  lines.push(`[ ${config.name} ]`);

  // ADD: description block
  if (config.description) {
    lines.push('');
    lines.push(config.description);
    lines.push('');
  }

  lines.push(`Cost: ${config.costGold}g`);
  // ...rest unchanged
```

#### `packages/client/src/ui/TowerInspector.ts`

In `buildPanel()`, add description below tier stars (after line ~88, after `cy += 18` for tier):

```typescript
// After tier stars, ADD:
if (this.config?.description) {
  const descText = this.scene.add.text(0, cy, this.config.description, {
    fontSize: '12px',
    fontFamily: 'Arial',
    color: '#bbbbdd',
    wordWrap: { width: PW - 28 },
  }).setOrigin(0.5, 0);
  items.push(descText);
  cy += descText.height + 8;
}
```

### Test Strategy
- Hover over tower in shop panel → tooltip shows description
- Click on placed tower → TowerInspector shows description below tier stars
- Verify all 16 towers have descriptions (no undefined/missing)
- Verify Amplifier and Scout descriptions are especially clear about their non-attack nature

### Risk Assessment
**Very Low**. Additive data field + display changes. Optional field, so no breaking changes if a tower is missing a description.

---

## Feature #7 — Flexible Building Placement

**Complexity: M**

### Files to Modify

#### New File: `packages/shared/src/pathUtils.ts`

Extract path checking to a shared utility:

```typescript
// packages/shared/src/pathUtils.ts
import type { Vec2 } from './index.js';

/**
 * Checks whether a tile coordinate lies on the path defined by waypoints.
 * Path is defined as all tiles between consecutive waypoints (axis-aligned segments).
 */
export function isOnPath(tx: number, ty: number, waypoints: Vec2[]): boolean {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (a.x === b.x) {
      // Vertical segment
      if (tx === a.x && ty >= Math.min(a.y, b.y) && ty <= Math.max(a.y, b.y)) return true;
    } else {
      // Horizontal segment
      if (ty === a.y && tx >= Math.min(a.x, b.x) && tx <= Math.max(a.x, b.x)) return true;
    }
  }
  return false;
}
```

Export from `packages/shared/src/index.ts`:

```typescript
export { isOnPath } from './pathUtils.js';
```

#### `packages/client/src/scenes/GameScene.ts`

1. Import shared utility:

```typescript
import { TILE_SIZE, MAP_CONFIGS, TOWER_CONFIGS, isOnPath as sharedIsOnPath } from '@td/shared';
```

2. Rewrite `isValidBuildTile()` (line ~568):

```typescript
isValidBuildTile(tileX: number, tileY: number): boolean {
  // Must be within map bounds
  if (tileX < 0 || tileY < 0 || tileX >= this.mapWidth || tileY >= this.mapHeight) {
    return false;
  }
  // Cannot build on path
  if (this.isOnPath(tileX, tileY)) return false;
  // All other tiles are valid (occupied check is separate in handleMouseMove/handleTileClick)
  return true;
}
```

**Note**: The existing `isOnPath()` private method (line ~311) can stay as-is since it's already used throughout the client. The shared version is for the server side. Alternatively, refactor the client to use the shared version too:

```typescript
private isOnPath(tx: number, ty: number): boolean {
  return sharedIsOnPath(tx, ty, this.waypoints);
}
```

3. The build zone visual styling in `renderMap()` should remain — it still shows "recommended" build areas visually, even though building is now allowed elsewhere. Consider making the styling subtler or adding a comment:

```typescript
// Build zone styling remains as visual guide — building is allowed anywhere non-path
```

#### `packages/server/src/systems/TowerSystem.ts`

1. Import shared utility:

```typescript
import { isOnPath } from '@td/shared';
```

2. Rewrite `isInBuildZone` to `isValidPlacement` (line ~43):

```typescript
private isValidPlacement(x: number, y: number): boolean {
  // Must be within map bounds
  if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) {
    return false;
  }
  // Cannot build on path
  if (isOnPath(x, y, this.map.waypoints)) return false;
  return true;
}
```

3. Update `placeTower()` (line ~49):

```typescript
placeTower(configId: string, x: number, y: number, ownerId: string): PlaceResult {
  const config = this.configs[configId];
  if (!config) return { ok: false, reason: 'Unknown tower config' };

  if (!this.isValidPlacement(x, y)) {
    return { ok: false, reason: 'Invalid placement location' };
  }

  if (this.occupiedTiles.has(this.tileKey(x, y))) {
    return { ok: false, reason: 'Tile is occupied' };
  }
  // ...rest unchanged
```

### Test Strategy
- Can place towers on any grass tile that's not on the path
- Cannot place on path tiles (ghost shows red)
- Cannot place on occupied tiles
- Server rejects path placements
- Decorations (trees/rocks) do NOT block placement (they're visual only, randomly placed)
- Existing build zones still display as visual guides
- Run existing server tests: `pnpm --filter @td/server test` — may need to update `GameSimulation.placement-phase.test.ts` if tests assert build-zone-only placement

### Risk Assessment
**Medium**.
- **Server test breakage**: Tests in `GameSimulation.placement-phase.test.ts` likely test that placement outside build zones fails. These must be updated.
- **Game balance**: Removing build zone restrictions may make the game significantly easier. Players can surround the entire path with towers. Consider this a deliberate design choice per playtester feedback.
- **Decoration overlap**: Random decorations from `spawnDecorations()` don't block placement — towers will visually overlap decorations. This is acceptable for now but could look odd.

---

## Feature #8 — Wave Preview Button

**Complexity: M**

### Files to Modify

#### `packages/client/src/scenes/HudScene.ts`

1. Add class members (near other private properties):

```typescript
private wavePreviewContainer: Phaser.GameObjects.Container | null = null;
private currentWaveNum = 0;
```

2. In `createHudElements()`, add wave preview button next to wave panel (after wave text creation, around line ~78):

```typescript
// ── Wave preview button (right of wave panel) ─────────────
this.createWavePreviewButton(W / 2 + 125, 33);
```

3. Track current wave in `syncState()` (add near line ~245 where wave text is updated):

```typescript
this.currentWaveNum = state.wave;
```

4. Add methods:

```typescript
private createWavePreviewButton(x: number, y: number): void {
  const btnW = 32;
  const btnH = 24;

  const gfx = this.add.graphics().setScrollFactor(0).setDepth(101);
  const draw = (hover: boolean) => {
    gfx.clear();
    gfx.fillStyle(hover ? 0x223355 : 0x111133, 0.9);
    gfx.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4);
    gfx.lineStyle(1, 0x4466aa, 0.7);
    gfx.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 4);
  };
  draw(false);

  const label = this.add.text(x, y, '📋', {
    fontSize: '14px',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  const hit = this.add.rectangle(x, y, btnW, btnH, 0, 0)
    .setScrollFactor(0).setDepth(101)
    .setInteractive({ useHandCursor: true });
  hit.on('pointerover', () => { draw(true); });
  hit.on('pointerout', () => { draw(false); });
  hit.on('pointerdown', () => this.toggleWavePreview());
}

private toggleWavePreview(): void {
  if (this.wavePreviewContainer) {
    this.wavePreviewContainer.destroy();
    this.wavePreviewContainer = null;
    return;
  }
  this.showWavePreview();
}

private showWavePreview(): void {
  const W = this.cameras.main.width;
  const H = this.cameras.main.height;
  const panelW = Math.min(620, W - 40);
  const panelH = Math.min(500, H - 80);

  const container = this.add.container(W / 2, H / 2);
  container.setScrollFactor(0).setDepth(210);

  // Semi-transparent backdrop
  const backdrop = this.add.rectangle(0, 0, W * 2, H * 2, 0x000000, 0.5)
    .setInteractive();
  backdrop.on('pointerdown', () => {
    this.wavePreviewContainer?.destroy();
    this.wavePreviewContainer = null;
  });

  // Panel background
  const bg = this.add.graphics();
  bg.fillStyle(0x060618, 0.97);
  bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
  bg.lineStyle(2, 0xffcc00, 0.8);
  bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);

  // Title
  const title = this.add.text(0, -panelH / 2 + 22, '📋  Wave Preview', {
    fontSize: '22px',
    fontFamily: '"Arial Black", Arial',
    color: '#ffcc00',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);

  container.add([backdrop, bg, title]);

  // Close button
  const closeBtn = this.add.text(panelW / 2 - 16, -panelH / 2 + 14, '✕', {
    fontSize: '16px',
    color: '#aa6666',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  closeBtn.on('pointerdown', () => {
    this.wavePreviewContainer?.destroy();
    this.wavePreviewContainer = null;
  });
  container.add(closeBtn);

  // Enemy type icons
  const ENEMY_ICONS: Record<string, string> = {
    grunt: '👣', runner: '💨', tank: '🛡', flyer: '🦋',
    invisible: '👻', caster: '🧙', boss: '💀',
  };

  // Wave rows — show waves centered around current wave
  const rowH = 46;
  const maxRows = Math.floor((panelH - 70) / rowH);
  const startWave = Math.max(0, this.currentWaveNum - 2);
  const visibleWaves = WAVE_CONFIGS.slice(startWave, startWave + maxRows);

  let rowY = -panelH / 2 + 55;

  for (const wc of visibleWaves) {
    const isPast = wc.wave < this.currentWaveNum;
    const isCurrent = wc.wave === this.currentWaveNum;
    const isNext = wc.wave === this.currentWaveNum + 1;
    const rowAlpha = isPast ? 0.35 : 1.0;

    // Row background
    const rowBg = this.add.graphics();
    const fillColor = isNext ? 0x002211 : isCurrent ? 0x1a1a00 : 0x0a0a1e;
    rowBg.fillStyle(fillColor, rowAlpha);
    rowBg.fillRoundedRect(-panelW / 2 + 10, rowY, panelW - 20, rowH - 4, 6);

    const borderColor = isNext ? 0x00ff88 : isCurrent ? 0xffcc00 : 0x333355;
    rowBg.lineStyle(1, borderColor, 0.7);
    rowBg.strokeRoundedRect(-panelW / 2 + 10, rowY, panelW - 20, rowH - 4, 6);

    // Wave number
    const waveColor = isPast ? '#666666' : isNext ? '#00ff88' : isCurrent ? '#ffcc00' : '#ffffff';
    const waveLabel = this.add.text(
      -panelW / 2 + 24, rowY + rowH / 2 - 2,
      `W${wc.wave}`, {
        fontSize: '14px',
        fontFamily: '"Arial Black", Arial',
        color: waveColor,
      }
    ).setOrigin(0, 0.5).setAlpha(rowAlpha);

    // Enemy groups
    const groupStr = wc.groups
      .map(g => `${ENEMY_ICONS[g.enemyType] ?? '👾'}${g.count}`)
      .join(' ');
    const groupText = this.add.text(
      -panelW / 2 + 70, rowY + rowH / 2 - 8,
      groupStr, {
        fontSize: '13px',
        fontFamily: 'Arial',
        color: '#ffccaa',
      }
    ).setOrigin(0, 0.5).setAlpha(rowAlpha);

    // Telegraph
    const telegraphText = this.add.text(
      -panelW / 2 + 70, rowY + rowH / 2 + 10,
      `"${wc.telegraph}"`, {
        fontSize: '10px',
        fontFamily: 'Arial',
        fontStyle: 'italic',
        color: '#7799bb',
      }
    ).setOrigin(0, 0.5).setAlpha(rowAlpha);

    // Bounty
    const bountyText = this.add.text(
      panelW / 2 - 16, rowY + rowH / 2 - 2,
      `${wc.bountyGold}g`, {
        fontSize: '11px',
        fontFamily: 'Arial',
        color: '#ffd700',
      }
    ).setOrigin(1, 0.5).setAlpha(rowAlpha);

    container.add([rowBg, waveLabel, groupText, telegraphText, bountyText]);
    rowY += rowH;
  }

  // Keyboard dismiss
  const escHandler = () => {
    this.wavePreviewContainer?.destroy();
    this.wavePreviewContainer = null;
    this.input.keyboard?.off('keydown-ESC', escHandler);
  };
  this.input.keyboard?.on('keydown-ESC', escHandler);

  this.wavePreviewContainer = container;
}
```

### Test Strategy
- Click 📋 button → wave preview opens
- Click again → closes (toggle)
- Click backdrop → closes
- Press Escape → closes
- Past waves are dimmed
- Current wave is highlighted in gold
- Next wave is highlighted in green
- Enemy counts and types are correct (cross-reference with WAVE_CONFIGS)
- Bounty gold values match
- Panel doesn't overflow at any viewport size

### Risk Assessment
**Low**. Purely additive UI. No game state changes. Only risk is z-index conflicts with other panels — mitigated by depth 210 (above most other UI at 101-205).

---

## Summary of All File Changes

| File | Features |
|------|----------|
| `packages/shared/src/index.ts` | #4, #6, #7 |
| `packages/shared/src/data/towers.ts` | #6 |
| `packages/shared/src/pathUtils.ts` | #7 (NEW) |
| `packages/client/src/scenes/GameScene.ts` | #1, #2, #5, #7 |
| `packages/client/src/scenes/HudScene.ts` | #1, #3, #4, #5, #8 |
| `packages/client/src/ui/TowerPanel.ts` | #3, #6 |
| `packages/client/src/ui/TowerInspector.ts` | #3, #6 |
| `packages/client/src/ui/EnemyInspector.ts` | #3 |
| `packages/client/src/GameClient.ts` | #4 |
| `packages/server/src/game/GameLoop.ts` | #4 |
| `packages/server/src/rooms/GameRoom.ts` | #4 |
| `packages/server/src/systems/TowerSystem.ts` | #7 |
