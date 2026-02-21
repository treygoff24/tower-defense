# Wave 1 Code Review — Element Defense V2
**Reviewer:** Athena (sub-agent)  
**Scope:** All commits since `a11ec30`  
**Date:** 2026-02-20  
**Status:** ✅ Tests green (176/176) | ✅ Typecheck clean

---

## Summary

Wave 1 lands 6 tasks across 17 files (+1 170 / -75 lines). The server-side logic
(HP drain, kill bounty, phase-gated placement, sell refund) is well-implemented
and backed by solid integration tests. The client-side sell flow (SoundPool,
sell panel, visual dissolve) is polished. However **one real bug was found**
(race condition that can crash the renderer), two dead-code clusters left over
from the refund redesign, and a handful of lesser quality issues.

---

## 🔴 Bugs / Logic Errors

### B1 — Race condition: double `destroyTowerVisual` on tower sell *(HIGH)*

**File:** `packages/client/src/scenes/GameScene.ts` → `handleTowerSoldVisual`

When the user sells a tower, the visual dissolve tween runs for **300 ms**.
The server emits a snapshot every **250 ms** (`SNAPSHOT_INTERVAL_MS`). If the
snapshot arrives before the tween completes, `syncTowers` walks `this.towers`,
finds the sold tower absent from server state, and calls
`destroyTowerVisual(tv)` — destroying the Phaser game objects while the tween
is still animating them. When the tween's `onComplete` fires 50–300 ms later,
it calls `destroyTowerVisual(tv)` a second time on already-destroyed objects,
which will throw or silently corrupt the scene.

```ts
// Current (broken): tower stays in this.towers during the 300ms tween
handleTowerSoldVisual(data: { instanceId: string; goldRefund: number }): void {
  const tv = this.towers.get(data.instanceId);
  if (tv) {
    this.spawnFloatingText(...);
    this.tweens.add({
      targets: [tv.base, tv.soldier, tv.aura],
      duration: 300,
      onComplete: () => {
        this.destroyTowerVisual(tv);      // ← second destroy if syncTowers
        this.towers.delete(data.instanceId); //   already ran
      },
    });
  }
}
```

**Fix:** Remove from `this.towers` *immediately*, before starting the tween, so
`syncTowers` cannot see the tower. Call `destroyTowerVisual` only in
`onComplete`.

```ts
handleTowerSoldVisual(data: { instanceId: string; goldRefund: number }): void {
  const tv = this.towers.get(data.instanceId);
  if (!tv) return;

  // Remove from tracking BEFORE the tween so syncTowers won't double-destroy
  this.towers.delete(data.instanceId);
  this.spawnFloatingText(tv.base.x, tv.base.y - 20, `+${data.goldRefund}g 💰`, 0xffd700, 16);
  this.tweens.add({
    targets: [tv.base, tv.soldier, tv.aura],
    alpha: 0, scaleX: 0, scaleY: 0,
    duration: 300, ease: 'Power2.In',
    onComplete: () => this.destroyTowerVisual(tv),
  });
  this.audio.playSellTower();
}
```

---

### B2 — Server-side `sellTower` has no phase guard *(MEDIUM)*

**File:** `packages/server/src/game/GameSimulation.ts`

`placeTower` correctly rejects calls during invalid phases (lobby, victory,
defeat). `sellTower` has no such guard — a player can send a raw `sell_tower`
socket command during `lobby`, `victory`, or `defeat` and the server will
refund gold.

```ts
// Missing guard — should mirror placeTower's pattern
sellTower(_playerId: string, instanceId: string): CommandResult & { goldRefund?: number } {
  // No phase check!
  const result = this.towerSystem.sellTower(instanceId);
  ...
}
```

**Fix:**
```ts
sellTower(_playerId: string, instanceId: string): CommandResult & { goldRefund?: number } {
  const phase = this.room.state.phase;
  if (phase !== 'prep' && phase !== 'combat') {
    return { ok: false, reason: `Cannot sell towers during ${phase} phase` };
  }
  ...
}
```

---

### B3 — Sell rejection silently swallows error (UX bug) *(LOW)*

**File:** `packages/client/src/GameClient.ts`

