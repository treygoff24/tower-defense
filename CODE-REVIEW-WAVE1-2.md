# Tower Defense Code Review - Wave 1-2

## Per-Feature Findings

### Feature #2 — Normal cursor by default
- **Bugs/Logic Errors:** The `handleTileClick` event was correctly moved from `pointerdown` to `pointerup` to allow for drag-to-pan, but `pointer.rightButtonDown()` is used to detect right-clicks. Because `pointerup` fires *after* the button is released, the right button is no longer "down," meaning right-click pinging is completely broken.
- **Nitpicks:** Adding `.setInteractive({ useHandCursor: true })` to tower bases means placed towers will show a "hand" cursor on hover. While in the "prep/combat" phase (placing a new tower with a crosshair cursor), hovering over an existing tower will temporarily revert your cursor to a hand, which can feel a bit jarring.

### Feature #3 — Bigger UI text
- **UX Issues:** In `TowerPanel.ts`, the font sizes were increased (to 16px, 15px, and 14px), but the hardcoded Y-offsets for the text elements (`-16`, `2`, `16`) were left unchanged. This causes the tower name, cost, and range text to visually overlap inside the tooltip.
- **Nitpicks:** In `TowerInspector.ts`, `descriptionText` uses `cy += descriptionText.height + 8`, but the subsequent `ownerText` uses a centered origin. This results in the gap between the description and the owner text being less than 1 pixel.

### Feature #5 — Zoom in/out
- **Logic Errors/UX Issues:** In `GameScene.ts`, panning is restricted by `if (... && this.cameras.main.zoom > 1.1)`. Because `defaultZoom` is calculated dynamically based on map size, it can often be much lower than 1.0 (e.g., 0.5). If the user zooms in to 1.0, they are zoomed in 2x but still cannot pan because 1.0 is not greater than 1.1.

### Feature #6 — Tower descriptions
- **Findings:** Descriptions were added properly to the configs and UI panels. Handled cleanly except for the minor spacing issue mentioned in Feature #3.

### Feature #8 — Wave preview panel
- **UX Issues:** In `HudScene.ts`, the modal background (`panelBg`) is a non-interactive `Graphics` object. Clicking anywhere inside the wave list falls through to the screen-covering `backdrop`, which triggers `toggleWavePreview()`. The user will accidentally close the modal just by clicking inside it.

## Cross-Feature Issues
- **Descriptions + UI Scaling (Features #3 & #6):** Because the panel width increased (Feature #3) and descriptions were added (Feature #6), the dynamic `cy` layout in `TowerInspector.ts` is getting compressed. The math for advancing `cy` needs to explicitly account for text height and origin offsets to prevent element crowding (such as the `ownerText` crowding).

## Specific Fixes Needed

### 1. Fix Right-Click Ping (GameScene.ts)
**File:** `packages/client/src/scenes/GameScene.ts` (approx. line 734)
```typescript
// Replace:
if (pointer.rightButtonDown()) {

// With:
if (pointer.button === 2) {
```

### 2. Fix Text Overlap in Tower Tooltips (TowerPanel.ts)
**File:** `packages/client/src/ui/TowerPanel.ts` (approx. lines 326, 346, 357)
```typescript
// Adjust the Y coordinates for the text elements:

// Line 326 (Name):
.text(textX, -22, displayName, {

// Line 346 (Cost):
.text(textX, 0, costStr, {

// Line 357 (Range):
.text(textX, 22, `📏 ${rangeVal} tiles`, {
```

### 3. Fix Panning Condition (GameScene.ts)
**File:** `packages/client/src/scenes/GameScene.ts` (approx. line 127)
```typescript
// Replace:
if (ptr.isDown && ptr.button === 0 && this.cameras.main.zoom > 1.1 && !this.selectedTowerId) {

// With:
if (ptr.isDown && ptr.button === 0 && this.cameras.main.zoom > this.defaultZoom + 0.01 && !this.selectedTowerId) {
```

### 4. Fix Wave Preview Click-Through (HudScene.ts)
**File:** `packages/client/src/scenes/HudScene.ts` (approx. line 638)
```typescript
// Below `previewContainer.add(panelBg);`, add an interactive blocker:
const panelHit = this.add.rectangle(0, 0, panelW, panelH, 0, 0)
  .setInteractive()
  .on('pointerdown', (ptr: Phaser.Input.Pointer, lx: number, ly: number, evt: Phaser.Types.Input.EventData) => evt.stopPropagation());
previewContainer.add(panelHit);
```

### 5. Improve Tower Inspector Spacing (TowerInspector.ts)
**File:** `packages/client/src/ui/TowerInspector.ts` (approx. line 121)
```typescript
// Replace:
cy += descriptionText.height + 8;

// With:
cy += descriptionText.height + 14;
```

## Verdict

### MUST-FIX Items
1. `GameScene.ts`: Pinging is broken on right-click due to `pointer.rightButtonDown()` returning false on `pointerup`.
2. `GameScene.ts`: Panning threshold hardcoded to `1.1` breaks panning on maps where the base zoom is smaller.
3. `TowerPanel.ts`: Overlapping text vertically in the build panel tooltips.
4. `HudScene.ts`: Wave preview modal closes instantly when clicked because the panel doesn't capture pointer events.

### Nice-to-Have
1. `TowerInspector.ts`: Increase vertical padding (`cy`) after descriptions to prevent crowding `ownerText`.
2. `GameScene.ts`: Reconsider `.setInteractive({ useHandCursor: true })` on towers if we want strict crosshair cursor consistency during the placement phase.
