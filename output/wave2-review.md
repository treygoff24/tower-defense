# Wave 2 Code Review — Element Defense V2

**Reviewer:** Vulcan (subagent)  
**Date:** 2026-02-20  
**Commits reviewed:** `cf65fc5..aad09d9` (feat 2A tooltip, 2B inspector, 2C targeting) + `b3a2b57` (wave1 bugfix)  
**Test status:** ✅ `pnpm test` — 159 server + 33 client + 48 shared = 240 tests, all pass  
**Typecheck:** ✅ `pnpm typecheck` — clean across all 3 packages  

> **Note:** Wave 3 commits (`feat(3A,3C,3D)`, `feat(3B)`, `feat(3D)`) landed during this review session. Final test/typecheck was run against HEAD which includes Wave 3. The Wave 2 bugs identified below **persist in HEAD** and are unresolved by Wave 3.

---

## Executive Summary

Wave 2 adds three client-side features (tooltip on hover, tower inspector panel, per-tower targeting priority) and one backend feature (tower upgrades). The foundational pieces are solid — server-side targeting and upgrade logic are well-implemented and well-tested. However, **two Wave 2 features are functionally broken due to incomplete client wiring**, and there are several secondary quality issues worth fixing before Wave 3.

---

## 🔴 Critical Bugs

### BUG-1: `showTowerInspector` is never called — the Tower Inspector panel is unreachable (Wave 2B)

**File:** `packages/client/src/GameClient.ts:47–64`  
**Severity:** Critical — entire Wave 2B feature is dead code in gameplay

`GameClient.ts` handles the `placed-tower-clicked` event and still routes it to the old `showSellPanel()`:

```typescript
// GameClient.ts (unchanged from Wave 1)
gameScene.events.on(
  'placed-tower-clicked',
  (data: { instanceId: string; configId: string; refund: number }) => {
    hudScene.showSellPanel(data.instanceId, data.configId, data.refund, async () => { ... });
  }
);
```

Wave 2B added `showTowerInspector()` to `HudScene.ts` and added `tier` to the `placed-tower-clicked` payload (in `GameScene.ts`), but **`GameClient.ts` was never updated** to call `showTowerInspector`. The old `showSellPanel` is still wired. As a result:

- `TowerInspector` (`packages/client/src/ui/TowerInspector.ts`, 454 lines) is never instantiated
- Upgrade button, tier stars, stat display, and targeting selector are all unreachable
- The `tier` field in the emitted event goes unused

**Fix:** Update `GameClient.ts` to call `hudScene.showTowerInspector(data.instanceId, data.configId, data.tier, data.refund)` instead of `showSellPanel`. The sell logic now lives inside `TowerInspector`'s `onSell` callback (already wired in `HudScene.showTowerInspector`).

---

### BUG-2: Targeting mode changes are never sent to the server (Wave 2C)

**File:** `packages/client/src/scenes/HudScene.ts:1029–1031`  
**Severity:** Critical — feature appears to work in UI but has no effect on combat

The `onTargetingChange` callback only stores the mode in a local `Map`:

```typescript
onTargetingChange: (mode: TargetingMode) => {
  this.targetingModes.set(instanceId, mode);  // ← local only, never sent
},
```

Neither `GameClient` nor `NetworkManager` has a `setTargeting` method. The `set_targeting` command is fully implemented on the server (`GameSimulation.setTargeting`, `CombatSystem` targeting modes) and in the shared `ClientCommand` type, but it is **never sent from the client**. The targeting selector is cosmetic: all towers always use the default `'first'` mode in combat.

**Fix:** Add `setTargeting(instanceId, mode)` to `NetworkManager` and `GameClient`, then call it from the `onTargetingChange` callback:

```typescript
// NetworkManager.ts
async setTargeting(instanceId: string, mode: TargetingMode): Promise<{ ok: boolean; reason?: string }> {
  return this.sendCommand({ type: 'set_targeting', instanceId, mode });
}

// HudScene.ts — onTargetingChange
onTargetingChange: (mode: TargetingMode) => {
  this.targetingModes.set(instanceId, mode);
  const gameClient = this.registry.get('gameClient') as GameClient;
  gameClient?.setTargeting(instanceId, mode).catch(console.error);
},
```

