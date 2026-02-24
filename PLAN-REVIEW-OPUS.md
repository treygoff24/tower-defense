# Implementation Plan V1 — Review

> Reviewer: Opus Sub-Agent  
> Date: 2026-02-24  
> Verdict: **Needs V1.1 fixes before execution** (mostly ready, ~6 issues to address)

---

## Per-Feature Assessment

### Feature #1 — Tower Shop Toggle Menu ⚠️ NEEDS FIXING

**Issues:**

1. **`towerPanel.getContainer()` is correct** — the method exists (line ~354 of TowerPanel.ts). ✅

2. **ESC key conflict**: The plan adds an ESC handler in HudScene for shop close. But TowerInspector and EnemyInspector both also register ESC handlers via `addKey(ESC)`. Phaser's keyboard system will fire ALL listeners. If the shop is open and the player presses ESC, both the shop close AND any open inspector dismiss will fire simultaneously. Fix: gate the ESC handler — only close shop if no inspector is open, or use `stopPropagation` patterns.

3. **`setSelectionCallback` override**: The plan rewrites the selection callback to add `this.closeShop()`. But `showTowerPanelForClass()` already sets this callback (line ~346). The plan says to modify it inline, which is fine, but the plan's code snippet shows the callback being re-set rather than modifying the existing one. This needs to be a modification of the existing callback, not a replacement — the existing `gameScene.events.emit('tower-selected')` and `gameClient.selectTower()` calls must remain.

4. **Missing `getContainer()` on TowerPanel**: The `openShop()` method calls `this.towerPanel?.getContainer()` which does exist. ✅

5. **Minor**: `shopButton` position at `(150, H-70)` may overlap the class icon at `(70, H-70)`. The class icon is 36px radius, so its right edge is at ~106px. Shop button at x=150 with width 90 means left edge at 105px — tight but works.

**Verdict**: Needs fixing (ESC conflict, callback integration)

---

### Feature #2 — Normal Cursor by Default ✅ CORRECT

The plan correctly identifies:
- No `setDefaultCursor` call exists currently
- `handleTowerSelected` is at line ~375, `handleTowerDeselected` at ~379
- Enemy sprites already have `useHandCursor: true`

One missing piece: **cursor should reset when tower is placed** (after `tile-clicked` emits and placement succeeds). Currently the plan only resets on `handleTowerDeselected`. If the shop auto-closes after selection (Feature #1), and the player places the tower, `handleTowerDeselected` is never explicitly called — the `selectedTowerId` stays set until the next click. The cursor will stay as crosshair, which is actually correct behavior (player may want to place multiple of the same tower). This is fine.

**Verdict**: Correct, ready to implement.

---

### Feature #3 — Bigger UI Text ✅ CORRECT (minor concern)

All line references and current values verified against source. The changes are proportional and reasonable.

**Concern**: The TowerPanel width increase from 220→280 combined with Feature #1's shop toggle means the panel will take more screen real estate when open. At 1280px viewport width, a 280px panel is ~22% of the screen. Acceptable for a toggle menu.

**Missing**: The `panelX` adjustment in `showTowerPanelForClass` (line ~338: `W - 110` → `W - 150`) should be coordinated with Feature #1 since that feature modifies the same method. The plan acknowledges file overlap but doesn't call out this specific merge conflict.

**Verdict**: Correct, needs merge coordination with #1.

---

### Feature #4 — Game Speed Controls ⚠️ NEEDS FIXING

**Critical issues:**

1. **`ClientCommand` union mismatch**: The plan adds `{ type: 'set_game_speed'; speed: number }` to `ClientCommand`, but the server needs a handler for this command. The plan doesn't show where the server processes this command (e.g., in `GameRoom.ts`'s message handler). Without this, the command is sent but never received.

2. **`GameLoop` constructor change breaks existing callers**: The plan changes `GameLoop`'s constructor signature by adding an optional `getSpeed` parameter. This is backward-compatible (optional param), ✅ but the integration code `() => this.state.gameSpeed` requires knowing where `GameLoop` is instantiated. The plan references `GameSimulation` but doesn't show that file. Need to verify.

