# Implementation Plan V1 — Review by Athena

## Overall Assessment
The implementation plan is exceptionally thorough and demonstrates a deep understanding of the existing Phaser 3 architecture, event bus, and networking layer. The file paths, function names, and most line numbers (with minor deviations) are completely accurate. 

However, there are a few **critical interaction bugs** that will occur if the plan is implemented verbatim. These involve input event overlapping (dragging vs. clicking), multiplayer state desyncing (game speed), and scope locking (ESC key). 

---

## Feature-by-Feature Review

### Feature #1 — Tower Shop Toggle Menu
- **What's correct:** UI layout, pop-in tween, click-outside-to-close mechanics, and integration with `showTowerPanelForClass` are perfect.
- **What needs fixing:** The `keydown-ESC` logic in `HudScene` only cancels tower placement if `this.shopOpen` is `true`. Players must be able to cancel placement at any time, even if the shop has already automatically closed.
- **What's missing:** Nothing.

### Feature #2 — Normal Cursor by Default
- **What's correct:** Cursor strings (`auto`, `crosshair`) and function targets (`handleTowerSelected`, `handleTowerDeselected`).
- **What needs fixing:** Nothing. The cursor will reset to `auto` successfully once the player right-clicks or presses ESC to deselect (provided Feature #1's ESC bug is fixed).
- **What's missing:** Nothing.

### Feature #3 — Bigger UI Text
- **What's correct:** Exact constants (`PW`, `HP_BAR_H`, font sizes), file paths, and relative sizing logic. 
- **What needs fixing:** Nothing.
- **What's missing:** Nothing. Purely aesthetic and correctly scoped.

### Feature #4 — Game Speed Controls
- **What's correct:** Server-side `GameLoop` modification to scale `dt`, addition to `GameState`, and client command structure.
- **What needs fixing:** The plan modifies the client's `timeScale` *immediately* upon clicking the button. Because game speed is a server-controlled `GameState` variable, modifying it instantly creates a desync. Furthermore, other connected clients will never receive the updated `timeScale` because the plan missed updating `timeScale` inside `HudScene.syncState()`.
- **What's missing:** Reactivity. The UI text and Phaser `timeScale` must update reactively via `syncState()`.

### Feature #5 — Zoom In/Out
- **What's correct:** Zoom limits, wheel delta logic, keyboard listeners, and camera boundary tracking.
- **What needs fixing:** Adding a click-and-drag pan listener creates a massive conflict with `handleTileClick`. `GameScene.create()` binds `handleTileClick` to `pointerdown`. If a player drags to pan, `pointerdown` fires immediately, causing the game to unintentionally place a tower, select an entity, or open an inspector. 
- **What's missing:** `handleTileClick` must be moved to `pointerup` and check `pointer.getDistance()` to ignore drag gestures.

### Feature #6 — Tower Descriptions
- **What's correct:** Typescript interface modifications, hardcoded tower data text, and UI rendering logic.
- **What needs fixing:** Nothing.
- **What's missing:** Nothing.

### Feature #7 — Flexible Building Placement
- **What's correct:** `isOnPath` shared utility extraction, path math, and server-side placement overriding.
- **What needs fixing:** Nothing technically. 
- **What's missing (Risk):** The plan removes `isInBuildZone` checks entirely on the server. The `MapConfig` defines `PlayerZones` which dictate which build zones unlock based on the player count. By removing build zones, the multiplayer progression boundaries are completely nullified. This is acceptable for MVP but should be flagged to the game designer.

### Feature #8 — Wave Preview Button
- **What's correct:** Wave array slicing math, bounding box constraints, background tinting, and icon mapping.
- **What needs fixing:** Nothing. The math beautifully handles prep phase (`currentWaveNum === 0`) by correctly highlighting Wave 1 as the next wave.
- **What's missing:** Nothing.

---

## Specific Corrections & Code Fixes

### 1. Fix ESC Key Scope (Feature #1)
In `packages/client/src/scenes/HudScene.ts`, the ESC key handler must deselect the tower unconditionally:
```typescript
this.input.keyboard?.on('keydown-ESC', () => {
  if (this.shopOpen) {
    this.closeShop();
  }
  // ALWAYS allow cancelling placement, even if the shop is already closed
  const gameScene = this.scene.get('GameScene');
  gameScene?.events.emit('tower-deselected');
});
```

### 2. Fix Multiplayer Time Sync (Feature #4)
In `packages/client/src/scenes/HudScene.ts`, **remove** the immediate state changes from the button click:
```typescript
  hitArea.on('pointerdown', () => {
    const idx = speeds.indexOf(this.currentSpeed);
    const nextSpeed = speeds[(idx + 1) % speeds.length];
    
    // ONLY send the command. Do not apply timeScale locally yet!
    const gameClient = this.registry.get('gameClient') as GameClient;
    gameClient?.setGameSpeed(nextSpeed);
  });
```
Then, add the actual application logic inside `syncState()` so all clients stay synced:
```typescript
// Inside HudScene.syncState(state: GameState)
if (state.gameSpeed && state.gameSpeed !== this.currentSpeed) {
  this.currentSpeed = state.gameSpeed;
  this.speedLabel?.setText(`${this.currentSpeed}×`);
  
  // Scale client-side Phaser time for tween/animation sync
  this.time.timeScale = this.currentSpeed;
  const gameScene = this.scene.get('GameScene');
  if (gameScene) {
    gameScene.time.timeScale = this.currentSpeed;
  }
}
```

### 3. Fix Pan vs. Click Conflict (Feature #5)
In `packages/client/src/scenes/GameScene.ts`, change the event listener inside `create()`:
```typescript
// Replace pointerdown with pointerup
this.input.on('pointerup', this.handleTileClick, this);
```
And modify `handleTileClick` to reject drags:
```typescript
private handleTileClick(pointer: Phaser.Input.Pointer): void {
  // Prevent clicks if the player was dragging to pan the camera
  if (pointer.getDistance() > 5) return;

  // ... existing ping and right-click logic ...
}
```

---

## Execution Order & Parallelization Feedback

The plan's dependency graph is technically sound, but the **parallelization strategy has a high risk of Git merge conflicts**. 

Features #1, #4, #5, and #8 **all** require adding new UI elements directly into `HudScene.ts`'s `createHudElements()` method. If four developers work on these in parallel, they will generate persistent merge conflicts due to overlapping structural insertions in the same function block.

**Recommendation:** 
- Have one developer block out the container/method shells in `createHudElements()` in a base branch first, OR
- Assign all `HudScene` additive features (#4, #5, #8) to a single developer to avoid coordination overhead.