---

## 🟡 Medium Bugs

### BUG-3: `upgradeTower` has no phase guard (inconsistent with `placeTower` / `sellTower`)

**File:** `packages/server/src/game/GameSimulation.ts:107–129`  
**Severity:** Medium — exploit allows upgrading in lobby/victory/defeat

Both `placeTower` and `sellTower` reject commands during non-play phases:

```typescript
// placeTower & sellTower both have:
if (phase !== 'prep' && phase !== 'combat') {
  return { ok: false, reason: `...not allowed during ${phase} phase` };
}
```

`upgradeTower` has no such guard — upgrades will succeed in `lobby`, `victory`, and `defeat` phases.

**Fix:** Add the same phase guard at the top of `upgradeTower`:

```typescript
upgradeTower(playerId: string, instanceId: string): CommandResult & { newTier?: number } {
  const phase = this.room.state.phase;
  if (phase !== 'prep' && phase !== 'combat') {
    return { ok: false, reason: `Tower upgrading not allowed during ${phase} phase` };
  }
  // ...
}
```

---

### BUG-4: `setTargeting` has no ownership check

**File:** `packages/server/src/game/GameSimulation.ts:144–149`  
**Severity:** Medium — in multiplayer, any player can reroute any tower's targeting

```typescript
setTargeting(_playerId: string, instanceId: string, mode: TargetingMode): CommandResult {
  const tower = this.towerSystem.getTower(instanceId);
  if (!tower) return { ok: false, reason: 'Tower not found' };
  tower.targetingMode = mode;  // no ownerId check
  return { ok: true };
}
```

Compare to `upgradeTower` and `sellTower` which check `tower.ownerId !== playerId`. `_playerId` is currently unused.

**Fix:** Add `if (tower.ownerId !== playerId) return { ok: false, reason: 'You do not own this tower' };` and rename the parameter from `_playerId` to `playerId`.

---

## 🟠 Code Quality Issues

### QUALITY-1: Dead code — `TowerSystem.towerInvestment` Map declaration

**File:** `packages/server/src/systems/TowerSystem.ts:32`

The Wave1 bugfix (`b3a2b57`) removed all three write sites (`set`, `set`/`get`, `delete`) for `towerInvestment`, but the declaration was not removed:

```typescript
private towerInvestment: Map<string, number> = new Map();  // ← allocated, never written or read
```

**Fix:** Remove line 32 from `TowerSystem.ts`.

---

### QUALITY-2: `TargetingMode` type is duplicated

**File:** `packages/client/src/ui/TowerInspector.ts:6`

`TargetingMode` is defined locally in `TowerInspector.ts`:

```typescript
export type TargetingMode = 'first' | 'last' | 'strongest' | 'weakest' | 'closest';
```

It is also the canonical definition in `packages/shared/src/index.ts:56`. The client could import the shared type instead of re-defining it. `HudScene.ts` already does `import type { TargetingMode } from '../ui/TowerInspector'` — if the type moves to shared, that import changes to `@td/shared`.

**Fix:**
```typescript
// TowerInspector.ts — remove local definition, import from shared
import type { TowerConfig, TowerUpgrade, TargetingMode } from '@td/shared';
// Export for backward compat with HudScene import (or update HudScene import)
export type { TargetingMode };
```

---

### QUALITY-3: `applyDelta` implemented twice with divergent semantics

**Files:** `packages/client/src/ui/TowerInspector.ts:368–375`, `packages/server/src/systems/CombatSystem.ts:14–30`

The client has its own private `applyDelta`:

```typescript
// TowerInspector.ts
if (delta.startsWith('*')) return value * (1 + parseFloat(delta.slice(1)));
return value + parseFloat(delta);  // ← handles bare strings like '5' or '-5'
```

The server's exported version:
```typescript
// CombatSystem.ts  
if (delta.startsWith('+')) return currentValue + parseFloat(delta.slice(1));
if (delta.startsWith('*')) return currentValue * (1 + factor);
return currentValue;  // ← bare strings silently no-op
```

