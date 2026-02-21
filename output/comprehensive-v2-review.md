# Element Defense V2 — Comprehensive Code Review
*Reviewed: 2026-02-21 by Vulcan (synthesis agent)*
*Branch: `v2` | Baseline: `a11ec30` | Tests: 251 passing*

---

## Executive Summary

The V2 overnight build shipped **significant** new functionality — 30 features across 6 waves, 6,106 lines of new code, 251 tests passing, typecheck clean. The bones are solid. Many features are genuinely well-executed (CombatSystem targeting, SoundPool, ProjectileManager, DeathAnimator, TowerInspector, EnemyInspector, ResultScene). The test coverage on server systems is particularly strong.

However, **2 CRITICAL silent failures** were found that make a core game mechanic completely non-functional at runtime: the entire elemental reaction system (Vaporize, Melt, Freeze, Conflagration) deals zero bonus damage because its results are discarded, and enemy resistances are never stored on `EnemyState` so fire-immune bosses take full fire damage. Both bugs are invisible to the test suite.

Beyond those, **7 high-severity bugs** will be immediately visible to playtesters: TowerInspector locked out during combat, sell-tower ownership bypass, two gold display mismatches, wrong player class shown in HUD during multiplayer, hardcoded range preview radius, and an unguarded `startWave()` that can be called from any game phase.

Wave 6 (architecture refactor) was not meaningfully implemented. Feature 5C (player ownership rings) is half-done. Four entire source files are dead code (~400 lines). The `dev_cheat` endpoint is always enabled with no production gate.

**Verdict: Do NOT release to playtesters yet.** Fix the 2 CRITICAL and 7 HIGH bugs first (~4-6 hours). The MEDIUM/LOW items follow in a polish pass.

---

## Plan Adherence Checklist (All 30 Features)

### Wave 1: Economy & Core Gameplay

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1A | Tower Selling (50% refund, base cost only) | ✅ PASS | `TOWER_SELL_REFUND_PERCENT = 0.5`, base cost only, tests present |
| 1A | Sell validates ownership | ❌ FAIL | `GameSimulation.sellTower()` ignores `_playerId` — any player can sell anyone's tower |
| 1B | Kill bounty gold | ✅ PASS | Correctly wired via `bountyGold` in wave configs, 5 test cases |
| 1B | Wave completion bonus | ⚠️ PARTIAL | Server awards `(40+10×wave)×playerCount`; plan spec said `wave×10+20`; no `wave_completed` event emitted |
| 1C | Mid-wave tower placement (server) | ✅ PASS | `phase === 'prep' \|\| 'combat'` guard correct, 4 tests |
| 1C | Mid-wave tower placement (client UI) | ✅ PASS | TowerPanel interactive during combat |
| 1D | Variable HP drain by enemy type | ✅ PASS | `ENEMY_BASE_DAMAGE` record correct (grunt=1, tank=3, boss=10), 6 tests |
| 1E | Sell tower client UI | ✅ PASS | Sell button, refund text, `tower_sold` event handling present |
| 1F | Audio pooling (max 4 per category) | ✅ PASS | SoundPool correctly implements `1/√N` normalization, 13 tests |

### Wave 2: Tower Info & Targeting

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 2A | Tower tooltip on hover | ✅ PASS | Tooltip.ts exists, reusable, shows stats + roles |
| 2B | Tower inspector panel | ⚠️ PARTIAL | Inspector exists and works, but only opens during **prep phase** — regression during combat |
| 2C | Per-tower targeting (all 5 modes) | ✅ PASS | `first`/`last`/`strongest`/`weakest`/`closest` all implemented correctly in CombatSystem |
| 2C | `set_targeting` ownership validation | ❌ FAIL | `GameSimulation.setTargeting()` ignores `_playerId` — any player can retarget anyone's tower |
| 2D | Tower upgrades (delta application) | ✅ PASS | Deltas applied dynamically via `getEffectiveStat()` on each tick; `+X`, `*-X`, nested `onHit.N.prop` all working |

### Wave 3: Projectiles & Visual Systems

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 3A | Projectile system | ✅ PASS | `tower_fired` event emitted by server, ProjectileManager handles on client, object pool present |
| 3B | Enemy death animations | ✅ PASS | White flash + fade out in DeathAnimator.ts |
| 3C | Tower attack animations | ✅ PASS | TowerAnimator.ts: scale pulse + element tint on `tower_fired` |
| 3D | Enemy stat inspector | ✅ PASS | EnemyInspector.ts: HP bar, speed, statuses, follows enemy, auto-dismisses on death |

### Wave 4: Map Expansion & Sprites

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 4A | Expanded 32×24 map | ✅ PASS | Width=32, height=24 confirmed; 18 waypoints (exceeds 15 minimum); 14 build zones (exceeds 12 minimum) |
| 4A | Path crosses itself (crossroads) | ✅ PASS | WP6 and WP10 both at (14, 9) — intentional crossroads design |
| 4A | Decorative tiles | ✅ PASS | Trees, rocks, bushes scattered across map data |
| 4B | Unique tower sprites | ✅ PASS | Manifest has distinct entries per tower type with element-specific sprite assignments |
| 4C | Creep sprite variants | ✅ PASS | Per enemy-type sprites in manifest; boss glow ring, invisible alpha pulse, walk animations |

### Wave 5: UI Polish & Multiplayer

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 5A | Wave announcement banner v2 | ✅ PASS | Enemy icons + counts, telegraph text, gold bonus preview, slide-in/out animation |
| 5A | Wave banner gold formula | ❌ FAIL | Banner shows `wave×10+20`; server awards `(40+10×wave)×playerCount` — mismatched |
| 5B | Victory & defeat screens | ✅ PASS | ResultScene.ts: stats summary, MVP tower, Play Again button |
| 5C | Player tower ownership (TowerInspector) | ✅ PASS | Inspector shows "Owned by: [PlayerName]" |
| 5C | Player tower indicators (rings) | ❌ FAIL | **No colored ring drawn on tower sprites.** TowerVisual interface has no `ownerRing` field. Feature half-done. |
| 5D | Chat system | ✅ PASS | DOM input, last 5 messages overlay, sender name shown |
| 5D | Ping system | ✅ PASS | Right-click → `ping_marker` event → pulsing ring on all clients for 3s |

