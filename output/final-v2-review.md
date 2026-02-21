# Element Defense V2 — Final Pre-Playtester Review

**Reviewer:** Vulcan (AI Senior Engineer)  
**Date:** 2026-02-21  
**Baseline commit:** `a11ec30`  
**HEAD commit:** `ed490d6`  
**Scope:** 30 features across 6 waves (1A–5D)

---

## Executive Summary

The V2 build is **largely solid** — all 192 tests pass, all packages typecheck clean (verified with `--force`, bypassing stale cache), and the server-side economy, combat, and upgrade systems are well-tested and logically correct. The map redesign, visual systems, and UI panels are impressive in scope for a single sprint.

**There are 3 bugs that must be fixed before playtest**, 1 architectural dead-code issue to clean up, and several lower-priority polish gaps. No game-breaking crashes or data corruption risks were found.

---

## Test & Type Baseline

```
pnpm test:    192 tests / 0 failures  (159 server + 33 client)
pnpm typecheck: 0 errors  (all 3 packages — verified with --force)
```

> **Note:** The initial `pnpm typecheck` showed a cached error (`receiveChatMessage does not exist on HudScene`). That error is stale — the method *is* implemented in HudScene (line ~1089). A `--force` run confirms 0 errors. The turbo cache for the client typecheck task should be invalidated before release.

---

## Bugs — Must Fix Before Playtest

### BUG-1 (Medium) — Wave Banner Shows Incorrect Gold Bonus

**File:** `packages/client/src/scenes/HudScene.ts`, line 615  
**Severity:** Medium — misinformation to players, not a crash

**Actual formula (server):**
```ts
// EconomySystem.ts
const bonus = (BASE_WAVE_BONUS + WAVE_BONUS_SCALING * waveNumber) * playerCount;
// BASE_WAVE_BONUS=40, WAVE_BONUS_SCALING=10
// Wave 1, 1 player → (40 + 10) × 1 = 50g
// Wave 5, 1 player → (40 + 50) × 1 = 90g
// Wave 5, 2 players → 180g
```

**Displayed formula (banner):**
```ts
const goldBonus = wave * 10 + 20; // Wave 1 → 30g, Wave 5 → 70g
```

The banner consistently understates the bonus by 20g at minimum, and ignores player count entirely. Players will notice the UI says "+30g wave bonus" but receive 50g — confusing but not harmful. In multiplayer, the gap is even larger.

**Fix:** Import `BASE_WAVE_BONUS` and `WAVE_BONUS_SCALING` from `@td/shared` and replicate the formula. For player count, read from `lastKnownState.players` object key count.

---

### BUG-2 (Medium) — Post-Wave Gold Popup Hardcoded at 50g

**File:** `packages/client/src/scenes/HudScene.ts`, line 981  
**Severity:** Medium — always wrong for wave 2+ and for multiplayer

```ts
const bonus = 50; // standard wave-clear bonus ← WRONG
```

This hardcoded value is only accurate for wave 1, 1 player. Every other scenario will show a different number than what was actually received.

**Fix:** Same as BUG-1 — derive the display value from the actual formula. Alternatively, the server could emit the awarded bonus in the `post_wave` event and the client can just display what it receives. The server already emits this in the snapshot (gold changes atomically), so `showPostWaveGoldBonus` could compare gold before/after the snapshot transition.

---

### BUG-3 (Low-Medium) — Tower Inspector Inaccessible During Combat Phase

**File:** `packages/client/src/scenes/GameScene.ts`, line 714 (`handleTileClick`)

The tower inspector is only launched in `prep` phase:

```ts
} else if (this.currentPhase === 'prep') {
  const towerAtTile = this.getTowerAtTile(tileX, tileY);
  if (towerAtTile) { /* open inspector */ }
```

But `placeTower` was enabled during combat in feat(1C). Players can build during combat but cannot inspect, upgrade, or sell during combat. This is a minor quality-of-life regression — selling a badly-placed tower during a wave is a core loop action.

**Fix:** Allow inspector in both `prep` and `combat` phases. The server's `sell_tower` and `upgrade_tower` commands already work during combat.

---

## Architecture Issues

### ARCH-1 (Low) — Dead Code: `towerInvestment` Map in TowerSystem

