# Tower Defense — Final Code Review

**Reviewed:** 2026-02-20  
**Reviewer:** Automated Code Review Agent  
**Codebase:** monorepo — `packages/shared`, `packages/server`, `packages/client`

---

## Test Results (pre-fix)

All **115 tests** passed before any changes:
- `@td/shared`: 48 tests ✅
- `@td/server`: 67 tests ✅
- `@td/client`: 2 tests ✅

---

## TypeScript (`tsc --noEmit`) Results (pre-fix)

| Package | Result |
|---------|--------|
| `@td/shared` | ✅ Clean |
| `@td/server` | 🔴 5 errors |
| `@td/client` | ✅ Clean |

---

## Issues Found & Fixed

### 🔴 Blocker 1 — Missing `sellTower` on `GameSimulation`
**File:** `packages/server/src/index.ts:68`  
**File:** `packages/server/src/game/GameSimulation.ts`

`server/index.ts` called `sim.sellTower(socket.id, instanceId)` but `GameSimulation` had no such method (despite `TowerSystem.sellTower()` existing). This would crash the server with a `TypeError: sim.sellTower is not a function` at runtime.

**Fix:** Added `sellTower(playerId, instanceId)` to `GameSimulation.ts` that delegates to `TowerSystem.sellTower()` and credits the refund via `EconomySystem.addGold()`.

---

### 🔴 Blocker 2 — Socket.IO Payload Format Mismatch
**File:** `packages/server/src/index.ts` (command handler)  
**File:** `packages/client/src/networking/NetworkManager.ts`

The client sends **flat** `ClientCommand` objects per the shared type definition:
```ts
// Client sends:
{ type: 'join_game', playerName: 'Alice' }
{ type: 'place_tower', configId: 'fire_arrow', x: 5, y: 3 }
```
But the server handler expected a **nested payload**:
```ts
// Server was reading:
command.payload?.playerName  // undefined — always!
command.payload?.configId    // undefined — always!
```

All player names, tower placements, class selections — **every piece of data** was silently `undefined`. The game would appear to "work" (no crash) but all commands would be no-ops.

**Fix:** Rewrote the server's `socket.on('command', ...)` handler to read properties directly from the typed `ClientCommand` discriminated union (using a proper `switch` on `command.type` with full TypeScript narrowing).

---

### 🔴 Blocker 3 — Socket.IO Acknowledgment Mismatch (Client Promises Never Resolve)
**File:** `packages/server/src/index.ts` (command handler)  
**File:** `packages/client/src/networking/NetworkManager.ts`

The client uses **Socket.IO's built-in ack callback pattern**:
```ts
// NetworkManager.sendCommand:
this.socket.emit('command', command, (response) => {
  resolve(response);  // This callback is NEVER called by the old server
});
```

The server was emitting a **separate event** instead:
```ts
// Old server:
socket.emit('command_ack', result);  // Client never listens to this event!
```

Result: Every `await network.placeTower(...)`, `await network.joinGame(...)`, etc. would hang **indefinitely** — the Promises never resolve. The entire client-side game flow was dead.

**Fix:** Changed the server handler signature to `socket.on('command', (command, ack) => { ...; ack(result); })` using the standard Socket.IO ack callback pattern. Added a `typeof ack === 'function'` guard for safety.

Also added stub handlers for the previously-unhandled `upgrade_tower`, `reconnect`, and `chat` command types (all in the shared `ClientCommand` union) to prevent the `default` branch from silently swallowing them.

---

### ⚠️ Warning — `ReactionSystem.ts` TypeScript Errors (TS2339 / TS2322)
**File:** `packages/server/src/systems/ReactionSystem.ts:45,48`

`ReactionEffect.value` is typed as `number | undefined` (optional), but the code used it without null-checking:
```ts
// Before:
damage = Math.round(baseDamage * reaction.effect.value);  // TS2339
damage = reaction.effect.value;                            // TS2322
```

**Fix:** Added null-coalescing defaults:
```ts
// After:
damage = Math.round(baseDamage * (reaction.effect.value ?? 1));
damage = reaction.effect.value ?? 0;
```

---

### ⚠️ Warning — `GameSimulation` Public Methods Missing Return Type Annotations
**File:** `packages/server/src/game/GameSimulation.ts:61,69,73`

`addPlayer`, `selectClass`, `readyUp` delegated to `GameRoom` methods that return `GameRoom`'s local (non-exported) `CommandResult`. TypeScript couldn't name the return type, causing TS4053 errors.

**Fix:** Added explicit `: CommandResult` return type annotations to all three methods, plus `: void` on `removePlayer`.

---

## Things That Look Good ✅

- **All 115 tests pass** — comprehensive coverage of all systems
- **`@td/shared` is clean** — well-typed discriminated unions for `ClientCommand` and `ServerEvent`; all data exports correct
- **`@td/client` typechecks clean** — Phaser scenes, NetworkManager, GameClient, StateInterpolator all type-correct
- **`pnpm dev:all`** — `concurrently` is in root `devDependencies` ✅
- **Socket.IO versions aligned** — server `socket.io@^4.8.0`, client `socket.io-client@^4.8.0` ✅
- **All dependencies present** — `express`, `socket.io`, `socket.io-client`, `phaser`, `tsx`, `vite` all installed ✅
- **Boot flow correct** — `BootScene → LobbyScene → ClassSelectScene → GameScene + HudScene` properly ordered in `main.ts`
- **`GameSimulation.ts` logic** — tick loop, wave spawning, combat, reaction check, leak handling, phase transitions all look sound
- **`TowerSystem.sellTower`** — correctly tracks investment and applies `TOWER_SELL_REFUND_PERCENT` ✅
- **`ReactionSystem` priority sorting** — reactions sorted on construction, not per-call ✅
- **`EnemySystem` waypoint progression** — `waypointIndex` + `progress` approach is solid ✅
- **`WaveScheduler` scaling** — per-player HP/count scaling is present and tested ✅

---

## Post-Fix Verification

```
tsc --noEmit @td/shared  → EXIT 0 ✅
tsc --noEmit @td/server  → EXIT 0 ✅
tsc --noEmit @td/client  → EXIT 0 ✅
pnpm test (all packages) → 115/115 ✅
```