### Wave 6: Architecture & CI

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 6A | Single source of truth refactor | ❌ FAIL | GameScene still has `sync-state` event bus listener. No fine-grained `gold-changed`/`hp-changed`/`wave-changed` events on GameClient. HudScene maintains `lastKnownState` (push model preserved). |
| 6B | Asset manifest validator script | ⚠️ PARTIAL | `scripts/validate-assets.ts` exists and is functional, but NOT added to `package.json` as `validate-assets` script, NOT wired into `pnpm lint` via turbo, NO unit tests for the script |

---

## Bugs (Severity-Ranked)

### 🔴 CRITICAL — Silent System Failure (No Error, Wrong Behavior)

#### BUG-00a: Entire Elemental Reaction System Is Dead at Runtime
**File:** `packages/server/src/game/GameSimulation.ts` (~line 240)
**Severity:** CRITICAL
**Description:** `reactionSystem.checkReaction()` is called but its return value is **completely discarded**:

```typescript
// Current (BROKEN):
this.reactionSystem.checkReaction(enemy, effect.element, attack.damage);
// ↑ ReactionResult discarded — bonus damage, AOE, and status effects dropped
```

`ReactionResult` carries: bonus `damage`, `aoeRadius`, `applyStatus`, `statusDuration`. None of it is applied. The entire Vaporize, Melt, Freeze, Conflagration, and Overload reaction system deals **zero bonus damage** and applies **no status effects**. Elements still apply their primary on-hit effects (burn, freeze, etc.) but reactions between elements produce nothing.

This is completely invisible to CI — `ReactionSystem.test.ts` tests the pure `checkReaction()` function in isolation, not its integration into the sim. No integration test exercises actual reaction damage.

**Fix:**
```typescript
const reaction = this.reactionSystem.checkReaction(enemy, effect.element, attack.damage);
if (reaction.damage > 0) {
  this.enemySystem.damageEnemy(enemy.instanceId, reaction.damage);
}
if (reaction.aoeRadius > 0) { /* splash reaction damage */ }
if (reaction.applyStatus) { /* apply status to enemy */ }
```

---