**File:** `packages/server/src/systems/TowerSystem.ts`, line 32

```ts
private towerInvestment: Map<string, number> = new Map(); // ← never read or written
```

This was likely scaffolded for a "refund includes upgrade cost" design that was then simplified to "50% of base cost only." The field is declared but no code ever sets or reads it. It creates a false impression that upgrade costs are tracked for sell refund purposes.

**Fix:** Delete the field. Update the comment on `sellTower` to be explicit: "Refund is 50% of BASE cost only — upgrade investments are not refunded."

---

## Feature Assessment by Area

### Wave 1: Economy

| Feature | Status | Notes |
|---------|--------|-------|
| 1A — Tower sell refund (50% base) | ✅ Correct | Server: `Math.round(baseCost * TOWER_SELL_REFUND_PERCENT)`. Client display matches. `TOWER_SELL_REFUND_PERCENT = 0.5` in shared. |
| 1B — Kill bounty per wave | ✅ Correct | `bountyGold` per kill, per wave config. Splash kills also award bounty. Dead `towerInvestment` field noted above. |
| 1C — Mid-wave tower placement | ✅ Correct | Server gate is on `canBuildInCombat`. Client placement path works. Inspector not openable in combat (BUG-3). |
| 1D — Variable HP drain by enemy type | ✅ Correct | `ENEMY_BASE_DAMAGE` exported from shared: grunt=1, runner=1, tank=3, flyer=2, invisible=2, caster=2, boss=10. Fully tested. |
| 1E — Sell tower client UI | ✅ Correct | Sell panel in HudScene shows refund. GameScene emits correct `placed-tower-clicked` event. |
| 1F — Audio pooling | ✅ Correct | `SoundPool` implemented with 13 tests. AudioManager delegates through pool. |

### Wave 2: Tower Management

| Feature | Status | Notes |
|---------|--------|-------|
| 2A — Tower tooltip on hover | ✅ Correct | `Tooltip.ts` + `TowerPanel.buildTooltipText()` — includes damage, range, ATK speed, splash, on-hit effects, roles. Tooltip persists correctly for unaffordable towers. |
| 2B — Tower Inspector panel | ✅ Correct | `TowerInspector.ts` is comprehensive: name, tier stars, stats comparison, sell refund, upgrade button (greyed if max or unaffordable), targeting mode, ESC key dismiss, slide-in animation. |
| 2C — Targeting modes | ✅ Correct | 5 modes: first, last, strongest, weakest, closest. `CombatSystem.selectTarget()` dispatches correctly. `set_targeting` command wired server→client. |

### Wave 3: Visuals

| Feature | Status | Notes |
|---------|--------|-------|
| 3A — Projectile system | ✅ Correct | `ProjectileManager` pools up to 64 `Graphics` objects. Element-color-coded. Ice uses diamond shape. 18 tests covering pool mechanics, fire, release, `activeCount`. |
| 3B — Death animations | ✅ Correct | `DeathAnimator.playDeath()`: white flash, colored core fade, 2–3 particles. Cosmetic-only, no game state coupling. |
| 3C — Tower attack animations | ✅ Correct | `TowerAnimator.playAttack()`: tint flash + scale pulse (200ms). Tween cancellation prevents stacking. `tower_fired` event properly wired in both GameScene (animation) and ProjectileManager (projectile). |
| 3D — Enemy variants/Inspector | ✅ Correct | `GRUNT_VARIANT_KEYS` + `GRUNT_VARIANT_TINTS` in manifest for 4 grunt skins. `EnemyInspector` shows HP bar, speed, armor, element, status effects on hover. |

### Wave 4: Map

| Feature | Status | Notes |
|---------|--------|-------|
| 4A — 32×24 expanded map | ✅ Correct | `map_01` config: 32 wide × 24 tall, 18 waypoints (WP0–WP17), 14 build zones. All 7 map tests pass. |
| 4B — Crossroads | ✅ Correct | Tile (14,9) is a true crossroads: appears as WP6 (going S) and WP10 (going W). Enemy movement correctly follows linear waypoint-to-waypoint path — no pathfinding needed. Test verifies at least one tile is visited ≥2 times. |
| 4C — Tier indicators | ✅ Correct | Gold dots rendered on tower visual: 1 dot = tier 2, 2 dots = tier 3. Updated on upgrade. `syncTowers` cleanly handles visual updates. |