The sell panel is dismissed optimistically (immediately on click), before the
server responds. If the server rejects the sell, `hideSellPanel()` has already
been called and the panel is gone. The user only gets a `console.warn` with no
in-game feedback.

```ts
// onSell in GameClient — panel is already hidden before this resolve
if (result.ok) {
  hudScene.hideSellPanel();          // harmless no-op (already null)
  gameScene.events.emit('tower-sold-visual', ...);
} else {
  console.warn('Sell rejected:', result.reason);  // invisible to player
}
```

**Fix:** Either (a) close the panel optimistically but show a toast/flash on
rejection, or (b) keep the panel open until confirmation arrives.

---

## 🟡 Dead Code

### D1 — `EconomySystem.refundTower()` is now unreachable *(MEDIUM)*

**File:** `packages/server/src/systems/EconomySystem.ts`

Before this wave, `sellTower` called `economy.refundTower(invested)`. The
refactor moved refund calculation to `TowerSystem.sellTower()` (using
`Math.round(baseCost * 0.5)`) and then calls `economy.addGold(result.goldRefund)`
directly. `refundTower()` is no longer called anywhere in production code — only
its own dedicated unit test calls it.

```ts
// EconomySystem.ts — dead method
refundTower(originalCost: number): void {
  this.state.gold += Math.floor(originalCost * TOWER_SELL_REFUND_PERCENT);
  //                  ^^^^^^^^^^^^^ Math.floor vs Math.round in TowerSystem — inconsistent!
}
```

**Action:** Remove `refundTower()` and its test, or reintegrate it as the
single source of refund calculation (and reconcile `Math.floor` vs `Math.round`).

---

### D2 — `towerInvestment` map in `TowerSystem` is maintained but never read *(MEDIUM)*

**File:** `packages/server/src/systems/TowerSystem.ts`

`towerInvestment` tracks accumulated gold spent (base + upgrades). With the
new refund policy (base-cost only), `sellTower` no longer reads from this map.
It is still written to in `placeTower` and `upgradeTower`, and deleted in
`sellTower` — pure overhead.

```ts
private towerInvestment: Map<string, number> = new Map();  // written, never read for logic

sellTower(instanceId: string): SellResult {
  const baseCost = this.configs[tower.configId].costGold;  // reads config, not map
  const refund = Math.round(baseCost * TOWER_SELL_REFUND_PERCENT);
  ...
  this.towerInvestment.delete(instanceId);  // still cleaned up but serves no purpose
}
```

**Action:** Remove the `towerInvestment` map and all three sites that touch it.

---

### D3 — `GameClient.sellTower()` public method is never called *(LOW)*

**File:** `packages/client/src/GameClient.ts`

```ts
async sellTower(instanceId: string): Promise<{ ok: boolean; reason?: string; goldRefund?: number }> {
  return this.network.sellTower(instanceId);  // wraps network directly
}
```

The event handler in the same file calls `this.network.sellTower()` directly,
bypassing this method. The public method is never invoked externally. Either
call it from the event handler for consistency, or remove it.

---

### D4 — `instanceId` stored on sell panel container is never read *(LOW)*

**File:** `packages/client/src/scenes/HudScene.ts`

```ts
(container as unknown as { instanceId: string }).instanceId = instanceId;
```

The `instanceId` is stored via an unsafe type cast onto the container object,
but nothing ever reads it back. It was probably leftover from a cancelled
design. Remove it.

---

## 🟡 TypeScript / Type Safety

### T1 — `handleTowerSoldVisual` missing `private` modifier *(LOW)*

All other event handler methods in `GameScene` are declared `private`. This
one defaults to `public` by omission, widening the public API unintentionally.

```ts
// Should be private:
handleTowerSoldVisual(data: { instanceId: string; goldRefund: number }): void {
```

---

### T2 — `any` casts in test files *(LOW / acceptable)*

Tests use `(sim as any).room.state.phase = 'combat'` to force internal state.
This is a common test pattern for sealed classes, but it means tests won't
catch if the internal field name changes. Worth tracking if the simulation
gains a testing facade.

---

## 🟡 Test Coverage Gaps

### TC1 — No server-side test for `sellTower` phase guard

No test verifies the missing phase guard identified in B2. Once the guard is
added, tests should cover: sell in lobby → rejected; sell in prep → ok; sell in
victory → rejected.