#### BUG-00b: Enemy Resistances Never Stored or Applied
**File:** `packages/server/src/game/GameSimulation.ts` (~line 187), `packages/server/src/systems/EnemySystem.ts`
**Severity:** CRITICAL
**Description:** `WaveScheduler.getSpawnEvents()` correctly produces `SpawnEvent` objects that include a `resistances` field (e.g. wave 10's fire-immune boss: `resistances: ['fire']`). But `GameSimulation.tickCombat()` calls:

```typescript
this.enemySystem.spawnEnemy(spawn.enemyType, spawn.hp, spawn.speed, spawn.armor, spawn.tags);
// ↑ resistances never passed — not in the method signature, not on EnemyState
```

`EnemyState` has no `resistances` field at all. Fire-immune bosses take full fire damage. Poison-immune late-wave enemies take full poison damage. The resistance system is spec'd, partially wired, and silently broken.

**Fix:** Add `resistances?: ElementType[]` to `EnemyState`, thread it through `spawnEnemy()`, then check it in `CombatSystem` before applying elemental damage.

---

### 🔴 HIGH — Breaks Multiplayer Immediately

#### BUG-01: TowerInspector Only Opens During Prep Phase
**File:** `packages/client/src/scenes/GameScene.ts:718-742`
**Severity:** HIGH
**Description:** The `placed-tower-clicked` event is only emitted inside `else if (this.currentPhase === 'prep')`. During combat, clicking a placed tower falls through to the generic `else` block, closing any open panels without opening the inspector. This is a direct regression — the spec required inspector to work during both prep and combat phases (Feature 1C introduced mid-wave placement; 2B introduced inspector — together they imply inspect-during-combat must work).

```typescript
// GameScene.ts line 718 — BROKEN:
} else if (this.currentPhase === 'prep') {
  // Check if clicking on a placed tower → show TowerInspector
  // ... only fires in prep
}
```

**Fix:** Move the `getTowerAtTile` check before the `canPlace` guard, so it fires regardless of phase (except lobby/end screens). Or add `'combat'` to the condition: `else if (this.currentPhase === 'prep' || this.currentPhase === 'combat')`.

---

#### BUG-02: sellTower Ownership Not Validated (Multiplayer Exploit)
**File:** `packages/server/src/game/GameSimulation.ts:139`
**Severity:** HIGH
**Description:** `sellTower(_playerId: string, ...)` intentionally discards the player ID. Any player can sell any other player's tower. The spec (1A criterion 4) requires "Selling a tower you don't own returns an error event." In multiplayer, this is an exploit — Player 2 can grief Player 1 by selling all their towers mid-wave.

```typescript
// Current: ownership check SKIPPED
sellTower(_playerId: string, instanceId: string): CommandResult & { goldRefund?: number } {
  const result = this.towerSystem.sellTower(instanceId); // no ownership check!
  ...
}
```

**Fix:** Fetch `tower.ownerId` from `this.towerSystem.getTower(instanceId)` and compare to `_playerId` before proceeding.

---

#### BUG-03: Wave Banner Shows Wrong Gold Bonus
**File:** `packages/client/src/scenes/HudScene.ts:615`
**Severity:** HIGH
**Description:** The wave banner preview uses `wave * 10 + 20` (plan formula). But the server was changed to use `(BASE_WAVE_BONUS + WAVE_BONUS_SCALING * wave) * playerCount = (40 + 10×wave) × playerCount`. 

| Wave | Players | Banner Shows | Server Awards |
|------|---------|--------------|---------------|
| 1 | 1 | 30g | 50g |
| 10 | 1 | 120g | 140g |
| 1 | 2 | 30g | 100g |
| 10 | 4 | 120g | 560g |

In multiplayer, this discrepancy becomes massive. Players see "Wave 10 bonus: +120g" but receive 560g with 4 players. This erodes trust in the UI.

**Fix:** Update `HudScene.showWaveBanner()` to compute `(40 + 10 * wave) * playerCount` matching `EconomySystem.addWaveBonus()`. Pass the player count from `this.lastKnownState.players`.

---

#### BUG-04: Post-Wave Gold Popup Hardcoded at 50g
**File:** `packages/client/src/scenes/HudScene.ts:981`
**Severity:** HIGH
**Description:** `const bonus = 50; // standard wave-clear bonus` is hardcoded. Additionally, the `wave_completed` event is defined in shared types but **the server never emits it**. The popup is triggered by phase transition to `prep`, not by any actual gold award data. The popup will show "+50 gold 💰" regardless of wave or player count.

**Fix (two parts):**
1. In `GameSimulation.ts`, after `this.economy.addWaveBonus(...)`, emit a `wave_completed` event with the actual `goldReward` value.
2. In `HudScene.ts`, listen for `wave_completed` event and use the actual `goldReward` field.

---

### 🟠 MEDIUM — Incorrect Behavior, Not an Immediate Crash

#### BUG-05: setTargeting Has No Ownership Validation
**File:** `packages/server/src/game/GameSimulation.ts:152`
**Severity:** MEDIUM
**Description:** Like BUG-02, `setTargeting(_playerId, ...)` discards player ID. Any player can retarget any tower. Less severe than selling (no gold impact), but still a multiplayer UX issue.

---

#### BUG-06: Support Tower (amplifier_tower) Fires Every Tick
**File:** `packages/server/src/systems/CombatSystem.ts:144-146` + `packages/shared/src/data/towers.ts`
**Severity:** MEDIUM
**Description:** `amplifier_tower` has `attackPeriodSec: 0`. In `canFire()`:
```typescript
const ticksBetweenAttacks = Math.floor(0 * TICK_RATE); // = 0
return currentTick - tower.lastAttackTick >= 0; // always true!
```
Every game tick (20/sec) the amplifier calls `processAttack`, finds a target if any enemies are in range, and emits a `tower_fired` event. With 4 amplifiers placed, that's 80 spurious `tower_fired` events/second — triggering 80 projectile animations on the client. Performance hit + visual noise.

**Fix:** Add a guard in `canFire` or `processAttack` to skip towers with `attackPeriodSec === 0` or `baseDamage === 0`.

---

#### BUG-07: Dead Code — `towerInvestment` Map in TowerSystem
**File:** `packages/server/src/systems/TowerSystem.ts:32`
**Severity:** LOW
**Description:** `private towerInvestment: Map<string, number> = new Map();` is declared but never read or written. This was present in the original spec review and was not cleaned up.

---

#### BUG-08: `wave_completed` ServerEvent Never Emitted
**File:** `packages/shared/src/index.ts:262`, `packages/server/src/game/GameSimulation.ts:283-292`
**Severity:** MEDIUM
**Description:** `ServerEvent` union includes `{ type: 'wave_completed'; wave: number; goldReward: number }`. The spec explicitly required this event. The server awards wave bonus gold but silently — no event is emitted. Client cannot display accurate gold amounts. Coupled with BUG-04, this creates a silent incorrect display.

---

#### BUG-09: Player Tower Ownership Rings Not Rendered
**File:** `packages/client/src/scenes/GameScene.ts` — missing
**Severity:** MEDIUM
**Description:** Feature 5C spec: "Placed towers show a colored ring/dot at base matching owner." The `TowerVisual` interface has no `ownerRing` field. No `Graphics` circle is drawn around towers indicating player ownership. `TowerInspector` does show the owner name, so the data is available — just never rendered visually on the map. Half the feature is implemented; the visual indicator is missing entirely.

**Fix:** In the tower placement rendering code, draw a `Phaser.GameObjects.Graphics` circle at the tower's world position, using a per-player color map: `{ p1: 0x4488ff, p2: 0xff4444, p3: 0x44cc44, p4: 0xffcc00 }`.

---

#### BUG-10: `caster` Enemy Type Defined but Never Used
**File:** `packages/shared/src/index.ts:71`
**Severity:** LOW
**Description:** `EnemyType` includes `'caster'`. `ENEMY_BASE_DAMAGE` has an entry for it (2 HP drain). But no wave config spawns `caster` enemies. HudScene banner icons include `caster: '🧙'`. It's a dead type cluttering the type union.

---

#### BUG-11: Debug `console.log` Statements Left in Production Server
**File:** `packages/server/src/game/GameSimulation.ts:166,268,279`
**Severity:** LOW
**Description:** Three `[DEBUG]` console.log lines remain in production GameSimulation.ts. These log on every wave start and every enemy leak. In a 20-wave game with even 5 enemies leaking, that's 25+ debug log lines per session.

---

#### BUG-23: `startWave()` Has No Phase Guard
**File:** `packages/server/src/game/GameSimulation.ts`, `packages/server/src/index.ts`
**Severity:** HIGH
**Description:** `startWave()` only checks `!this.waveScheduler.hasMoreWaves()` — no check for current phase. A client can send `start_wave` from `lobby`, `defeat`, or `victory` and silently force the game into `combat` without proper game initialization. Compounded by the fact that `index.ts` always returns `{ ok: true }` for this command even when it does nothing.

**Fix:** Guard: `if (this.room.state.phase !== 'prep') return;` at top of `startWave()`.

---

#### BUG-24: `tower_upgraded` Event Only Sent to Requestor, Not Broadcast
**File:** `packages/server/src/index.ts`
**Severity:** MEDIUM
**Description:**
```typescript
socket.emit('event', { type: 'tower_upgraded', instanceId, newTier }); // single client
// Should be:
io.emit('event', { type: 'tower_upgraded', instanceId, newTier }); // all clients
```
Other players see the correct tier in the next snapshot but miss any client-side upgrade animation/sound that listens for this event.

---

#### BUG-25: WaveScheduler Multi-Group Spawn Events Not Sorted
**File:** `packages/server/src/systems/WaveScheduler.ts`
**Severity:** MEDIUM (currently dormant, future bomb)
**Description:** When a wave config has multiple enemy groups, spawn events are appended group-by-group: `[A:0, A:0.5, A:1, B:0, B:0.3, B:0.6]`. But `GameSimulation.tickCombat()` treats the spawn queue as sorted (`while (queue[0].spawnAtSec <= elapsed)`). Group B's `t=0` enemy is at queue index 3 — it won't spawn until all of group A's enemies are dequeued. All current wave configs appear to use single groups, so this is dormant but will silently break the moment anyone adds a wave with two simultaneous enemy types.

**Fix:** `.sort((a, b) => a.spawnAtSec - b.spawnAtSec)` at the end of `getSpawnEvents()`.

---

#### BUG-26: ReactionSystem Constructor Mutates Shared `REACTION_CONFIGS`
**File:** `packages/server/src/systems/ReactionSystem.ts`
**Severity:** MEDIUM
**Description:** `Array.sort()` is in-place. `new ReactionSystem(REACTION_CONFIGS)` sorts the shared exported constant, mutating module-level state. Subsequent test runs that rely on the original order of `REACTION_CONFIGS` may see unexpected behavior.

**Fix:** `this.reactions = [...reactions].sort(...)` — clone before sorting.

---

#### BUG-27: Dead Enemies Never Purged from `EnemySystem.enemies` Map
**File:** `packages/server/src/systems/EnemySystem.ts`
**Severity:** MEDIUM
**Description:** `clearDead()` exists but is **never called** anywhere. Every enemy that dies stays in the `enemies` Map forever. Consequences:
1. `getEnemiesAsRecord()` includes dead enemies in every state snapshot (wasted bandwidth)
2. Memory grows unbounded across 20 waves
3. `aliveCount` calls `getAliveEnemies().length` — O(n) filter over a growing dead pool

---

#### BUG-28: `dev_cheat` Command Not Gated on Environment
**File:** `packages/server/src/index.ts`
**Severity:** MEDIUM
**Description:** `socket.on('dev_cheat', ...)` is always active — any connected client on a production server can grant unlimited gold. Should be gated: `if (process.env.NODE_ENV !== 'production')`.

---

#### BUG-29: Chat Event Channel Mismatch Between Real Server and Integration Test
**File:** `packages/server/src/index.ts` vs `packages/server/src/integration/multiplayer.test.ts`
**Severity:** MEDIUM
**Description:** Production server emits chat as `io.emit('event', { type: 'chat_message', ... })` (on the `'event'` Socket.IO channel). The integration test's mock server emits it on `ioServer.emit('chat', { ... })` (the `'chat'` channel). The integration test passes against its own mock but would fail against the real server.

---

#### BUG-30: No dt Cap in GameLoop — Spike Teleportation
**File:** `packages/server/src/game/GameLoop.ts`
**Severity:** LOW
**Description:** `dt = (now - lastTime) / 1000` is unbounded. A 500ms GC pause → `dt = 0.5`. At `speed × dt`, enemies can teleport through multiple waypoints in one tick. Cap to `Math.min(dt, 0.1)` (2 missed ticks max).

---

#### BUG-31: `startGame()` Can Be Called From `victory`/`defeat` Phases
**File:** `packages/server/src/game/GameSimulation.ts`
**Severity:** LOW
**Description:** `startGame()` guards against `prep` and `combat` re-entry but not `victory`/`defeat`. Calling it from a game-over state re-grants starting gold and resets phase to `prep` without resetting towers, enemies, or wave index — partial re-initialization. Fix: add `victory` and `defeat` to the early-return guard.

---

### 🟡 ARCHITECTURE ISSUES

#### ARCH-01: Wave 6A Single Source of Truth Refactor — Not Implemented
**Files:** `packages/client/src/scenes/GameScene.ts:125`, `packages/client/src/scenes/HudScene.ts:361`
**Severity:** MEDIUM
**Description:** The spec for 6A required:
1. ✅ GameClient as canonical state source (partially — `getLatestState()` exists)
2. ❌ No fine-grained events (`gold-changed`, `hp-changed`, `wave-changed`, `tower-placed`, `tower-removed`, `enemy-killed`) emitted by GameClient
3. ❌ GameScene still registers `this.events.on('sync-state', ...)` listener
4. ❌ HudScene maintains `lastKnownState` local state copy (valid as a cache, but the architecture spec wanted scenes to subscribe to GameClient events, not receive full state pushes)
5. ❌ No integration tests verifying GameClient event flow

The current architecture works but is the old v1 push model. 6A was supposed to make future feature additions cleaner.

---

#### ARCH-02: validate-assets.ts Not Integrated Into CI
**File:** `scripts/validate-assets.ts`, `package.json`
**Severity:** LOW
**Description:** The script exists and is functional, but:
- Not listed in root `package.json` scripts as `validate-assets`
- Not in any package's `package.json` lint script
- Not in `turbo.json` task graph
- No unit tests for the script itself (spec required 2+)

The script runs fine manually via `npx ts-node scripts/validate-assets.ts`, but isn't guarded in CI.

---

## Test Coverage Gaps

### Server Package (159 tests)
Tests are generally strong. Specific gaps:

| Missing Test | Feature | Priority |
|---|---|---|
| Reaction damage actually applied in sim tick (not just `checkReaction()` unit test) | BUG-00a | **CRITICAL** |
| Enemy resistances block elemental damage | BUG-00b | **CRITICAL** |
| `sellTower` with wrong owner rejected | BUG-02 | HIGH |
| `setTargeting` with wrong owner rejected | BUG-05 | MEDIUM |
| Wave completion bonus: exact formula `(40+10×wave)×playerCount` | BUG-04 | HIGH |
| Server emits `wave_completed` event with correct `goldReward` | BUG-08 | HIGH |
| amplifier_tower (`attackPeriodSec=0`) doesn't spam `tower_fired` | BUG-06 | MEDIUM |
| Victory triggers on wave 20 completion | 5B | MEDIUM |
| Defeat triggers when `baseHp <= 0` | 5B | MEDIUM |
| Chat command emits `chat_message` server event | 5D | LOW |
| Ping command emits `ping_marker` server event | 5D | LOW |

**🔴 Critical test quality issue — EconomySystem wave bonus:**
```typescript
// Current (useless assertion):
economy.addWaveBonus(5, 3);
expect(economy.state.gold).toBeGreaterThan(0); // passes for ANY positive value
```
The test would pass whether the formula is correct, 10× too high, or returns 1. Should be:
```typescript
expect(economy.state.gold).toBe((40 + 10 * 5) * 3); // = 270 — exact formula
```

**🔴 Stale tower config in tower-fired tests:**
`GameSimulation.tower-fired.test.ts` places `'fire_turret'` which does **not exist** in `TOWER_CONFIGS`. The element field assertion is guarded by `if (event?.type === 'tower_fired')` — since the tower never fires (unknown config), the assertion never executes. The test passes vacuously and covers nothing. Fix: use `'flame_spire'` (actual fire-class tower).

**🟡 GameLoop real-time flakiness:**
`GameLoop.test.ts` uses `setTimeout(resolve, 110)` expecting ≥2 tick callbacks. Under CI load, this can fail intermittently. Fix: `vi.useFakeTimers()`.

**🟡 StateInterpolator under-tested:**
Only 2 tests for a critical networking component. Missing: entity disappears between snapshots, timestamps out of order, interpolation clamped to [0,1], multiple entities simultaneously.

### Client Package (33 tests)
The client has the thinnest test coverage — only 3 test files, none for scenes/UI components. All visual features are untested by definition, but some client logic can be unit-tested:

| Missing Test | Feature | Priority |
|---|---|---|
| TowerInspector opens during combat phase | BUG-01 | HIGH |
| Post-wave gold popup uses actual `goldReward` (not hardcoded) | BUG-04 | HIGH |
| Wave banner gold formula matches server formula | BUG-03 | HIGH |
| Player ownership rings rendered per tower | BUG-09 | MEDIUM |
| HudScene.showPostWaveGoldBonus uses event data | BUG-04 | MEDIUM |
| ResultScene shows correct victory/defeat based on phase | 5B | MEDIUM |
| Chat input properly disabled when closed | 5D | LOW |

### Shared Package (59 tests)
Good coverage for data validation. Gap:

| Missing Test | Feature | Priority |
|---|---|---|
| `caster` type documented as unused / removed from EnemyType | BUG-10 | LOW |
| Map path doesn't overlap build zones (full path cell expansion) | 4A | LOW |

### Integration Tests (13 tests)
The integration suite tests multiplayer basics well. Chat is covered (c1 sends → c2 receives). Gaps:

| Missing Test | Feature | Priority |
|---|---|---|
| Player 2 cannot sell Player 1's tower (ownership enforcement) | BUG-02 | HIGH |
| Player 2 cannot retarget Player 1's tower | BUG-05 | MEDIUM |
| `wave_completed` event received by client on wave clear | BUG-08 | MEDIUM |
| Ping broadcast: `ping_marker` event received by all clients | 5D | LOW |
| Wave bonus amount correct in multi-player game (2 players → 2× gold) | BUG-03 | HIGH |

---

## Architecture & Refactor Recommendations

### 0. Wire Reaction Results Into GameSimulation (CRITICAL)
The one-line fix:
```typescript
// In GameSimulation.ts tickCombat(), currently:
this.reactionSystem.checkReaction(enemy, effect.element, attack.damage);

// Fix: actually use the result
const reaction = this.reactionSystem.checkReaction(enemy, effect.element, attack.damage);
if (reaction.damage > 0) this.enemySystem.damageEnemy(enemy.instanceId, reaction.damage);
if (reaction.applyStatus) enemy.statuses.push({ type: reaction.applyStatus, remainingSec: reaction.statusDuration });
// AOE reaction damage handled similarly
```

Add an integration test: place two elements' towers, trigger a reaction, assert bonus damage dealt.

### 0b. Thread Enemy Resistances Through to EnemyState (CRITICAL)
1. Add `resistances?: ElementType[]` to `EnemyState` in `packages/shared/src/index.ts`
2. Add `resistances` parameter to `EnemySystem.spawnEnemy()`
3. Pass `spawn.resistances` in `GameSimulation.tickCombat()` 
4. In `CombatSystem.processAttack()`, check `target.resistances?.includes(towerElement)` before applying elemental damage

### 1. Kill the `sync-state` Bus (6A followthrough)
`GameScene.ts:125` registers `this.events.on('sync-state', ...)`. This was supposed to be removed in 6A. GameClient already calls `gameScene.syncState(state)` directly on snapshots — the event bus listener is redundant dead code. Remove it.

### 2. Emit `wave_completed` from GameSimulation
`GameSimulation.tick()` calls `this.economy.addWaveBonus()` but never pushes a `wave_completed` event. The shared type already defines this event. One line fix:
```typescript
const goldReward = (40 + 10 * this.waveScheduler.currentWave) * this.room.playerCount;
this.economy.addWaveBonus(this.waveScheduler.currentWave, this.room.playerCount);
this.pendingEvents.push({ type: 'wave_completed', wave: this.waveScheduler.currentWave, goldReward });
```

### 3. Unify Wave Bonus Formula
Either update EconomySystem to match the spec (`wave*10+20`) or update the spec/banner to match EconomySystem (`(40+10*wave)*playerCount`). The current state has both, disagreeing. Given the playerCount scaling is a good multiplayer design, keep the server formula and update the client banner.

### 4. Guard Support Towers in CombatSystem
```typescript
canFire(tower: TowerState, currentTick: number): boolean {
  const attackPeriod = this.getEffectiveStat(tower, 'attackPeriodSec');
  if (attackPeriod === 0) return false; // support towers never "fire"
  ...
}
```

### 5. Add ownership parameter to TowerSystem.sellTower
```typescript
sellTower(instanceId: string, requestingOwnerId?: string): SellResult {
  const tower = this.towers.get(instanceId);
  if (!tower) return { ok: false, reason: 'Tower not found' };
  if (requestingOwnerId && tower.ownerId !== requestingOwnerId) {
    return { ok: false, reason: 'You do not own this tower' };
  }
  ...
}
```

### 6. EconomySystem Test Precision
Replace weak `toBeGreaterThan(0)` assertion with exact value check:
```typescript
it('adds wave completion bonus: formula (40 + 10*wave) * playerCount', () => {
  economy.addWaveBonus(5, 3);
  expect(economy.state.gold).toBe((40 + 10 * 5) * 3); // = 270
});
```

### 11. Fix the Ghost `fire_turret` Test
In `GameSimulation.tower-fired.test.ts`, replace `'fire_turret'` (nonexistent) with `'flame_spire'` (real fire-class tower). The current test passes vacuously — the element assertion never runs because the tower never fires.
```typescript
// Before: sim.placeTower('p1', 'fire_turret', 3, 5);
sim.placeTower('p1', 'flame_spire', 3, 5); // real fire tower
// Now the element assertion actually executes:
expect(event.element).toBe('fire');
```

### 12. GameLoop Determinism
Replace real-time `setTimeout` with `vi.useFakeTimers()` to eliminate CI flakiness risk.

### 13. Sort WaveScheduler Spawn Queue
```typescript
// WaveScheduler.ts — at end of getSpawnEvents():
return events.sort((a, b) => a.spawnAtSec - b.spawnAtSec);
```

### 14. ReactionSystem Clone Before Sort
```typescript
this.reactions = [...reactions].sort(...); // not reactions.sort(...)
```

### 15. Call `clearDead()` on Each Tick
```typescript
// GameSimulation.tickCombat(), after processing attacks:
this.enemySystem.clearDead();
```

### 16. Broadcast `tower_upgraded` to All Clients
```typescript
// index.ts: socket.emit → io.emit
io.emit('event', { type: 'tower_upgraded', instanceId, newTier });
```

### 17. Gate `dev_cheat` on Environment
```typescript
socket.on('dev_cheat', (cheat, ack) => {
  if (process.env.NODE_ENV === 'production') { ack({ ok: false }); return; }
  ...
});
```

### 7. Wire validate-assets.ts Into CI
Add to root `package.json`:
```json
"validate-assets": "ts-node scripts/validate-assets.ts"
```
Add to turbo.json `lint` task. Add 2 unit tests.

### 8. Clean Up Debug Logs
Remove or guard behind `process.env.DEBUG` the three `[DEBUG]` console.log calls in GameSimulation.ts.

### 9. Remove Dead Code
- `towerInvestment: Map<string, number>` in TowerSystem.ts
- Consider removing `caster` from `EnemyType` or documenting it as reserved for future use

### 10. TowerInspector Phase Guard Fix (BUG-01)
Change GameScene.ts pointer-down handler to allow inspect in both prep and combat:
```typescript
} else if (this.currentPhase === 'prep' || this.currentPhase === 'combat') {
  const towerAtTile = this.getTowerAtTile(tileX, tileY);
  if (towerAtTile) { ... emit 'placed-tower-clicked' ... }
}
```

---

## Final Verdict

### What Shipped Correctly (Strong Work)

- **CombatSystem**: All 5 targeting modes correct, upgrade delta application elegant, onHit effects with nested dot-path deltas — this is genuinely good code.
- **SoundPool**: Clean pure-TS pooling logic with 1/√N normalization, 13 solid tests.
- **ProjectileManager**: 18 tests, proper object pooling, handles 120 simultaneous projectiles.
- **TowerInspector / EnemyInspector**: Feature-complete, well-structured Phaser containers.
- **ResultScene**: Stats summary, MVP tower computation, play-again flow — solid.
- **Map**: 32×24 with 18 waypoints, 14 build zones, crossroads design — meets all spec requirements.
- **Wave configs**: All 20 waves defined with enemy groups, telegraph text, bounty gold.
- **Server tests**: Integration with Socket.IO, placement phase guards, kill bounty, HP drain, upgrades — all well covered with specific assertions.

### What's Broken / Missing

| # | Issue | Severity | Playtester Impact |
|---|-------|----------|-------------------|
| BUG-00a | Entire elemental reaction system dead at runtime | **CRITICAL** | No Vaporize/Freeze/Melt/etc — core game mechanic missing |
| BUG-00b | Enemy resistances never stored or applied | **CRITICAL** | Fire-immune bosses take full fire damage |
| BUG-01 | TowerInspector dead during combat | HIGH | Can't manage towers during waves |
| BUG-02 | Sell tower no ownership check | HIGH | Multiplayer griefing exploit |
| BUG-03 | Wave banner shows wrong gold | HIGH | UI lies every wave; multiplayer is 3-10× wrong |
| BUG-04 | Gold popup hardcoded 50g | HIGH | UI lies every wave |
| BUG-12 | Wrong player class shown in HUD (multiplayer) | HIGH | HUD shows wrong element class to non-host players |
| BUG-14 | Range preview hardcoded to 3 tiles | HIGH | Wrong for every non-arrow tower |
| BUG-23 | `startWave()` no phase guard | HIGH | Client can force combat from lobby/defeat/victory |
| BUG-05 | setTargeting no ownership | MEDIUM | Multiplayer abuse vector |
| BUG-06 | Support tower fires 20×/sec | MEDIUM | Performance + visual noise |
| BUG-09 | Player rings not rendered | MEDIUM | Feature 5C half-done |
| BUG-08 | `wave_completed` never emitted | MEDIUM | Gold popup wrong, can't hook event |
| BUG-24 | `tower_upgraded` not broadcast | MEDIUM | Other players miss upgrade animations |
| BUG-25 | Wave spawns unsorted (multi-group) | MEDIUM | Future bomb in wave design |
| BUG-27 | Dead enemies never purged | MEDIUM | Memory leak + bandwidth waste |
| BUG-28 | `dev_cheat` always enabled | MEDIUM | Infinite gold exploit on any server |
| BUG-29 | Chat channel mismatch (test vs real server) | MEDIUM | Integration test silently wrong |
| BUG-32 | `EnemyStatus.type` is `string` not union | HIGH | Typo in status name = silent no-op |
| BUG-33 | 4 of 8 `ReactionType` values have no config | HIGH | Lookup returns `undefined` silently |
| BUG-34 | `OnHitEffect`, `PassiveEffect`, `ReactionEffect` use `string` | MEDIUM | Same silent-failure risk |
| BUG-35 | Decoration at (0,4) on a path tile | MEDIUM | Bush clips through enemies |
| ARCH-01 | 6A not done | MEDIUM | Tech debt |
| ARCH-02 | validate-assets not in CI | LOW | Manifest drift risk |

**Minimum required to ship to playtesters:**
1. **BUG-00a** — Apply reaction results in `GameSimulation.tickCombat()` (~20 lines)
2. **BUG-00b** — Thread `resistances` through `EnemyState` and `spawnEnemy()` (~15 lines)
3. **BUG-01** — Fix TowerInspector phase guard in `GameScene.ts` (2-line change)
4. **BUG-02** — Add ownership check to `sellTower()` (4-line change)
5. **BUG-03 + BUG-04 + BUG-08** — Emit `wave_completed` with actual gold, fix banner + popup (~20 lines)
6. **BUG-12** — Fix local player identification in HudScene (5-line change)
7. **BUG-14** — Fix hardcoded range preview radius (3-line change)
8. **BUG-23** — Add phase guard to `startWave()` (1-line change)

Total estimated fix time: 4-6 hours for one developer. Then re-run tests and typecheck.

**Full bug count:**
- CRITICAL: BUG-00a, BUG-00b (2 bugs — reaction system + resistances silently broken)
- HIGH: BUG-01 through BUG-04, BUG-12, BUG-14, BUG-23, BUG-32, BUG-33 (9 bugs)
- MEDIUM: BUG-05 through BUG-11, BUG-13, BUG-15 through BUG-22, BUG-24 through BUG-31, BUG-34, BUG-35 (20 bugs)
- LOW: Map comment wrong, dead type exports, unused `lumber`, `bountyGold` test too weak, ~12 other minor items
- DEAD CODE FILES: GhostTower.ts, HealthBar.ts, StatusIndicator.ts, ProjectilePool.ts (4 files, ~400 lines)

---

## Shared Package — Supplemental Findings (from parallel review agent)

### Type System Gaps

#### BUG-32: `EnemyStatus.type` Is `string` — Typos Fail Silently
**File:** `packages/shared/src/index.ts:80`
**Severity:** HIGH
```typescript
// Current:
export interface EnemyStatus { type: string; /* 'soaked' | 'burning' | 'cold' | 'frozen' | 'toxin' */ }
// Fix:
export interface EnemyStatus { type: 'soaked' | 'burning' | 'cold' | 'frozen' | 'toxin'; }
```
The comment spells out exactly what the union should be. Runtime status checks compare by string equality — a typo anywhere in the codebase (`"buring"`, `"Frozen"`) applies no status and produces no error. This is especially dangerous given BUG-00a (reactions are supposed to apply statuses).

---

#### BUG-33: `ReactionType` Union Has 4 Unimplemented Members
**File:** `packages/shared/src/index.ts:95–104`, `packages/shared/src/data/reactions.ts`
**Severity:** HIGH
```typescript
export type ReactionType = 'vaporize' | 'melt' | 'steam_burst' | 'freeze'
                         | 'shatter' | 'blight' | 'frostburn' | 'conflagration';
```
`REACTION_CONFIGS` only implements 4: `vaporize`, `freeze`, `melt`, `conflagration`. The four others — `steam_burst`, `shatter`, `blight`, `frostburn` — have no config entry. Any lookup by those values returns `undefined`. The type union implies they're valid and implemented; they're not. Remove them from the union or add stub configs with a `TODO` comment.

---

#### BUG-34: Three More Types Using `string` Instead of Unions
**File:** `packages/shared/src/index.ts`
**Severity:** MEDIUM

| Interface | Field | Actual Values |
|-----------|-------|---------------|
| `OnHitEffect` | `type: string` | `'dot' \| 'status' \| 'pushback'` |
| `PassiveEffect` | `type: string` | `'burn_on_hit' \| 'soaked_on_hit' \| 'cold_on_hit' \| 'toxin_on_hit'` |
| `ReactionEffect` | `type: string` | `'damage_multiplier' \| 'apply_status' \| 'aoe_burst'` |

Same silent-failure risk as BUG-32.

---

### Map Data Bug

#### BUG-35: Decoration at (0,4) Placed on a Path Tile
**File:** `packages/shared/src/data/maps.ts`
**Severity:** MEDIUM
```typescript
{ x: 0, y: 4, type: 'bush' }, // ← overlaps path tile (0,4) on segment WP0→WP1
```
The entry segment runs from WP0 `(-1,4)` to WP1 `(2,4)` along `y=4`, so tiles `(0,4)` and `(1,4)` are on the path. A bush rendered there will clip through enemies walking past it. Move to `(0,3)` or `(0,5)`.

The `maps.test.ts` overlap test misses this because it **only checks waypoint coordinates** (18 tiles), not the full 149 interpolated path tiles. The more thorough path-walk in `data.test.ts` also misses it because decorations aren't checked there. No existing test catches this.

---

### Additional Shared Type Issues (LOW)

- **Map header comment is wrong**: Comment says "16 waypoints (WP0–WP15)" but there are 18 waypoints. The inline numbering descriptions don't match actual array indices either. Misleading for anyone editing the map.
- **`EnemyConfig` / `EnemyAbility` are exported types with no backing data** — `ENEMY_CONFIGS` doesn't exist. Enemy stats are defined inline per wave group. These types are dead exports.
- **`EconomyState.lumber` is unused** — initialized to `0`, never referenced in any wave config, tower config, or event. Either wire it in or remove it.
- **`spawnIntervalSec: 0` for boss groups** — correct (count=1, nothing to interleave) but any spawner naively dividing by this will get NaN. Needs a guard or documentation.
- **`bountyGold >= 0` test too permissive** — the test allows `0` bounty which would silently break economy balance. Should be `> 0`.
- **`maps.test.ts` overlap test only checks waypoint tiles** — should walk full path segments (149 tiles, not 18) to match the stronger coverage in `data.test.ts`.
- **No test verifies decorations don't overlap path tiles** — BUG-35 would be caught automatically by such a test.

---

## Client Package — Supplemental Findings (from parallel review agent)

### Dead Classes (3 entire files that ship zero value)

| File | Status | Notes |
|------|--------|-------|
| `GhostTower.ts` | 🔴 DEAD CODE | Never instantiated anywhere. GameScene draws ghost inline. |
| `HealthBar.ts` | 🔴 DEAD CODE | Never instantiated. GameScene draws HP bars inline via `drawHpBar()`. |
| `StatusIndicator.ts` | 🔴 DEAD CODE | Never instantiated. No status indicators shown in-game at all. |
| `ProjectilePool.ts` | 🔴 DEAD CODE | Never imported. `ProjectileManager.ts` is the actual pooling implementation. |

These four files add ~300 lines to the bundle and create confusion about what's actually wired.

---

### Additional HIGH Severity — Client

#### BUG-12: Wrong Player Identified in HudScene Multiplayer
**File:** `packages/client/src/scenes/HudScene.ts:updatePlayerClass()`  
**Severity:** HIGH  
**Description:** `updatePlayerClass` finds the local player by searching for `p.connected === true` and taking the first match. In multiplayer all players are connected — the first connected player is arbitrarily selected, not the local player. The wrong player's element class is shown in the HUD header to all non-host players.

**Fix:** Store the local socket ID on HudScene during `syncState`, then compare `p.id === localSocketId`.

---

#### BUG-13: `shot-fired` Event Registered but Never Emitted
**File:** `packages/client/src/scenes/GameScene.ts`  
**Severity:** MEDIUM  
**Description:** `GameScene` registers a listener for `'shot-fired'` in `init()`. Nothing in the codebase emits `'shot-fired'`. The handler (`handleShotFired`) is dead code. This is a vestigial listener from pre-v2 projectile code that was superseded by `tower_fired` events.

---

#### BUG-14: Range Preview Circle Hardcoded to 3 Tiles
**File:** `packages/client/src/scenes/GameScene.ts`  
**Severity:** HIGH  
**Description:** The ghost-placement range preview circle is drawn at `3 * TILE_SIZE` radius regardless of the selected tower config. `arrow_tower` has range 3 (correct by coincidence), `ballista` has range 4, `fire_cannon` has range 2. Players see an incorrect range circle for every non-default tower type.

**Fix:** Read `TOWER_CONFIGS[this.selectedTowerId]?.range` and use that value for the preview circle radius.

---

### Additional MEDIUM Severity — Client

#### BUG-15: ESC Key Leaks in Phaser Input Registry
**Files:** `TowerInspector.ts`, `EnemyInspector.ts`  
**Description:** Both panels call `escKey.removeAllListeners()` on destroy but do NOT call `scene.input.keyboard.removeKey(escKey)`. The key object persists in Phaser's keyboard manager. After many open/close cycles this accumulates phantom key objects. Fix: call `this.scene.input.keyboard!.removeKey(Phaser.Input.Keyboard.KeyCodes.ESC)` in `destroy()`.

---

#### BUG-16: EnemyInspector Status Badges Never Update
**File:** `packages/client/src/ui/EnemyInspector.ts`  
**Description:** Status badges (burning, frozen, poisoned) are rendered once in `buildPanel()` but `update()` only refreshes the HP bar. If a status expires mid-inspection or a new one is applied, the panel shows stale data for the duration it's open.

---

#### BUG-17: TowerPanel Tooltip Listeners Double-Registered
**File:** `packages/client/src/ui/TowerPanel.ts:refreshAffordability()`  
**Description:** `refreshAffordability()` calls `removeAllListeners()` then re-registers pointerover/pointerout tooltip listeners. However, if the tower was initially affordable, `createTowerItem()` already registered those listeners — so after the first `refreshAffordability()` call they're removed and re-added once (OK), but the click listener is re-added a second time, creating a double-fire on click. Net effect: clicking an affordable tower after a gold change fires the selection handler twice.

---

#### BUG-18: ClassSelectScene Polling Never Times Out
**File:** `packages/client/src/scenes/ClassSelectScene.ts`  
**Description:** `checkGameStart()` uses a repeating time event that polls for `phase === 'prep'`. If the connection drops after the player readies (e.g. server crashes), this loop runs forever. Add a 30-second timeout after which the scene returns to Lobby.

---

#### BUG-19: LobbyScene Transitions on Connection Failure
**File:** `packages/client/src/scenes/LobbyScene.ts`  
**Description:** `handleJoinRequest()` starts the camera fade-out before `gameClient.connect()` resolves. If `connect()` throws, the error is caught and logged, but the scene already began transitioning to ClassSelectScene. Players land on ClassSelectScene with an unconnected client.

---

#### BUG-20: ResultScene Victory Particles Behind Overlay
**File:** `packages/client/src/scenes/ResultScene.ts`  
**Description:** Victory particle circles are set to `depth(1)` but the dim overlay background is at `depth(0)`. Since overlay is added first, this should work. However the static text elements are added after the overlay at depth 0 too — text may appear behind the dimming rect. Verify render order.

---

#### BUG-21: ProjectilePool `_activeCount` Can Go Negative
**File:** `packages/client/src/effects/ProjectileManager.ts`  
**Description:** `release()` guards with `if (!entry.active) return` before decrementing `_activeCount`. But `acquire()` sets `entry.active = true` and increments. If `release()` is called before `acquire()` completes its async tween (possible on very fast kills), the count logic may be off. Low probability but worth a defensive `Math.max(0, this._activeCount - 1)`.

---

#### BUG-22: `TILE_SIZE` Hardcoded in ProjectileManager
**File:** `packages/client/src/effects/ProjectileManager.ts`  
**Description:** `const TILE_SIZE = 64` is hardcoded instead of imported from `@td/shared`. If the shared constant changes, projectile positions will desync from tile rendering. Import from shared.

---

### Additional LOW Severity — Client

- **`TowerPanel.setElementClass()` never called** — panel title always shows `'shared'` default icon, not the player's element class
- **`HudScene.showBaseDamage()` public method, never called** — dead code  
- **`HudScene.showGameOverOverlay()` fully implemented but never called** — replaced by ResultScene, remove it
- **`spawnVictoryParticles()` duplicated** between HudScene and ResultScene  
- **`amplifier_tower` has `attackPeriodSec: 0`** confirmed to cause 20 `tower_fired` events/sec (BUG-06)
- **Boss glow ring stored as `sprite.__bossGlow`** but never cleaned up on boss death — orphaned Phaser object
- **`cloud.speed` accessed via `as unknown as` cast** — repeated anti-pattern, use a typed map
- **Ice projectile renders as right-triangle**, not the intended diamond shape (`fillTriangle` coordinates wrong)
- **`Tooltip.repositionNear` uses world-space coords for what should be screen-space** — tooltip may drift when camera scrolls if tooltip is a world-space object

---

*Review generated from: direct code analysis + 4 parallel subagent reviews (server, client, shared, tests)*
*Commit range: a11ec30..HEAD (44 files changed, 6,106 insertions)*