3. **`gameSpeed` not in `GameState` interface currently**: The plan correctly identifies this and adds it. ✅

4. **Client-side `time.timeScale` scaling**: This is clever but has a subtle issue. Phaser's `timeScale` affects ALL tweens in that scene, including UI animations (tower place pop-in, enemy death spiral, etc.). At 2×, the tower placement bounce will be 2× faster — this is actually desirable for game feel consistency. ✅

5. **Missing: `as any` type cast**: The plan casts the command `as any` which is a smell. Better to properly add the type to the union first, then no cast needed.

6. **Multiplayer sync**: If one player changes speed, ALL players' games speed up. The plan doesn't address this — is this intended? For a co-op tower defense, having one player control game speed for everyone is reasonable but should be documented. The server should probably broadcast the speed change.

7. **Missing server-side handler**: No code shown for handling `set_game_speed` in the room/simulation. This is the biggest gap.

**Verdict**: Needs fixing — missing server handler, multiplayer design decision needed.

---

### Feature #5 — Zoom In/Out ⚠️ NEEDS FIXING

**Issues:**

1. **Wheel event signature is wrong**: Phaser's `wheel` event callback receives `(pointer, gameObjects, deltaX, deltaY, deltaZ)` but `deltaZ` is not standard — Phaser uses `deltaY` for the scroll wheel. The plan uses `dz` as the last parameter. In Phaser 3, the wheel event passes `(pointer, currentlyOver, dx, dy, dz)` where `dy` is the actual scroll delta. The plan's destructuring with `dz` (5th param) may be incorrect — should use `_dy` (4th param):

```typescript
this.input.on('wheel', (_ptr, _objs, _dx, dy: number) => {
  this.adjustZoom(dy > 0 ? -0.1 : 0.1);
});
```

Actually, checking Phaser 3 docs: the wheel event emits `(pointer, gameObjects, deltaX, deltaY, deltaZ)`. The vertical scroll is `deltaY`. The plan's code uses position 5 (`dz`) which would be `deltaZ` (tilt). **This is a bug** — should use `_dy` (position 4).

2. **Pan conflicts with tile clicking**: The plan adds `pointermove` panning with `ptr.isDown && ptr.button === 0 && !this.selectedTowerId`. But the existing `handleTileClick` on `pointerdown` also fires for button 0. If zoomed in and you click to select a tower or inspect it, the `pointermove` will also trigger panning during the brief pointer-down period. This could cause jittery panning on click. Fix: add a drag threshold (e.g., only pan if `ptr.getDistance() > 5`).

3. **`mapWidth` and `mapHeight` references**: The plan uses `this.mapWidth` and `this.mapHeight` which are private fields that exist. ✅

4. **`keydown-PLUS`**: Phaser uses `keydown-EQUAL` for the `+/=` key (since `+` requires Shift). The `keydown-PLUS` event may not fire on standard keyboards. Should use `keydown-EQUAL` or check Phaser's key name mapping.

5. **Missing `defaultZoom` storage**: The plan correctly identifies where zoom is calculated in `setupDemoMap()`. ✅

6. **Zoom + ghost placement interaction**: When zoomed, `pointer.worldX/worldY` should still correctly map to world coordinates because Phaser handles camera transforms. ✅

**Verdict**: Needs fixing (wheel param, key names, drag threshold).

---

### Feature #6 — Tower Descriptions ✅ CORRECT

- `TowerConfig` interface addition is optional field — backward compatible ✅
- `buildTooltipText` insertion point is correct ✅
- TowerInspector insertion after tier stars is correct ✅
- All 16 towers get descriptions ✅
- Descriptions are well-written and gameplay-relevant ✅

**One improvement**: The TowerInspector code adds description with `fontSize: '12px'` but Feature #3 is scaling text up. These should be coordinated — the description should probably be `'14px'` if implemented after Feature #3.

