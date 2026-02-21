# Wave 3 Code Review — Element Defense V2

**Reviewer:** Vulcan  
**Date:** 2026-02-21  
**Commits reviewed:** `b3a2b57..HEAD` (6 commits: `33e4b3d`, `81710a0`, `fcef07a`, `61da3c4`, `3e0bcb0`, `77f97d5`)  
**Test result:** ✅ 192 tests pass (159 server, 33 client)  
**Typecheck:** ⚠️ Turbo served cached result; see Bug 1 below

---

## CRITICAL

### Bug 1 — HEAD is broken: `77f97d5` deleted renderer files but left `GameScene.ts` importing them

**Commit:** `77f97d5 chore: remove orphan renderer files`  
**File:** `packages/client/src/scenes/GameScene.ts` (HEAD version)

The current HEAD imports three modules that no longer exist on disk:

```typescript
// packages/client/src/scenes/GameScene.ts @ HEAD (77f97d5)
import { TowerRenderer } from '../renderers/TowerRenderer';  // ❌ deleted
import { EnemyRenderer }  from '../renderers/EnemyRenderer'; // ❌ deleted
import { MapRenderer }    from '../renderers/MapRenderer';   // ❌ deleted
```

`3e0bcb0` introduced the renderers and refactored `GameScene`; `77f97d5` then deleted the renderer files as "orphans" without simultaneously reverting `GameScene.ts`. The Vite build crashes at runtime. `tsc --noEmit` appeared clean because Turbo returned a cached result — the live `tsc` ran against the working tree (which has partial staged fixes), not against HEAD.

**Workaround in progress:** There is a staged change to `GameScene.ts` that reverts to the inlined version with `DeathAnimator` + `ProjectileManager`. It needs to be committed and pushed.

---

## BUGS

### Bug 2 — Double `onTowerFired` registration silently drops the first callback

**File:** `packages/client/src/GameClient.ts` (lines 31–37)  
**Severity:** High — dead event binding, silent failure

```typescript
// GameClient.ts
this.network.onTowerFired((event) => {
  this.gameScene?.events.emit('tower-fired', event);  // ← FIRST registration
});

this.network.onTowerFired((event) => {
  this.gameScene?.events.emit('tower_fired', event);  // ← SECOND registration
});
```

`NetworkManager.onTowerFiredCallback` is a **single slot** (`private onTowerFiredCallback: TowerFiredCallback | null`). The second `onTowerFired()` call overwrites the first. The `'tower-fired'` (hyphen) event is never emitted to the scene.

The code only works by accident: `ProjectileManager.bindEvents()` listens on `'tower_fired'` (underscore), which matches the second registration. But this is fragile and wrong — the first registration is dead code, and the naming inconsistency (`tower-fired` vs `tower_fired`) will confuse anyone who tries to add a `tower-fired` listener later.

**Fix options:**
- Delete the first `onTowerFired` block entirely (it duplicates the second)
- Or change `onTowerFiredCallback` to an array to support multi-subscriber

---

### Bug 3 — `EnemyInspector.update()` never refreshes status effects

**File:** `packages/client/src/ui/EnemyInspector.ts` (lines ~107–120)  
**Severity:** Medium — stale UI data

```typescript
update(enemies: Record<string, EnemyState>): void {
  // ...
  this.hpText.setText(`HP: ${enemy.hp} / ${this.maxHp}`);
  this.redrawHpBar(enemy.hp, this.maxHp);
  // ← statusTexts is NEVER refreshed here
}
```

`buildStatusTexts()` is called once in `buildPanel()` at construction time. The status rows — including `remainingSec` countdown values and stack counts — go stale immediately. A `burning×3 (2.0s)` label will never tick down to `(1.0s)`, and newly applied statuses (e.g., enemy walks through a second reaction) are invisible.

**Fix:** In `update()`, destroy old `statusTexts`, rebuild with current `enemy.statuses`, and re-add to the container.

---

### Bug 4 — `TowerAnimator` is shipped but never wired up (dead code)

**File:** `packages/client/src/effects/TowerAnimator.ts`  
**Severity:** Medium — entire feature silently missing