For current config data (all deltas use explicit `+` or `*` prefixes) the behaviors are equivalent. But they diverge on bare numeric strings, creating a maintenance trap.

**Fix:** Export `applyDelta` from `@td/shared` (or from `CombatSystem.ts` if shared is kept lean) and import it in `TowerInspector.ts` instead of re-implementing.

---

### QUALITY-4: `tower_upgraded` ServerEvent is never handled by the client

**File:** `packages/server/src/index.ts:75–81`, `packages/client/src/networking/NetworkManager.ts`

The server emits a `tower_upgraded` event via `socket.emit('event', ...)` on successful upgrade:

```typescript
socket.emit('event', {
  type: 'tower_upgraded',
  instanceId: command.instanceId,
  newTier: upgradeResult.newTier,
} satisfies import('@td/shared').ServerEvent);
```

But `NetworkManager.ts` has no `socket.on('event', ...)` listener — this message is silently dropped. The tier eventually syncs via the game state snapshot (250ms cadence), so upgrades do work, but there is no immediate feedback (e.g., could update inspector label before it closes, or trigger VFX).

Similarly, `tower_sold` is defined in the `ServerEvent` union type but is never emitted by the server.

**Fix (low priority):** Either add an `onServerEvent` listener to `NetworkManager`/`GameClient`, or remove the `socket.emit('event', ...)` block for `tower_upgraded` if the snapshot sync is sufficient. Remove `tower_sold` from the `ServerEvent` type or implement the emit.

---

### QUALITY-5: `TowerInspector.getContainer()` and `getTargetingMode()` are unused

**File:** `packages/client/src/ui/TowerInspector.ts:446–453`

Two public methods are defined but never called by any consumer:

```typescript
getContainer(): Phaser.GameObjects.Container { return this.container; }
getTargetingMode(): TargetingMode { return this.currentTargetingMode; }
```

`HudScene` manages the inspector by calling `destroy()` and re-creating. Neither getter is used.

**Fix:** Remove both methods, or keep if future consumers are planned (e.g., when fixing BUG-2, `getTargetingMode()` may become useful for reading state before sending to server — but a callback-based approach (`onTargetingChange`) is already in place).

---

### QUALITY-6: Inline type cast for `gameClient` in `GameScene.ts`

**File:** `packages/client/src/scenes/GameScene.ts:675–677`

```typescript
const gameClient = this.registry.get('gameClient') as 
  { getLatestState(): { towers: Record<string, { tier: number }> } | null } | undefined;
```

This anonymous inline type is fragile and duplicates the shape of `GameClient` / `GameState`. If `TowerState` gains new fields that need to be read here, the cast would silently fail to expose them.

**Fix:** Import `GameClient` type and use `as GameClient | undefined`. Then call `state?.towers[instanceId]?.tier` via the proper `GameState` type.

---

## 🧪 Test Coverage Gaps

### TEST-1: `GameSimulation.setTargeting` has zero tests

The `setTargeting` server method is untested. No tests for:
- Basic success path (mode stored on tower)
- Unknown tower rejection
- Ownership check (currently absent — see BUG-4)
- Phase-agnostic behavior

### TEST-2: No phase guard tests for `upgradeTower`

`GameSimulation.upgrade.test.ts` tests the success path and most rejection cases well. But there are no tests for the missing phase guard (lobby/victory/defeat rejection). The existing `sellTower` tests in `GameSimulation.test.ts` demonstrate the pattern:

```typescript
it('rejects upgrade in lobby phase', () => { ... });
it('rejects upgrade in victory phase', () => { ... });
it('rejects upgrade in defeat phase', () => { ... });
it('allows upgrade in prep phase', () => { ... });
it('allows upgrade in combat phase', () => { ... });
```

These should be added after BUG-3 is fixed.

### TEST-3: Client-side `TowerInspector` and `Tooltip` have no unit tests

Both `Tooltip.ts` and `TowerInspector.ts` are non-trivial (192 and 454 lines respectively) with complex layout logic, stat computation (`computeStats`, `applyDelta`), and user interaction state. The client test suite only covers `StateInterpolator` and `SoundPool`. At minimum, the stat computation and `applyDelta` logic in `TowerInspector` should have unit tests.