**Verdict**: Correct, minor font size coordination needed with #3.

---

### Feature #7 — Flexible Building Placement ⚠️ NEEDS FIXING

**Issues:**

1. **`isValidBuildTile` rewrite is correct** — changes from build-zone check to path check. ✅

2. **Server-side `isInBuildZone` → `isValidPlacement` rename**: The plan correctly identifies the method at line ~43 of TowerSystem.ts. ✅

3. **Shared `pathUtils.ts` creation**: Good pattern. The `isOnPath` logic matches the existing client-side implementation exactly. ✅

4. **`Vec2` import**: The shared utility imports `Vec2` from `'./index.js'`. ✅

5. **Critical: `upgrades.deltas` type issue**: The plan uses `'+5'` string format for deltas in towers.ts, but `applyDelta` in TowerInspector expects either number or string starting with `*`. Looking at the existing data: deltas use strings like `'+5'`, `'*-0.15'`. The `applyDelta` function handles `*` prefix (multiply) and falls through to `parseFloat` for additive strings. This existing pattern works. Not related to Feature #7 but noted. ✅

6. **Server test breakage**: The plan acknowledges this. The existing `placeTower` test likely tests `'Not in a build zone'` error message. After changes, the error message changes to `'Invalid placement location'`. Tests will fail on the message string. **Must update tests.**

7. **Game balance concern**: Correctly noted. This is a deliberate design choice.

8. **Missing: client `isValidBuildTile` still references `this.buildZones` internally via `isInBuildZone`**: Wait — the plan rewrites `isValidBuildTile` to use `isOnPath` instead. But the existing `isInBuildZone` method (line ~325) is also used by `spawnDecorations` (line ~340). The plan doesn't modify `spawnDecorations`, which still calls `isInBuildZone`. This is fine — decorations should still avoid build zones. ✅

**Verdict**: Needs fixing — update server tests, error message strings.

---

### Feature #8 — Wave Preview Button ✅ CORRECT (minor issues)

1. **`WAVE_CONFIGS` import**: HudScene already imports `WAVE_CONFIGS` from `@td/shared` (line ~3). ✅

2. **`currentWaveNum` tracking**: Correctly added to `syncState()`. ✅

3. **Depth 210**: Above TowerInspector (205) and below nothing critical. ✅

4. **Minor**: The wave preview uses `WAVE_CONFIGS.slice(startWave, startWave + maxRows)` which accesses WAVE_CONFIGS as an array — which it is (exported as `WaveConfig[]`). ✅