### Wave 5: UI

| Feature | Status | Notes |
|---------|--------|-------|
| 5A — Wave banner | ⚠️ **Partial** | Slide-in/out animation works. Enemy summary and telegraph text are correct. **Gold bonus preview is wrong** (BUG-1, BUG-2). |
| 5B — Victory/Defeat screens | ✅ Correct | `ResultScene.ts`: full-screen overlay, animated title, stat breakdown (enemies killed, gold earned, towers built, MVP tower), Play Again button, score grade. Launched from `GameClient.launchResultScene()` on `state.phase === 'victory' \| 'defeat'`. |
| 5C — Player tower ownership | ⚠️ Partial | Implemented as **text in the TowerInspector** ("👤 Owned by: PlayerName"). **No visual indicator on the tower itself** (e.g., colored ring or badge). The feature is functional but subtler than the label "player tower ownership indicators" implies. Acceptable for solo play; noticeable gap in multiplayer. |
| 5D — Chat / Ping | ✅ Correct | Chat: Enter key opens DOM input, message sent via `GameClient.sendChat()`, server broadcasts `chat_message` event, GameClient routes to `HudScene.receiveChatMessage()` which renders a 5-message scrolling overlay with 10s fade. Ping: right-click sends `ping` command, server broadcasts `ping_marker`, GameScene emits `ping_marker` event → `showPingMarker()` renders 3 pulsing concentric rings. Fully wired. |

---

## Type Safety

All packages typecheck clean (`--force`). Key type practices observed:

- `@td/shared` exports all cross-package types (`ClientCommand`, `ServerEvent`, `GameState`, etc.)
- `satisfies` used correctly in `server/index.ts` for `tower_upgraded` event
- `TowerInspectorOptions` interface properly typed including optional `ownerName`
- `EnemyType`, `ElementType`, `GamePhase` are all string literal unions — no unsafe `string` widening found
- One pattern of concern: `packages/client/src/scenes/GameScene.ts` casts `gameClient` via `as { getLatestState(): ... }` instead of importing `GameClient` type directly (workaround for circular import risk). Acceptable but worth documenting.

---

## Test Coverage Assessment

### Well-Covered (Server)
- Economy: gold grant, spend, wave bonus, kill bounty (dedicated test files)
- Tower: place, upgrade, sell, targeting, tier limits, gold deduction (12 tests)
- Combat: damage, splash, DoT, slow, pushback, tower_fired events (heavy CombatSystem.test.ts)
- Enemy: movement, waypoints, statuses, armor (11 tests)
- HP drain: all 7 enemy types verified with `ENEMY_BASE_DAMAGE` constants
- Wave scheduler: 6 tests including wave progression
- Multiplayer integration: 13 Socket.IO tests (join, place, upgrade, sell, start_wave, chat)
- Phase gating: 8 tests for prep/combat placement rules
- Map: 7 tests for 32×24 dimensions, crossroads, build zones

### Gaps (No Tests Yet)
| Area | Risk | Priority |
|------|------|----------|
| Wave banner gold formula | Medium — BUG-1/BUG-2 were missed because no test validates the displayed values | High |
| `towerInvestment` dead code | Low — dead code, not a behavioral gap | Low |
| TowerInspector UI logic | Low — pure UI, hard to unit test without Phaser | Low |
| Chat/ping end-to-end | Low — covered by multiplayer.test.ts structurally | Medium |
| ResultScene calculations (score grade) | Low | Low |
| DeathAnimator, TowerAnimator | Very Low — cosmetic | Low |

---

## Architecture & Integration

### Strengths
- **Event bus pattern** (GameScene ↔ HudScene ↔ GameClient via `scene.events`) is clean and decoupled.
- **`StateInterpolator`** buffers snapshots correctly; `getLatestState()` is safe for UI reads.
- **`ProjectileManager` object pool** pre-allocates 64 Graphics objects; silently drops when exhausted (correct for cosmetic-only FX).
- **Server command dispatch** in `index.ts` is a clean switch with proper ack callbacks.
- **`GameSimulation` drain pattern** (`drainEvents()`) avoids mid-tick mutation issues.
- **`nextEnemyId` instance-level** (not module-level) prevents test cross-contamination — good practice.