---

## ✅ What's Working Well

- **`CombatSystem` targeting modes** (Wave 2C server side): Clean implementation with a well-structured `findTarget` refactor. The `candidates` filter → `switch(mode)` → `reduce` pattern is readable and correct. All 5 modes have tests including tiebreakers.
- **`getEffectiveStat` + upgrade delta application**: Centralizes the "apply upgrade deltas" logic that was previously duplicated across `getDamage`, `canFire`, `getSplashTargets`. Correctly applies deltas cumulatively per tier. `onHit` delta support via dot-path notation is clever.
- **`applyDelta` export + unit tests**: Well-tested in `CombatSystem.test.ts`. The 7 `applyDelta` unit tests cover numeric, `+`, `*`, and edge cases.
- **`Tooltip` component**: Clean, reusable design with edge-avoidance positioning logic (flip below, shift left/right). Proper fade lifecycle with tween stop-before-restart.
- **`TowerInspector` panel layout**: Well-structured top-to-bottom layout with a vertical cursor. Keyboard (ESC) dismiss, entrance animation, and affordability-aware upgrade button are solid.
- **Upgrade gold rollback on unexpected failure**: `GameSimulation.upgradeTower` correctly calls `economy.addGold(upgradeCost)` on `TowerSystem.upgradeTower` failure.
- **`GameSimulation.upgrade.test.ts`**: 10 tests covering success, gold deduction, state reflection, and rejection cases (non-owner, max tier, insufficient gold, no gold deduction on rejection). Good coverage.
- **Wave1 bugfix in `b3a2b57`**: All 4 bugs properly fixed. Phase guard for sell, race condition fix (delete before tween), SoundPool release wiring, and dead code removal were all clean.

---

## Summary Table

| ID | Severity | File | Issue |
|----|----------|------|-------|
| BUG-1 | 🔴 Critical | `GameClient.ts:49` | `showTowerInspector` never called — inspector unreachable |
| BUG-2 | 🔴 Critical | `HudScene.ts:1029` | Targeting mode changes not sent to server |
| BUG-3 | 🟡 Medium | `GameSimulation.ts:107` | No phase guard on `upgradeTower` |
| BUG-4 | 🟡 Medium | `GameSimulation.ts:144` | `setTargeting` missing ownership check |
| QUALITY-1 | 🟠 Minor | `TowerSystem.ts:32` | Dead `towerInvestment` Map declaration |
| QUALITY-2 | 🟠 Minor | `TowerInspector.ts:6` | `TargetingMode` duplicated from shared |
| QUALITY-3 | 🟠 Minor | `TowerInspector.ts:368` | `applyDelta` reimplemented with different semantics |
| QUALITY-4 | 🟠 Minor | `NetworkManager.ts` | `tower_upgraded` server event silently dropped |
| QUALITY-5 | 🟠 Minor | `TowerInspector.ts:446` | Unused `getContainer()`/`getTargetingMode()` methods |
| QUALITY-6 | 🟠 Minor | `GameScene.ts:675` | Fragile inline type cast for gameClient |
| TEST-1 | 🟠 Gap | `GameSimulation.ts:144` | `setTargeting` has zero tests |
| TEST-2 | 🟠 Gap | `GameSimulation.upgrade.test.ts` | No phase guard tests for upgradeTower |
| TEST-3 | 🟠 Gap | `TowerInspector.ts` | No unit tests for stat computation / applyDelta |

---

## Recommended Fix Priority for Wave 3

1. **BUG-1** — Wire `showTowerInspector` in `GameClient.ts` (required for any Wave 2B work)
2. **BUG-2** — Add `setTargeting` to `NetworkManager`/`GameClient`, fire from `onTargetingChange`
3. **BUG-3** — Add phase guard to `upgradeTower` + phase guard tests (TEST-2)
4. **BUG-4** — Add ownership check to `setTargeting` + TEST-1 tests
5. **QUALITY-1** — Remove `towerInvestment` declaration (1-line fix)
6. **QUALITY-2 + QUALITY-3** — Consolidate `TargetingMode` and `applyDelta` into shared utilities

---

*All 168 tests pass. Typecheck clean.*