`TowerAnimator` was added in `fcef07a` and provides `playAttack()` to show a scale-pulse + element-tint flash when a tower fires. It is **never imported or called** anywhere in the committed codebase — not in `GameScene.ts`, not in the working tree. Tower attack animations do not fire.

The `tower_fired` server event flows correctly to `ProjectileManager` (via `bindEvents`), but the corresponding tower sprite animation is never triggered.

**Fix:** In the same handler that calls `projectileManager.fire(data)`, look up the tower sprite and call `towerAnimator.playAttack(sprite, data.element)`.

---

### Bug 5 — `EnemyInspector` is shipped but never instantiated (dead code)

**File:** `packages/client/src/ui/EnemyInspector.ts`  
**Severity:** Medium — entire feature missing at runtime

`EnemyInspector` (334 lines, 3D feature ticket) is never imported or created anywhere in the committed codebase. The intermediate commit `fcef07a` wired it into the old inline `GameScene`, but the subsequent refactoring commits (`3e0bcb0`, `77f97d5`) removed that wiring without moving it into the renderer layer or the working-tree version of `GameScene`.

Clicking an enemy does nothing — no inspector opens.

**Fix:** Instantiate and wire up `EnemyInspector` in `GameScene` (or the appropriate renderer) the same way the intermediate commit `fcef07a` did:
- Set `sprite.setInteractive()` on enemy sprites
- On `pointerdown`, open inspector with that enemy's state
- Call `inspector.update(state.enemies)` each frame
- Call `inspector.destroy()` on dismiss

---

### Bug 6 — `ProjectileManager.acquire(targetId)` ignores its parameter

**File:** `packages/client/src/effects/ProjectileManager.ts` (lines 63–71)  
**Severity:** Low — misleading API

```typescript
acquire(targetId: string): PoolEntry | null {
  const slot = this.pool.find((e) => !e.active);
  if (!slot) return null;
  slot.active = true;
  this._activeCount++;
  return slot;
  // ↑ targetId is accepted but never stored or used anywhere
}
```

The parameter signature implies the pool tracks which target each slot is aimed at (e.g., for deduplication: don't fire two projectiles at the same enemy simultaneously). But `targetId` is silently dropped. The method could be `acquire(): PoolEntry | null` without the parameter, or the slot should store it. As written, concurrent projectiles toward the same target are permitted with no dedup.

---

## What Looks Good

- **`GameSimulation.drainEvents()` / `pendingEvents[]`** — clean drain pattern; no per-frame allocation issues; correctly accumulates events between ticks.
- **`element` extraction logic** — `towerConfig?.class !== 'shared' ? towerConfig?.class : undefined` handles all edge cases correctly (unknown configId → `undefined`, shared class → `undefined`, element class → value).
- **`ProjectileManager` pool semantics** — acquire/release/recycle is correct; pool exhaustion silently drops (not throws); 18 tests validate all paths.
- **`DeathAnimator`** — purely cosmetic, no state coupling; correctly guards `if (flash.active)` before destroy. Good.
- **`TowerAnimator` internal logic** — the anti-stacking `activeTweens` map and scale restoration on `onComplete` are well-designed; just needs a caller.
- **`EnemyInspector` construction** — HP bar redraw, close button, ESC key, and entrance animation are all correct. Just needs to be wired up.
- **`GameSimulation.tower-fired.test.ts`** — 6 tests cover the full event contract including `drainEvents` clearing semantics and element=undefined for shared towers.

---

## Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | 🔴 Critical | `GameScene.ts` @ HEAD | Missing renderer imports — Vite build broken |
| 2 | 🟠 High | `GameClient.ts` | Double `onTowerFired` — first callback silently overwritten |
| 3 | 🟡 Medium | `EnemyInspector.ts` | `update()` never refreshes status effect text |
| 4 | 🟡 Medium | `TowerAnimator.ts` | Never called — tower attack animation absent |
| 5 | 🟡 Medium | `EnemyInspector.ts` | Never instantiated — inspector feature entirely absent |
| 6 | 🟢 Low | `ProjectileManager.ts` | `acquire(targetId)` ignores its parameter |

**Immediate action needed:** Commit the staged `GameScene.ts` fix (or cherry-pick the correct version) to unbreak HEAD before any further development.
