# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (starts client on :3000 and server on :3001)
pnpm dev

# Build all packages
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint

# All unit/integration tests
pnpm test

# Single package tests
pnpm --filter @td/server test
pnpm --filter @td/client test
pnpm --filter @td/shared test

# Watch mode (single package)
pnpm --filter @td/server test:watch

# E2E tests (requires dev servers running or auto-starts them)
pnpm test:e2e
pnpm test:e2e:headed    # visible browser
pnpm test:e2e:ui        # Playwright interactive UI

# Pre-commit verification
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

## Architecture

**Monorepo** — pnpm workspaces + Turborepo with three packages:

- **`@td/shared`** (`packages/shared/`) — Types, constants, game data. Exported as raw `.ts` files (no build step). Both client and server import directly.
- **`@td/client`** (`packages/client/`) — Phaser 3 browser game, bundled with Vite.
- **`@td/server`** (`packages/server/`) — Express + Socket.IO game server, runs via `tsx`.

### Server (authoritative simulation)

`GameSimulation` is the core — it composes 6 systems coordinated in a tick loop at 20Hz:

1. `WaveScheduler` — reads `WAVE_CONFIGS`, generates spawn events with time offsets
2. `EnemySystem` — waypoint-following movement, status effect management
3. `TowerSystem` — placement validation against `BuildZone`s, tile occupancy tracking
4. `CombatSystem` — attack targeting (closest in range), damage, splash, elemental status application
5. `ReactionSystem` — elemental combo detection (vaporize, freeze, melt, conflagration)
6. `EconomySystem` — shared gold pool, wave bonuses scaled by player count

**Tick sequence (combat):** advance wave timer → drain spawn queue → move enemies → process tower attacks → apply reactions → handle leaks → check win/loss.

**Game phases:** lobby → class_select → prep → combat → victory/defeat (managed by `GameRoom`).

The server broadcasts full `GameState` snapshots. No delta patching — clients receive complete state each tick.

### Client (render-only, no prediction)

**Scene graph:** BootScene → LobbyScene → ClassSelectScene → GameScene + HudScene (parallel overlay).

`GameClient` is the central coordinator, stored in `game.registry` and `window.__gameClient` (for E2E). It wraps `NetworkManager` (Socket.IO with ack-based commands) and `StateInterpolator` (3-snapshot buffer for smooth enemy movement).

**Rendering:** GameScene diffs server snapshots against local visual maps — creates/updates/destroys `TowerVisual`, `EnemyVisual`, and pooled `ProjectilePool` objects. Layer depth: clouds(-10) < terrain(0) < decor(5) < entities(10) < projectiles(20) < fx(30) < HUD(50).

**Audio:** Procedural synthesis via Web Audio API (`AudioManager`). No audio files.

### Shared Data

All game balance lives in `packages/shared/src/data/`:
- `towers.ts` — 16 towers (4 shared + 3 per element class), with upgrade tiers
- `waves.ts` — 20 wave configs
- `maps.ts` — map waypoints, build zones, player zones
- `classes.ts` — 4 element classes with passive effects
- `reactions.ts` — 4 elemental reaction definitions

### Network Protocol

Commands use Socket.IO ack callbacks (Promise-based). Types are discriminated unions in shared:
- `ClientCommand` — 9 command types (place_tower, sell_tower, select_class, ready_up, etc.)
- `ServerEvent` — snapshot-based (fine-grained event types exist as architecture placeholders but aren't used yet)

### Key Constants

`TICK_RATE=20`, `TILE_SIZE=64`, `MAX_PLAYERS=4`, `BASE_MAX_HP=100`, `TOWER_SELL_REFUND_PERCENT=0.7`, `PREP_PHASE_DURATION_SEC=30`. Client runs at 1280x720.

## Testing Patterns

**Unit/integration (Vitest):** Server tests use real system instances with `GameSimulation.create()` per test. `EnemySystem` and `TowerSystem` use instance-level ID counters for test isolation. Integration tests spin up real Express+Socket.IO on port 0.

**E2E (Playwright, Chromium only):** Access game state via `page.evaluate(() => window.__gameClient.getLatestState())`. Tower placement uses `window.__gameClient` API, not canvas clicks. Each test resets via `socket.emit('reset_game')`.

## Style

- Prettier: single quotes, semicolons, 2-space indent, trailing commas, 100 char width
- ESLint: `@typescript-eslint/recommended`, `no-console: warn`, `no-unused-vars: error`
- TypeScript: strict mode, ES2022 target, bundler module resolution

## Not Yet Implemented

`upgrade_tower` and `reconnect` commands return "not yet implemented" stubs.