### Concerns
- **No reconnect implementation**: `case 'reconnect'` returns `{ ok: false, reason: 'reconnect not yet implemented' }`. Not a V2 blocker but flag for V3.
- **`setupChatSystem` keyboard capture**: DOM input uses `e.stopPropagation()` which correctly prevents Phaser from eating keystrokes. However, if Phaser has scene-level keyboard focus, ENTER key in `setupChatSystem` fires on Phaser's `KeyCodes.ENTER`, not the DOM input's `keydown` — the current implementation correctly separates these via `chatInputActive` guard. ✅
- **Right-click ping fires during all phases**: Ping can be sent during `victory`/`defeat` phases. Cosmetically harmless but potentially noisy.
- **`showSellPanel` vs `showTowerInspector` coexistence**: Both HudScene methods track separate state. The `hideTowerInspector` call in `showTowerInspector` and vice versa in `GameClient.bindScenes` appears to keep them mutually exclusive. Verified: no double-panel scenario found.

---

## Playtester Guidance

### Known Limitations to Document
1. **Gold bonus preview in wave banner may differ slightly from actual gold received.** (Being fixed.)
2. **Tower inspector (sell/upgrade) is only available during the prep phase**, not during active combat waves.
3. **Player ownership is shown as text in the tower inspector**, not as a colored ring on the map. Click a tower to see who built it.
4. **Chat messages auto-fade after 10 seconds** — no persistent chat log.
5. **Ping = right-click anywhere on the map.** Rings are cosmetic and do not mark enemy positions.

### Recommended Playtest Focus Areas
1. **Economy balance**: Kill bounty gold + wave bonus — does the economy feel rewarding? Do players have enough to keep building?
2. **Crossroads interaction**: Towers placed adjacent to tile (14,9) — do they correctly fire at enemies passing in both directions?
3. **Targeting modes**: Does `Weakest` correctly prioritize low-HP enemies? Does `Closest` correctly work during active combat?
4. **Sell during prep**: Is the 50% base refund intuitive? Upgraded towers return significantly less than their total cost.
5. **Multiplayer chat latency**: Does chat feel responsive? Is the 5-message limit sufficient?
6. **Victory/Defeat screen**: Does the stat breakdown feel rewarding? Is the score grade system fair?

---

## Pre-Release Checklist

- [ ] **Fix BUG-1**: Wave banner gold bonus formula
- [ ] **Fix BUG-2**: Post-wave popup hardcoded 50g
- [ ] **Fix BUG-3** *(recommended)*: Allow inspector during combat phase
- [ ] **Remove ARCH-1**: Delete unused `towerInvestment` Map from TowerSystem
- [ ] **Invalidate Turbo cache**: Run `turbo typecheck --force` in CI to prevent stale cache from masking future errors
- [ ] Add tests for wave banner gold formula (regression prevention for BUG-1/2)
- [ ] Verify map rendering at 32×24 on target screen resolutions (camera bounds / scroll clamp)
- [ ] Stress test: 4 players, wave 10, all build zones full — any performance issues with 60+ active enemies?

---

## Files Changed Since v1 Baseline

```
44 files changed, 6106 insertions(+), 269 deletions(-)
```

Major additions:
- `ResultScene.ts` (246 lines) — new
- `TowerInspector.ts` (469 lines) — new
- `EnemyInspector.ts` (334 lines) — new
- `Tooltip.ts` (192 lines) — new
- `DeathAnimator.ts` (82 lines) — new
- `ProjectileManager.ts` (117 lines) — new
- `TowerAnimator.ts` (95 lines) — new
- `SoundPool.ts` (84 lines) — new
- `HudScene.ts` (+603 lines for wave banner, chat, ping, sell panel, inspector, result launch)
- `GameScene.ts` (+313 lines for projectile, animation, ping, crossroads map)
- `maps.ts` (+198 lines for 32×24 crossroads map)
- 8 new server test files (kill bounty, HP drain, upgrade, placement-phase, tower-fired, etc.)

---

*Review complete. Three bugs require fixes. One dead-code field to delete. No blocking architecture concerns. The V2 feature set is ready for playtesting after the above items are addressed.*