5. **ESC key conflict again**: The preview adds its own ESC handler with `this.input.keyboard?.on('keydown-ESC', escHandler)`. This will fire alongside the shop ESC handler (Feature #1) and inspector ESC handlers. If the wave preview is open and you press ESC, it could close the preview AND the shop simultaneously. Fix: the ESC handler should check if the wave preview is the topmost panel.

6. **Missing cleanup**: If `syncState` runs while the preview is open, `currentWaveNum` updates but the displayed preview doesn't refresh. This is acceptable — the preview is a snapshot.

**Verdict**: Correct, minor ESC conflict with other features.

---

## Cross-Feature Interaction Analysis

### 🔴 ESC Key Conflicts (#1 × #5 × #8 × existing inspectors)

The most pervasive issue. Four different ESC handlers can fire simultaneously:
- Feature #1: close shop
- Feature #8: close wave preview
- Existing: TowerInspector dismiss
- Existing: EnemyInspector dismiss

**Recommendation**: Implement a simple UI stack/priority system:

```typescript
// In HudScene, add:
private uiStack: string[] = []; // e.g., ['shop', 'wave-preview', 'tower-inspector']

private handleGlobalEsc(): void {
  // Close the topmost UI element only
  const top = this.uiStack[this.uiStack.length - 1];
  switch (top) {
    case 'wave-preview': this.closeWavePreview(); break;
    case 'shop': this.closeShop(); break;
    case 'tower-inspector': this.hideTowerInspector(); break;
    // EnemyInspector is in GameScene, needs its own handling
  }
}
```

Register ONE ESC handler in HudScene and remove individual ESC handlers from each feature.

### 🟡 Text Size (#3) × Panel Width (#1)

Feature #3 increases TowerPanel width from 220→280. Feature #1 positions the shop button and manages show/hide. The `panelX` positioning in `showTowerPanelForClass` is modified by both features. **Merge carefully** — implement #3 first, then #1 adjusts to the new widths.

### 🟢 Zoom (#5) × Placement (#7)

No conflict. `pointer.worldX/worldY` correctly handles camera zoom transforms. The ghost tile placement in `handleMouseMove` uses world coordinates. ✅

### 🟢 Zoom (#5) × Inspector Panels

Inspectors use `setScrollFactor(0)` so they stay fixed on screen regardless of zoom. ✅ However, EnemyInspector follows the enemy in world space (does NOT use scrollFactor 0) — at high zoom, it could go offscreen. **Minor UX issue** — not a blocker.

### 🟡 Speed (#4) × Animations

At 2× speed with `time.timeScale = 2`, ALL tweens run 2× faster:
- Tower placement pop-in: 125ms instead of 250ms (fine)
- Enemy death animations: 150ms instead of 300ms (fine)
- Wave banner slide-in: 200ms instead of 400ms (fine)
- HP low pulse: 300ms instead of 600ms (noticeable but acceptable)

### 🟢 Shop (#1) × Cursor (#2)

Plan correctly closes shop on tower selection, which triggers `handleTowerSelected` → crosshair cursor. When shop closes without selection (backdrop/ESC), cursor stays as arrow. ✅

### 🟡 Placement (#7) × Visual Guides

After #7, build zones are visual guides only. The stone platform styling in `renderMap` still renders. Players might be confused: "I see marked zones but I can build anywhere?" Consider adding a brief tooltip or making build zone styling much subtler (lower alpha).

---

## Missing Test Coverage

1. **Feature #4**: No tests for game speed affecting combat calculations (tower cooldowns, enemy movement, DoT ticks, wave spawn timing). This is the highest-risk gap.
2. **Feature #5**: No tests for zoom bounds (MIN_ZOOM/MAX_ZOOM enforcement).
3. **Feature #7**: Server placement tests need updating — plan acknowledges this but doesn't provide updated test code.
4. **Feature #8**: No test that wave preview data matches actual WAVE_CONFIGS values.
5. **Integration**: No test for "select tower from shop → place at zoomed-in view → cursor resets" flow.

---

## Recommended Priority Fixes Before Execution

| Priority | Issue | Feature | Fix |
|----------|-------|---------|-----|
| P0 | Missing server handler for `set_game_speed` | #4 | Add command handler in GameRoom |
| P0 | Wheel event uses wrong parameter (`dz` vs `dy`) | #5 | Use 4th parameter `deltaY` |
| P1 | ESC key conflicts across all features | #1,#5,#8 | Implement UI stack pattern |
| P1 | Server test updates for placement | #7 | Update test assertions |
| P2 | Keyboard zoom uses `keydown-PLUS` (may not work) | #5 | Use `keydown-EQUAL` |
| P2 | Pan drag threshold to prevent click-jitter | #5 | Add `getDistance() > 5` guard |
| P3 | Font size coordination between #3 and #6 | #3,#6 | Use consistent scaled sizes |

---

## Overall Verdict

**Needs V1.1 patch** — not a full rewrite. The plan is architecturally sound and demonstrates strong understanding of the codebase. The execution order and parallelization strategy are correct. The code snippets are well-written and follow existing patterns.

The two blocking issues are:
1. **Feature #4 is incomplete** — missing the server-side command handler entirely
2. **Feature #5 has a bug** — wrong wheel event parameter will cause scroll to not work

With those fixed plus the ESC stack pattern, this plan is ready to execute. Estimated additional work: ~1-2 hours for fixes, then execute as planned.