### TC2 — No integration test for the full `GameSimulation.sellTower()` gold path

`TowerSystem.test.ts` tests the refund calculation, and the multiplayer
integration test covers the socket path. But there is no
`GameSimulation`-level test that confirms `economy.gold` increases by the
correct refund after a sell call (analogous to the `placeTower` gold-spend
tests).

### TC3 — `SoundPool.release()` not called from `AudioManager` — no auto-cleanup

`SoundPool.release()` is tested in isolation but `AudioManager.playEvent()`
never calls `pool.release()` when a sound finishes naturally. The pool fills
with completed (silent) instances until it hits the cap and starts evicting.
This is harmless given the cap of 4, but it means the pool is always "full"
for active categories after 4 sounds have played, and the eviction stop()
callback fires on already-finished oscillators. Consider wiring the oscillator
`onended` event to call `pool.release()`.

---

## ✅ What's Well Done

| Area | Notes |
|------|-------|
| **SoundPool** | Clean, pure-TS, decoupled from Web Audio. Excellent test suite (FIFO eviction, volume normalisation, category independence, release, clearAll). |
| **HP drain by type** | `ENEMY_BASE_DAMAGE` constant is properly typed as `Record<EnemyType, number>`, exhaustive over the union, and exported from shared. The `?? 1` fallback in `GameSimulation` is safe. |
| **Kill bounty** | Correctly distinguishes primary vs splash kills. Both code paths call the same gold-award logic. Tests are realistic (blocker pattern prevents wave-bonus contamination). |
| **Phase-gated placement** | Clean, well-tested. The 6-case test matrix (lobby, class_select, prep, combat, victory, defeat) is thorough. |
| **Refund redesign** | Moving from total-investment to base-cost-only is semantically simpler and consistently applied across `shared/`, `TowerSystem`, `EconomySystem`, and the multiplayer integration test. |
| **Sell UX flow** | Sell panel pop-in/out animations, interactive hover states, and the dissolve tween are polished. The double-`hideSellPanel` call is safe (guarded by `if (!this.sellPanel) return`). |
| **AudioManager refactor** | SoundPool integration is clean. Every public SFX method routes through `playEvent()`. The 5ms ramp-down on eviction avoids click artifacts. |

---

## Integration Issues Between the 6 Tasks

All six tasks share `GameSimulation.ts` as the coordination point. No merge
conflicts or logical overlaps were found. The only integration concern is
cross-cutting:

- **Task 1A (Sell Refund) + Task 1E (Sell Flow):** The refund calculation
  lives in `TowerSystem`, the economy update lives in `GameSimulation`, and the
  UI update lives in `GameClient`/`GameScene`. These are well-separated. The
  dead code in `EconomySystem.refundTower()` (D1) is the seam artifact from
  this split.

- **Task 1C (Phase-gated Placement):** Added to `GameSimulation.placeTower()`
  but not to `GameSimulation.sellTower()` (B2). The two methods should have
  consistent phase guards.

---

## Action Items (Priority Order)

| # | Severity | File | Action |
|---|----------|------|--------|
| 1 | 🔴 High | `GameScene.ts` | Fix double-destroy race in `handleTowerSoldVisual` (B1) |
| 2 | 🟡 Med | `GameSimulation.ts` | Add phase guard to `sellTower` (B2) + test |
| 3 | 🟡 Med | `EconomySystem.ts` | Remove dead `refundTower()` method and its test (D1) |
| 4 | 🟡 Med | `TowerSystem.ts` | Remove dead `towerInvestment` map (D2) |
| 5 | 🟡 Low | `GameClient.ts` | Sell rejection needs player-visible feedback (B3) |
| 6 | 🟢 Low | `GameClient.ts` | Remove unused `sellTower()` wrapper (D3) |
| 7 | 🟢 Low | `HudScene.ts` | Remove unused `instanceId` on container (D4) |
| 8 | 🟢 Low | `GameScene.ts` | Add `private` to `handleTowerSoldVisual` (T1) |
| 9 | 🟢 Low | `AudioManager.ts` | Wire `onended` → `pool.release()` for accurate polyphony tracking (TC3) |

---

## Test & Build Status

```
pnpm test      ✅  176 tests passed (0 failed)
pnpm typecheck ✅  0 type errors
```
