# Tower Defense v0.1 MVP Implementation Plan

> **For Claude:** Spawn `task-builder` agent to implement this plan task-by-task.

**Goal:** Build a playable 1-4 player co-op tower defense MVP with elemental classes, tower synergies, authoritative server, and 15-20 waves of enemies on a fixed-path map.

**Architecture:** Monorepo with three packages: `shared` (types, configs, constants used by both client and server), `server` (Node.js + Socket.IO authoritative game simulation at 20Hz), and `client` (Phaser 3 + TypeScript rendering, input, audio). The server owns all game state validation. The client sends commands and interpolates between server snapshots.

**Tech Stack:** TypeScript throughout, Phaser 3 (client), Node.js + Socket.IO (server), Vitest (testing), ESLint + Prettier (linting), pnpm workspaces (monorepo).

**Team:** Trey, Matt, Milk (3 developers)

**Design Spec:** `docs/plans/2026-02-20-tower-defense-design.md`

---

## Plan Overview

### Phase 1: Project Scaffolding & Shared Types (Tasks 1-3)
Foundation: monorepo, tooling, shared type definitions.

### Phase 2: Server Core — Game Loop & Economy (Tasks 4-7)
Authoritative server: tick loop, rooms, economy, wave scheduling.

### Phase 3: Server Core — Towers, Enemies, Combat (Tasks 8-12)
Tower placement, enemy pathing, targeting, damage, elemental reactions.

### Phase 4: Client Core — Rendering & Input (Tasks 13-17)
Phaser scenes, map rendering, tower placement UI, enemy rendering.

### Phase 5: Networking — Client-Server Integration (Tasks 18-21)
Socket.IO connection, command/snapshot protocol, interpolation.

### Phase 6: Game Content — Data & Balancing (Tasks 22-25)
Tower configs, wave configs, class configs, map data.

### Phase 7: Audio, Polish & Lobby (Tasks 26-29)
Sound system, lobby/class selection, HUD, prep/combat phase flow.

### Phase 8: Integration Testing & Playtesting (Task 30)
End-to-end testing, multiplayer testing, balance pass.

---

## Phase 1: Project Scaffolding & Shared Types

### Task 1: Initialize Monorepo with pnpm Workspaces

**Parallel:** yes
**Blocked by:** none
**Owned files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.eslintrc.json`, `.prettierrc`, `.gitignore`, `turbo.json`

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.eslintrc.json`
- Create: `.prettierrc`
- Create: `.gitignore`
- Create: `turbo.json`

**Step 1: Initialize root package.json**

```json
{
  "name": "tower-defense",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "clean": "turbo clean"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "prettier": "^3.4.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

**Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

**Step 4: Create .eslintrc.json**

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "no-console": "warn"
  }
}
```

**Step 5: Create .prettierrc**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}
```

**Step 6: Create .gitignore**

```
node_modules/
dist/
.turbo/
*.tsbuildinfo
.env
.DS_Store
```

**Step 7: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Step 8: Install dependencies**

Run: `pnpm install`
Expected: lockfile created, node_modules populated

**Step 9: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .eslintrc.json .prettierrc .gitignore turbo.json pnpm-lock.yaml
git commit -m "chore: initialize monorepo with pnpm workspaces and turbo"
```

---

### Task 2: Scaffold Server Package

**Parallel:** yes
**Blocked by:** none (can be done simultaneously with Task 1 if dependency install is coordinated after)
**Owned files:** `packages/server/package.json`, `packages/server/tsconfig.json`, `packages/server/src/index.ts`, `packages/server/vitest.config.ts`

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/index.ts`
- Create: `packages/server/vitest.config.ts`

**Step 1: Create server package.json**

```json
{
  "name": "@td/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@td/shared": "workspace:*",
    "socket.io": "^4.8.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  }
}
```

**Step 2: Create server tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../shared" }
  ]
}
```

**Step 3: Create placeholder server entry**

```typescript
// packages/server/src/index.ts
console.log('Tower Defense Server — starting...');
```

**Step 4: Create vitest config**

```typescript
// packages/server/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

**Step 5: Commit**

```bash
git add packages/server/
git commit -m "chore: scaffold server package"
```

---

### Task 3: Scaffold Client Package and Shared Package

**Parallel:** yes
**Blocked by:** none
**Owned files:** `packages/client/package.json`, `packages/client/tsconfig.json`, `packages/client/src/main.ts`, `packages/client/index.html`, `packages/client/vite.config.ts`, `packages/client/vitest.config.ts`, `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`, `packages/shared/vitest.config.ts`

**Files:**
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/client/src/main.ts`
- Create: `packages/client/index.html`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/vitest.config.ts`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/vitest.config.ts`

**Step 1: Create shared package.json**

```json
{
  "name": "@td/shared",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create shared tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create shared index.ts with core types**

```typescript
// packages/shared/src/index.ts

// ── Element & Class Types ──────────────────────────────────
export type ElementType = 'fire' | 'water' | 'ice' | 'poison';

export interface ClassConfig {
  id: ElementType;
  identity: string[];
  passive: PassiveEffect;
  heroId: string;
}

export interface PassiveEffect {
  type: string;
  dps?: number;
  durationSec?: number;
}

// ── Tower Types ────────────────────────────────────────────
export type TowerCategory = 'basic' | 'specialty' | 'hybrid' | 'ultimate';
export type TowerRole = 'damage' | 'aoe' | 'cc' | 'support' | 'utility';
export type TargetType = 'ground' | 'air' | 'both';

export interface TowerConfig {
  id: string;
  name: string;
  class: ElementType | 'shared';
  category: TowerCategory;
  roles: TowerRole[];
  costGold: number;
  range: number;
  attackPeriodSec: number;
  baseDamage: number;
  splashRadius?: number;
  onHit?: OnHitEffect[];
  targets: TargetType;
  upgrades: TowerUpgrade[];
}

export interface TowerUpgrade {
  tier: number;
  costGold: number;
  deltas: Record<string, string | number>;
}

export interface OnHitEffect {
  type: string;
  element?: ElementType;
  dps?: number;
  durationSec?: number;
  slowPercent?: number;
}

// ── Tower Instance (runtime state) ─────────────────────────
export interface TowerState {
  instanceId: string;
  configId: string;
  ownerId: string;
  tier: number;
  x: number;
  y: number;
  currentTarget?: string;
  lastAttackTick: number;
}

// ── Enemy Types ────────────────────────────────────────────
export type EnemyType = 'grunt' | 'runner' | 'tank' | 'flyer' | 'invisible' | 'caster' | 'boss';

export interface EnemyConfig {
  type: EnemyType;
  hp: number;
  speed: number;
  armor: number;
  tags: string[];
  resistances?: ElementType[];
  abilities?: EnemyAbility[];
}

export interface EnemyAbility {
  type: string;
  value: number;
  cooldownSec?: number;
}

// ── Enemy Instance (runtime state) ─────────────────────────
export interface EnemyState {
  instanceId: string;
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  armor: number;
  x: number;
  y: number;
  waypointIndex: number;
  progress: number; // 0-1 between current and next waypoint
  statuses: EnemyStatus[];
  alive: boolean;
}

export interface EnemyStatus {
  element: ElementType;
  type: string; // 'soaked' | 'burning' | 'cold' | 'frozen' | 'toxin'
  stacks: number;
  remainingSec: number;
}

// ── Wave Types ─────────────────────────────────────────────
export interface WaveConfig {
  wave: number;
  groups: WaveGroup[];
  bountyGold: number;
  telegraph: string;
}

export interface WaveGroup {
  enemyType: EnemyType;
  count: number;
  hp: number;
  speed: number;
  armor: number;
  tags: string[];
  spawnIntervalSec: number;
  resistances?: ElementType[];
}

// ── Elemental Reaction Types ───────────────────────────────
export type ReactionType =
  | 'vaporize'
  | 'melt'
  | 'steam_burst'
  | 'freeze'
  | 'shatter'
  | 'blight'
  | 'frostburn'
  | 'conflagration';

export interface ReactionConfig {
  id: ReactionType;
  triggerElement: ElementType;
  requiredStatus: string;
  effect: ReactionEffect;
  consumesStatus: boolean;
  sound: string;
  vfx: string;
}

export interface ReactionEffect {
  type: string;
  value: number;
  aoeRadius?: number;
  durationSec?: number;
}

// ── Map Types ──────────────────────────────────────────────
export interface Vec2 {
  x: number;
  y: number;
}

export interface MapConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  waypoints: Vec2[];
  buildZones: BuildZone[];
  playerZones: PlayerZone[];
}

export interface BuildZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlayerZone {
  id: number;
  minPlayers: number;
  buildZones: number[];
}

// ── Economy Types ──────────────────────────────────────────
export interface EconomyState {
  gold: number;
  lumber: number;
}

// ── Game State Types ───────────────────────────────────────
export type GamePhase = 'lobby' | 'class_select' | 'prep' | 'combat' | 'post_wave' | 'victory' | 'defeat';

export interface PlayerState {
  id: string;
  name: string;
  elementClass: ElementType | null;
  connected: boolean;
  ready: boolean;
}

export interface GameState {
  phase: GamePhase;
  wave: number;
  maxWaves: number;
  baseHp: number;
  maxBaseHp: number;
  economy: EconomyState;
  players: Record<string, PlayerState>;
  towers: Record<string, TowerState>;
  enemies: Record<string, EnemyState>;
  prepTimeRemaining: number;
  tick: number;
}

// ── Network Protocol ───────────────────────────────────────
// Client -> Server commands
export type ClientCommand =
  | { type: 'join_game'; playerName: string }
  | { type: 'select_class'; elementClass: ElementType }
  | { type: 'ready_up' }
  | { type: 'place_tower'; configId: string; x: number; y: number }
  | { type: 'upgrade_tower'; instanceId: string }
  | { type: 'sell_tower'; instanceId: string }
  | { type: 'start_wave' }
  | { type: 'chat'; message: string };

// Server -> Client events
export type ServerEvent =
  | { type: 'game_snapshot'; state: GameState }
  | { type: 'tower_placed'; tower: TowerState; accepted: boolean; reason?: string }
  | { type: 'tower_upgraded'; instanceId: string; newTier: number }
  | { type: 'tower_sold'; instanceId: string; goldRefund: number }
  | { type: 'enemy_damaged'; instanceId: string; damage: number; newHp: number }
  | { type: 'enemy_killed'; instanceId: string; bounty: number }
  | { type: 'reaction_triggered'; reaction: ReactionType; x: number; y: number; damage: number }
  | { type: 'base_damaged'; damage: number; remainingHp: number }
  | { type: 'wave_started'; wave: number; telegraph: string }
  | { type: 'wave_completed'; wave: number; goldReward: number }
  | { type: 'phase_changed'; phase: GamePhase }
  | { type: 'player_joined'; player: PlayerState }
  | { type: 'player_left'; playerId: string }
  | { type: 'error'; message: string };

// ── Constants ──────────────────────────────────────────────
export const TICK_RATE = 20; // server ticks per second
export const TICK_DURATION_MS = 1000 / TICK_RATE;
export const SNAPSHOT_INTERVAL_MS = 250;
export const PREP_PHASE_DURATION_SEC = 30;
export const BASE_MAX_HP = 100;
export const TOWER_SELL_REFUND_PERCENT = 0.7;
export const MAX_PLAYERS = 4; // v0.1 limit
export const TILE_SIZE = 64;
```

**Step 4: Create shared vitest config**

```typescript
// packages/shared/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
```

**Step 5: Create client package.json**

```json
{
  "name": "@td/client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@td/shared": "workspace:*",
    "phaser": "^3.87.0",
    "socket.io-client": "^4.8.0"
  },
  "devDependencies": {
    "vite": "^6.1.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 6: Create client tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../shared" }
  ]
}
```

**Step 7: Create client index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tower Defense</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; overflow: hidden; }
    #game-container { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

**Step 8: Create client main.ts placeholder**

```typescript
// packages/client/src/main.ts
import Phaser from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scene: [],
};

const game = new Phaser.Game(config);
console.log('Tower Defense Client initialized', game);
```

**Step 9: Create client vite.config.ts**

```typescript
// packages/client/vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'es2022',
  },
});
```

**Step 10: Create client vitest.config.ts**

```typescript
// packages/client/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
```

**Step 11: Install all dependencies**

Run: `pnpm install`
Expected: all three packages resolve, lockfile updated

**Step 12: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: no errors

**Step 13: Commit**

```bash
git add packages/shared/ packages/client/
git commit -m "chore: scaffold shared types and client packages"
```

---

## Phase 2: Server Core — Game Loop & Economy

### Task 4: Game Room Manager

**Parallel:** no
**Blocked by:** Task 1, Task 2
**Owned files:** `packages/server/src/rooms/GameRoom.ts`, `packages/server/src/rooms/GameRoom.test.ts`

**Files:**
- Create: `packages/server/src/rooms/GameRoom.ts`
- Create: `packages/server/src/rooms/GameRoom.test.ts`

**Step 1: Write failing tests for GameRoom**

```typescript
// packages/server/src/rooms/GameRoom.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from './GameRoom';

describe('GameRoom', () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom('test-room');
  });

  it('initializes with lobby phase', () => {
    expect(room.state.phase).toBe('lobby');
  });

  it('initializes with full base HP', () => {
    expect(room.state.baseHp).toBe(100);
    expect(room.state.maxBaseHp).toBe(100);
  });

  it('adds a player', () => {
    room.addPlayer('p1', 'Trey');
    expect(room.state.players['p1']).toBeDefined();
    expect(room.state.players['p1'].name).toBe('Trey');
    expect(room.state.players['p1'].elementClass).toBeNull();
  });

  it('rejects more than MAX_PLAYERS', () => {
    room.addPlayer('p1', 'Trey');
    room.addPlayer('p2', 'Matt');
    room.addPlayer('p3', 'Milk');
    room.addPlayer('p4', 'P4');
    const result = room.addPlayer('p5', 'P5');
    expect(result.ok).toBe(false);
  });

  it('removes a player', () => {
    room.addPlayer('p1', 'Trey');
    room.removePlayer('p1');
    expect(room.state.players['p1']).toBeUndefined();
  });

  it('assigns class to player', () => {
    room.addPlayer('p1', 'Trey');
    room.selectClass('p1', 'fire');
    expect(room.state.players['p1'].elementClass).toBe('fire');
  });

  it('transitions to class_select when host readies', () => {
    room.addPlayer('p1', 'Trey');
    room.readyUp('p1');
    expect(room.state.phase).toBe('class_select');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/server && pnpm test -- --run src/rooms/GameRoom.test.ts`
Expected: FAIL — module not found

**Step 3: Implement GameRoom**

```typescript
// packages/server/src/rooms/GameRoom.ts
import {
  GameState,
  GamePhase,
  PlayerState,
  ElementType,
  EconomyState,
  BASE_MAX_HP,
  MAX_PLAYERS,
} from '@td/shared';

interface CommandResult {
  ok: boolean;
  reason?: string;
}

export class GameRoom {
  readonly id: string;
  state: GameState;

  constructor(id: string) {
    this.id = id;
    this.state = {
      phase: 'lobby',
      wave: 0,
      maxWaves: 20,
      baseHp: BASE_MAX_HP,
      maxBaseHp: BASE_MAX_HP,
      economy: { gold: 0, lumber: 0 },
      players: {},
      towers: {},
      enemies: {},
      prepTimeRemaining: 0,
      tick: 0,
    };
  }

  addPlayer(id: string, name: string): CommandResult {
    if (Object.keys(this.state.players).length >= MAX_PLAYERS) {
      return { ok: false, reason: 'Room is full' };
    }
    if (this.state.players[id]) {
      return { ok: false, reason: 'Player already in room' };
    }
    this.state.players[id] = {
      id,
      name,
      elementClass: null,
      connected: true,
      ready: false,
    };
    return { ok: true };
  }

  removePlayer(id: string): void {
    delete this.state.players[id];
  }

  selectClass(playerId: string, elementClass: ElementType): CommandResult {
    const player = this.state.players[playerId];
    if (!player) return { ok: false, reason: 'Player not found' };
    player.elementClass = elementClass;
    return { ok: true };
  }

  readyUp(playerId: string): CommandResult {
    const player = this.state.players[playerId];
    if (!player) return { ok: false, reason: 'Player not found' };
    player.ready = true;

    if (this.state.phase === 'lobby') {
      this.state.phase = 'class_select';
    }

    return { ok: true };
  }

  get playerCount(): number {
    return Object.keys(this.state.players).length;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/server && pnpm test -- --run src/rooms/GameRoom.test.ts`
Expected: all tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/rooms/
git commit -m "feat: add GameRoom with player management and phase transitions"
```

---

### Task 5: Server Game Loop (20Hz Fixed Tick)

**Parallel:** no
**Blocked by:** Task 4
**Owned files:** `packages/server/src/game/GameLoop.ts`, `packages/server/src/game/GameLoop.test.ts`

**Files:**
- Create: `packages/server/src/game/GameLoop.ts`
- Create: `packages/server/src/game/GameLoop.test.ts`

**Step 1: Write failing tests for GameLoop**

```typescript
// packages/server/src/game/GameLoop.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameLoop } from './GameLoop';

describe('GameLoop', () => {
  let loop: GameLoop;
  let tickCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tickCallback = vi.fn();
    loop = new GameLoop(tickCallback);
  });

  afterEach(() => {
    loop.stop();
  });

  it('is not running initially', () => {
    expect(loop.isRunning).toBe(false);
  });

  it('calls tick callback at 20Hz', async () => {
    loop.start();
    expect(loop.isRunning).toBe(true);
    // Wait ~110ms for at least 2 ticks (50ms each)
    await new Promise((r) => setTimeout(r, 110));
    loop.stop();
    expect(tickCallback.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('passes delta time to tick callback', async () => {
    loop.start();
    await new Promise((r) => setTimeout(r, 60));
    loop.stop();
    if (tickCallback.mock.calls.length > 0) {
      const dt = tickCallback.mock.calls[0][0];
      expect(dt).toBeGreaterThan(0);
      expect(dt).toBeLessThan(0.1);
    }
  });

  it('stops cleanly', async () => {
    loop.start();
    await new Promise((r) => setTimeout(r, 60));
    loop.stop();
    const callCount = tickCallback.mock.calls.length;
    await new Promise((r) => setTimeout(r, 100));
    expect(tickCallback.mock.calls.length).toBe(callCount);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && pnpm test -- --run src/game/GameLoop.test.ts`
Expected: FAIL — module not found

**Step 3: Implement GameLoop**

```typescript
// packages/server/src/game/GameLoop.ts
import { TICK_DURATION_MS } from '@td/shared';

export class GameLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTime: number = 0;
  private onTick: (dt: number) => void;

  isRunning = false;

  constructor(onTick: (dt: number) => void) {
    this.onTick = onTick;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();

    this.intervalId = setInterval(() => {
      const now = performance.now();
      const dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      this.onTick(dt);
    }, TICK_DURATION_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/server && pnpm test -- --run src/game/GameLoop.test.ts`
Expected: all tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/game/
git commit -m "feat: add 20Hz fixed-tick game loop"
```

---

### Task 6: Economy System

**Parallel:** no
**Blocked by:** Task 4
**Owned files:** `packages/server/src/systems/EconomySystem.ts`, `packages/server/src/systems/EconomySystem.test.ts`

**Files:**
- Create: `packages/server/src/systems/EconomySystem.ts`
- Create: `packages/server/src/systems/EconomySystem.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/systems/EconomySystem.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { EconomySystem } from './EconomySystem';
import { EconomyState } from '@td/shared';

describe('EconomySystem', () => {
  let economy: EconomySystem;

  beforeEach(() => {
    economy = new EconomySystem();
  });

  it('starts with zero gold', () => {
    expect(economy.state.gold).toBe(0);
  });

  it('adds starting gold scaled by player count', () => {
    economy.grantStartingGold(2);
    // Base 100 gold * 2 players
    expect(economy.state.gold).toBe(200);
  });

  it('adds kill bounty', () => {
    economy.addGold(10);
    expect(economy.state.gold).toBe(10);
  });

  it('adds wave completion bonus', () => {
    economy.addWaveBonus(5, 3); // wave 5, 3 players
    expect(economy.state.gold).toBeGreaterThan(0);
  });

  it('spends gold if sufficient', () => {
    economy.addGold(200);
    const result = economy.spendGold(120);
    expect(result).toBe(true);
    expect(economy.state.gold).toBe(80);
  });

  it('refuses to spend gold if insufficient', () => {
    economy.addGold(50);
    const result = economy.spendGold(120);
    expect(result).toBe(false);
    expect(economy.state.gold).toBe(50);
  });

  it('refunds gold on tower sell', () => {
    economy.addGold(0);
    economy.refundTower(100); // 70% refund
    expect(economy.state.gold).toBe(70);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/server && pnpm test -- --run src/systems/EconomySystem.test.ts`
Expected: FAIL

**Step 3: Implement EconomySystem**

```typescript
// packages/server/src/systems/EconomySystem.ts
import { EconomyState, TOWER_SELL_REFUND_PERCENT } from '@td/shared';

const BASE_STARTING_GOLD = 100;
const BASE_WAVE_BONUS = 20;
const WAVE_BONUS_SCALING = 5;

export class EconomySystem {
  state: EconomyState;

  constructor() {
    this.state = { gold: 0, lumber: 0 };
  }

  grantStartingGold(playerCount: number): void {
    this.state.gold = BASE_STARTING_GOLD * playerCount;
  }

  addGold(amount: number): void {
    this.state.gold += amount;
  }

  addWaveBonus(waveNumber: number, playerCount: number): void {
    const bonus = (BASE_WAVE_BONUS + WAVE_BONUS_SCALING * waveNumber) * playerCount;
    this.state.gold += bonus;
  }

  spendGold(amount: number): boolean {
    if (this.state.gold < amount) return false;
    this.state.gold -= amount;
    return true;
  }

  refundTower(originalCost: number): void {
    this.state.gold += Math.floor(originalCost * TOWER_SELL_REFUND_PERCENT);
  }

  canAfford(amount: number): boolean {
    return this.state.gold >= amount;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/server && pnpm test -- --run src/systems/EconomySystem.test.ts`
Expected: all tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/systems/EconomySystem.ts packages/server/src/systems/EconomySystem.test.ts
git commit -m "feat: add economy system with gold management"
```

---

### Task 7: Wave Scheduler

**Parallel:** no
**Blocked by:** Task 4, Task 5
**Owned files:** `packages/server/src/systems/WaveScheduler.ts`, `packages/server/src/systems/WaveScheduler.test.ts`

**Files:**
- Create: `packages/server/src/systems/WaveScheduler.ts`
- Create: `packages/server/src/systems/WaveScheduler.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/systems/WaveScheduler.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { WaveScheduler } from './WaveScheduler';
import type { WaveConfig } from '@td/shared';

const mockWaves: WaveConfig[] = [
  {
    wave: 1,
    groups: [{ enemyType: 'grunt', count: 5, hp: 50, speed: 1, armor: 0, tags: ['ground'], spawnIntervalSec: 0.5 }],
    bountyGold: 5,
    telegraph: 'Grunts incoming!',
  },
  {
    wave: 2,
    groups: [{ enemyType: 'runner', count: 8, hp: 30, speed: 1.5, armor: 0, tags: ['ground'], spawnIntervalSec: 0.3 }],
    bountyGold: 4,
    telegraph: 'Fast runners approaching!',
  },
];

describe('WaveScheduler', () => {
  let scheduler: WaveScheduler;

  beforeEach(() => {
    scheduler = new WaveScheduler(mockWaves);
  });

  it('starts at wave 0 (no wave active)', () => {
    expect(scheduler.currentWave).toBe(0);
  });

  it('returns next wave config', () => {
    const next = scheduler.getNextWave();
    expect(next).toBeDefined();
    expect(next!.wave).toBe(1);
  });

  it('advances to next wave', () => {
    scheduler.advance();
    expect(scheduler.currentWave).toBe(1);
  });

  it('reports if more waves remain', () => {
    expect(scheduler.hasMoreWaves()).toBe(true);
    scheduler.advance();
    scheduler.advance();
    expect(scheduler.hasMoreWaves()).toBe(false);
  });

  it('produces spawn events for a wave', () => {
    scheduler.advance();
    const spawns = scheduler.getSpawnEvents(1);
    expect(spawns).toHaveLength(5);
    expect(spawns[0].enemyType).toBe('grunt');
    expect(spawns[1].spawnAtSec).toBeGreaterThan(spawns[0].spawnAtSec);
  });

  it('scales enemy HP by player count', () => {
    scheduler.advance();
    const spawns = scheduler.getSpawnEvents(3); // 3 players
    // HP = 50 * (1 + 0.3 * (3-1)) = 50 * 1.6 = 80
    expect(spawns[0].hp).toBe(80);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/server && pnpm test -- --run src/systems/WaveScheduler.test.ts`
Expected: FAIL

**Step 3: Implement WaveScheduler**

```typescript
// packages/server/src/systems/WaveScheduler.ts
import type { WaveConfig, EnemyType } from '@td/shared';

export interface SpawnEvent {
  enemyType: EnemyType;
  hp: number;
  speed: number;
  armor: number;
  tags: string[];
  spawnAtSec: number;
  resistances?: string[];
}

export class WaveScheduler {
  private waves: WaveConfig[];
  currentWave: number = 0;

  constructor(waves: WaveConfig[]) {
    this.waves = waves;
  }

  getNextWave(): WaveConfig | undefined {
    return this.waves[this.currentWave];
  }

  getCurrentWaveConfig(): WaveConfig | undefined {
    return this.waves[this.currentWave - 1];
  }

  advance(): void {
    this.currentWave++;
  }

  hasMoreWaves(): boolean {
    return this.currentWave < this.waves.length;
  }

  getSpawnEvents(playerCount: number): SpawnEvent[] {
    const config = this.getCurrentWaveConfig();
    if (!config) return [];

    const hpScale = 1 + 0.3 * (playerCount - 1);
    const events: SpawnEvent[] = [];

    for (const group of config.groups) {
      for (let i = 0; i < group.count; i++) {
        events.push({
          enemyType: group.enemyType,
          hp: Math.round(group.hp * hpScale),
          speed: group.speed,
          armor: group.armor,
          tags: group.tags,
          spawnAtSec: i * group.spawnIntervalSec,
          resistances: group.resistances,
        });
      }
    }

    return events;
  }

  get totalWaves(): number {
    return this.waves.length;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/server && pnpm test -- --run src/systems/WaveScheduler.test.ts`
Expected: all tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/systems/WaveScheduler.ts packages/server/src/systems/WaveScheduler.test.ts
git commit -m "feat: add wave scheduler with player-count HP scaling"
```

---

## Phase 3: Server Core — Towers, Enemies, Combat

### Task 8: Tower Placement System

**Parallel:** yes (with Task 9)
**Blocked by:** Task 4, Task 6
**Owned files:** `packages/server/src/systems/TowerSystem.ts`, `packages/server/src/systems/TowerSystem.test.ts`

**Files:**
- Create: `packages/server/src/systems/TowerSystem.ts`
- Create: `packages/server/src/systems/TowerSystem.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/systems/TowerSystem.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TowerSystem } from './TowerSystem';
import type { TowerConfig, MapConfig, TowerState } from '@td/shared';

const mockTowerConfig: TowerConfig = {
  id: 'arrow_tower',
  name: 'Arrow Tower',
  class: 'shared',
  category: 'basic',
  roles: ['damage'],
  costGold: 50,
  range: 3,
  attackPeriodSec: 1.0,
  baseDamage: 10,
  targets: 'ground',
  upgrades: [
    { tier: 2, costGold: 40, deltas: { baseDamage: '+5' } },
    { tier: 3, costGold: 80, deltas: { baseDamage: '+10', range: '+0.5' } },
  ],
};

const mockMap: MapConfig = {
  id: 'test-map',
  name: 'Test Map',
  width: 20,
  height: 15,
  tileSize: 64,
  waypoints: [
    { x: 0, y: 7 }, { x: 5, y: 7 }, { x: 10, y: 7 }, { x: 15, y: 7 }, { x: 19, y: 7 },
  ],
  buildZones: [{ x: 3, y: 4, width: 5, height: 2 }, { x: 3, y: 9, width: 5, height: 2 }],
  playerZones: [{ id: 0, minPlayers: 1, buildZones: [0, 1] }],
};

describe('TowerSystem', () => {
  let system: TowerSystem;

  beforeEach(() => {
    system = new TowerSystem({ arrow_tower: mockTowerConfig }, mockMap);
  });

  it('places tower in valid build zone', () => {
    const result = system.placeTower('arrow_tower', 4, 5, 'p1');
    expect(result.ok).toBe(true);
    expect(result.tower).toBeDefined();
    expect(result.tower!.configId).toBe('arrow_tower');
  });

  it('rejects placement outside build zone', () => {
    const result = system.placeTower('arrow_tower', 0, 0, 'p1');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('build zone');
  });

  it('rejects placement on occupied tile', () => {
    system.placeTower('arrow_tower', 4, 5, 'p1');
    const result = system.placeTower('arrow_tower', 4, 5, 'p2');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('occupied');
  });

  it('rejects unknown tower config', () => {
    const result = system.placeTower('fake_tower', 4, 5, 'p1');
    expect(result.ok).toBe(false);
  });

  it('upgrades tower to next tier', () => {
    const place = system.placeTower('arrow_tower', 4, 5, 'p1');
    const result = system.upgradeTower(place.tower!.instanceId);
    expect(result.ok).toBe(true);
    expect(result.newTier).toBe(2);
  });

  it('rejects upgrade beyond max tier', () => {
    const place = system.placeTower('arrow_tower', 4, 5, 'p1');
    system.upgradeTower(place.tower!.instanceId);
    system.upgradeTower(place.tower!.instanceId);
    const result = system.upgradeTower(place.tower!.instanceId);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('max tier');
  });

  it('sells tower and removes it', () => {
    const place = system.placeTower('arrow_tower', 4, 5, 'p1');
    const result = system.sellTower(place.tower!.instanceId);
    expect(result.ok).toBe(true);
    expect(result.goldRefund).toBeGreaterThan(0);
    expect(system.getTower(place.tower!.instanceId)).toBeUndefined();
  });

  it('returns total gold invested for refund calculation', () => {
    const place = system.placeTower('arrow_tower', 4, 5, 'p1');
    system.upgradeTower(place.tower!.instanceId);
    const result = system.sellTower(place.tower!.instanceId);
    // 50 (base) + 40 (tier 2) = 90 * 0.7 = 63
    expect(result.goldRefund).toBe(63);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/server && pnpm test -- --run src/systems/TowerSystem.test.ts`
Expected: FAIL

**Step 3: Implement TowerSystem**

```typescript
// packages/server/src/systems/TowerSystem.ts
import type { TowerConfig, TowerState, MapConfig } from '@td/shared';
import { TOWER_SELL_REFUND_PERCENT } from '@td/shared';

let nextTowerId = 1;

interface PlaceResult {
  ok: boolean;
  tower?: TowerState;
  reason?: string;
}

interface UpgradeResult {
  ok: boolean;
  newTier?: number;
  cost?: number;
  reason?: string;
}

interface SellResult {
  ok: boolean;
  goldRefund?: number;
  reason?: string;
}

export class TowerSystem {
  private configs: Record<string, TowerConfig>;
  private map: MapConfig;
  private towers: Map<string, TowerState> = new Map();
  private occupiedTiles: Set<string> = new Set();
  private towerInvestment: Map<string, number> = new Map();

  constructor(configs: Record<string, TowerConfig>, map: MapConfig) {
    this.configs = configs;
    this.map = map;
  }

  private tileKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  private isInBuildZone(x: number, y: number): boolean {
    return this.map.buildZones.some(
      (zone) => x >= zone.x && x < zone.x + zone.width && y >= zone.y && y < zone.y + zone.height,
    );
  }

  placeTower(configId: string, x: number, y: number, ownerId: string): PlaceResult {
    const config = this.configs[configId];
    if (!config) return { ok: false, reason: 'Unknown tower config' };

    if (!this.isInBuildZone(x, y)) {
      return { ok: false, reason: 'Not in a build zone' };
    }

    if (this.occupiedTiles.has(this.tileKey(x, y))) {
      return { ok: false, reason: 'Tile is occupied' };
    }

    const instanceId = `tower_${nextTowerId++}`;
    const tower: TowerState = {
      instanceId,
      configId,
      ownerId,
      tier: 1,
      x,
      y,
      lastAttackTick: 0,
    };

    this.towers.set(instanceId, tower);
    this.occupiedTiles.add(this.tileKey(x, y));
    this.towerInvestment.set(instanceId, config.costGold);

    return { ok: true, tower };
  }

  upgradeTower(instanceId: string): UpgradeResult {
    const tower = this.towers.get(instanceId);
    if (!tower) return { ok: false, reason: 'Tower not found' };

    const config = this.configs[tower.configId];
    const upgrade = config.upgrades.find((u) => u.tier === tower.tier + 1);
    if (!upgrade) return { ok: false, reason: 'Already at max tier' };

    tower.tier = upgrade.tier;
    const current = this.towerInvestment.get(instanceId) ?? 0;
    this.towerInvestment.set(instanceId, current + upgrade.costGold);

    return { ok: true, newTier: tower.tier, cost: upgrade.costGold };
  }

  sellTower(instanceId: string): SellResult {
    const tower = this.towers.get(instanceId);
    if (!tower) return { ok: false, reason: 'Tower not found' };

    const invested = this.towerInvestment.get(instanceId) ?? 0;
    const refund = Math.floor(invested * TOWER_SELL_REFUND_PERCENT);

    this.towers.delete(instanceId);
    this.occupiedTiles.delete(this.tileKey(tower.x, tower.y));
    this.towerInvestment.delete(instanceId);

    return { ok: true, goldRefund: refund };
  }

  getTower(instanceId: string): TowerState | undefined {
    return this.towers.get(instanceId);
  }

  getAllTowers(): TowerState[] {
    return Array.from(this.towers.values());
  }

  getTowersAsRecord(): Record<string, TowerState> {
    const record: Record<string, TowerState> = {};
    for (const [id, tower] of this.towers) {
      record[id] = tower;
    }
    return record;
  }

  getUpgradeCost(instanceId: string): number | null {
    const tower = this.towers.get(instanceId);
    if (!tower) return null;
    const config = this.configs[tower.configId];
    const upgrade = config.upgrades.find((u) => u.tier === tower.tier + 1);
    return upgrade?.costGold ?? null;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/server && pnpm test -- --run src/systems/TowerSystem.test.ts`
Expected: all tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/systems/TowerSystem.ts packages/server/src/systems/TowerSystem.test.ts
git commit -m "feat: add tower placement, upgrade, and sell system"
```

---

### Task 9: Enemy Pathing System

**Parallel:** yes (with Task 8)
**Blocked by:** Task 4
**Owned files:** `packages/server/src/systems/EnemySystem.ts`, `packages/server/src/systems/EnemySystem.test.ts`

**Files:**
- Create: `packages/server/src/systems/EnemySystem.ts`
- Create: `packages/server/src/systems/EnemySystem.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/systems/EnemySystem.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { EnemySystem } from './EnemySystem';
import type { Vec2 } from '@td/shared';

const waypoints: Vec2[] = [
  { x: 0, y: 5 },
  { x: 5, y: 5 },
  { x: 10, y: 5 },
  { x: 15, y: 5 },
];

describe('EnemySystem', () => {
  let system: EnemySystem;

  beforeEach(() => {
    system = new EnemySystem(waypoints);
  });

  it('spawns an enemy at the first waypoint', () => {
    const enemy = system.spawnEnemy('grunt', 100, 1.0, 0, ['ground']);
    expect(enemy.x).toBe(0);
    expect(enemy.y).toBe(5);
    expect(enemy.waypointIndex).toBe(0);
    expect(enemy.alive).toBe(true);
  });

  it('moves enemy toward next waypoint each tick', () => {
    const enemy = system.spawnEnemy('grunt', 100, 2.0, 0, ['ground']);
    system.update(1.0); // 1 second at speed 2 = 2 tiles
    expect(enemy.x).toBeGreaterThan(0);
    expect(enemy.waypointIndex).toBe(0); // still heading to wp 1
  });

  it('advances waypoint index when reaching a waypoint', () => {
    const enemy = system.spawnEnemy('grunt', 100, 10, 0, ['ground']);
    system.update(1.0); // speed 10, should reach multiple waypoints
    expect(enemy.waypointIndex).toBeGreaterThan(0);
  });

  it('marks enemy as reached-end when passing last waypoint', () => {
    const enemy = system.spawnEnemy('grunt', 100, 100, 0, ['ground']);
    system.update(1.0); // very fast, should reach end
    const leaked = system.getLeakedEnemies();
    expect(leaked.length).toBeGreaterThan(0);
  });

  it('damages an enemy', () => {
    const enemy = system.spawnEnemy('grunt', 100, 1, 0, ['ground']);
    system.damageEnemy(enemy.instanceId, 30);
    expect(enemy.hp).toBe(70);
  });

  it('kills an enemy when HP <= 0', () => {
    const enemy = system.spawnEnemy('grunt', 50, 1, 0, ['ground']);
    system.damageEnemy(enemy.instanceId, 60);
    expect(enemy.alive).toBe(false);
  });

  it('applies armor reduction to damage', () => {
    const enemy = system.spawnEnemy('grunt', 100, 1, 5, ['ground']);
    system.damageEnemy(enemy.instanceId, 20);
    // 20 - 5 armor = 15 damage, HP = 85
    expect(enemy.hp).toBe(85);
  });

  it('tracks alive enemy count', () => {
    system.spawnEnemy('grunt', 100, 1, 0, ['ground']);
    system.spawnEnemy('grunt', 100, 1, 0, ['ground']);
    expect(system.aliveCount).toBe(2);
    const enemies = system.getAliveEnemies();
    system.damageEnemy(enemies[0].instanceId, 200);
    expect(system.aliveCount).toBe(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/server && pnpm test -- --run src/systems/EnemySystem.test.ts`
Expected: FAIL

**Step 3: Implement EnemySystem**

```typescript
// packages/server/src/systems/EnemySystem.ts
import type { Vec2, EnemyState, EnemyType, EnemyStatus } from '@td/shared';

let nextEnemyId = 1;

export class EnemySystem {
  private waypoints: Vec2[];
  private enemies: Map<string, EnemyState> = new Map();
  private leakedEnemies: EnemyState[] = [];

  constructor(waypoints: Vec2[]) {
    this.waypoints = waypoints;
  }

  spawnEnemy(type: EnemyType, hp: number, speed: number, armor: number, tags: string[]): EnemyState {
    const spawn = this.waypoints[0];
    const instanceId = `enemy_${nextEnemyId++}`;
    const enemy: EnemyState = {
      instanceId,
      type,
      hp,
      maxHp: hp,
      speed,
      armor,
      x: spawn.x,
      y: spawn.y,
      waypointIndex: 0,
      progress: 0,
      statuses: [],
      alive: true,
    };
    this.enemies.set(instanceId, enemy);
    return enemy;
  }

  update(dt: number): void {
    this.leakedEnemies = [];

    for (const enemy of this.enemies.values()) {
      if (!enemy.alive) continue;
      this.moveEnemy(enemy, dt);
      this.updateStatuses(enemy, dt);
    }
  }

  private moveEnemy(enemy: EnemyState, dt: number): void {
    let remainingDistance = enemy.speed * dt;

    while (remainingDistance > 0) {
      const nextWpIndex = enemy.waypointIndex + 1;
      if (nextWpIndex >= this.waypoints.length) {
        this.leakedEnemies.push(enemy);
        enemy.alive = false;
        return;
      }

      const target = this.waypoints[nextWpIndex];
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= remainingDistance) {
        enemy.x = target.x;
        enemy.y = target.y;
        enemy.waypointIndex = nextWpIndex;
        enemy.progress = 0;
        remainingDistance -= dist;
      } else {
        const ratio = remainingDistance / dist;
        enemy.x += dx * ratio;
        enemy.y += dy * ratio;
        const totalSegDist = Math.sqrt(
          (target.x - this.waypoints[enemy.waypointIndex].x) ** 2 +
          (target.y - this.waypoints[enemy.waypointIndex].y) ** 2,
        );
        enemy.progress = totalSegDist > 0 ? 1 - ((dist - remainingDistance) / totalSegDist) : 0;
        remainingDistance = 0;
      }
    }
  }

  private updateStatuses(enemy: EnemyState, dt: number): void {
    for (let i = enemy.statuses.length - 1; i >= 0; i--) {
      enemy.statuses[i].remainingSec -= dt;
      if (enemy.statuses[i].remainingSec <= 0) {
        enemy.statuses.splice(i, 1);
      }
    }
  }

  damageEnemy(instanceId: string, rawDamage: number): number {
    const enemy = this.enemies.get(instanceId);
    if (!enemy || !enemy.alive) return 0;

    const effectiveDamage = Math.max(1, rawDamage - enemy.armor);
    enemy.hp -= effectiveDamage;

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.alive = false;
    }

    return effectiveDamage;
  }

  applyStatus(instanceId: string, status: EnemyStatus): void {
    const enemy = this.enemies.get(instanceId);
    if (!enemy || !enemy.alive) return;

    const existing = enemy.statuses.find((s) => s.type === status.type);
    if (existing) {
      existing.stacks = Math.min(existing.stacks + status.stacks, 10);
      existing.remainingSec = Math.max(existing.remainingSec, status.remainingSec);
    } else {
      enemy.statuses.push({ ...status });
    }
  }

  getEnemy(instanceId: string): EnemyState | undefined {
    return this.enemies.get(instanceId);
  }

  getAliveEnemies(): EnemyState[] {
    return Array.from(this.enemies.values()).filter((e) => e.alive);
  }

  getLeakedEnemies(): EnemyState[] {
    return this.leakedEnemies;
  }

  get aliveCount(): number {
    return this.getAliveEnemies().length;
  }

  getEnemiesAsRecord(): Record<string, EnemyState> {
    const record: Record<string, EnemyState> = {};
    for (const [id, enemy] of this.enemies) {
      record[id] = enemy;
    }
    return record;
  }

  clearDead(): void {
    for (const [id, enemy] of this.enemies) {
      if (!enemy.alive) this.enemies.delete(id);
    }
  }

  hasEnemyStatus(instanceId: string, statusType: string): boolean {
    const enemy = this.enemies.get(instanceId);
    if (!enemy) return false;
    return enemy.statuses.some((s) => s.type === statusType);
  }

  removeStatus(instanceId: string, statusType: string): void {
    const enemy = this.enemies.get(instanceId);
    if (!enemy) return;
    enemy.statuses = enemy.statuses.filter((s) => s.type !== statusType);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/server && pnpm test -- --run src/systems/EnemySystem.test.ts`
Expected: all tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/systems/EnemySystem.ts packages/server/src/systems/EnemySystem.test.ts
git commit -m "feat: add enemy pathing system with waypoint movement and damage"
```

---

### Task 10: Tower Targeting and Combat System

**Parallel:** no
**Blocked by:** Task 8, Task 9
**Owned files:** `packages/server/src/systems/CombatSystem.ts`, `packages/server/src/systems/CombatSystem.test.ts`

**Files:**
- Create: `packages/server/src/systems/CombatSystem.ts`
- Create: `packages/server/src/systems/CombatSystem.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/systems/CombatSystem.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CombatSystem } from './CombatSystem';
import type { TowerState, EnemyState, TowerConfig } from '@td/shared';

const arrowConfig: TowerConfig = {
  id: 'arrow_tower',
  name: 'Arrow Tower',
  class: 'shared',
  category: 'basic',
  roles: ['damage'],
  costGold: 50,
  range: 3,
  attackPeriodSec: 1.0,
  baseDamage: 10,
  targets: 'ground',
  upgrades: [],
};

const flameConfig: TowerConfig = {
  id: 'flame_spire',
  name: 'Flame Spire',
  class: 'fire',
  category: 'specialty',
  roles: ['aoe', 'damage'],
  costGold: 120,
  range: 3.5,
  attackPeriodSec: 1.2,
  baseDamage: 22,
  splashRadius: 1.5,
  onHit: [{ type: 'dot', element: 'fire', dps: 3, durationSec: 4 }],
  targets: 'ground',
  upgrades: [],
};

function makeTower(config: TowerConfig, x: number, y: number): TowerState {
  return { instanceId: `t_${x}_${y}`, configId: config.id, ownerId: 'p1', tier: 1, x, y, lastAttackTick: 0 };
}

function makeEnemy(id: string, x: number, y: number, hp = 100, tags = ['ground']): EnemyState {
  return {
    instanceId: id, type: 'grunt', hp, maxHp: hp, speed: 1, armor: 0,
    x, y, waypointIndex: 0, progress: 0, statuses: [], alive: true,
  };
}

describe('CombatSystem', () => {
  let system: CombatSystem;
  const configs = { arrow_tower: arrowConfig, flame_spire: flameConfig };

  beforeEach(() => {
    system = new CombatSystem(configs);
  });

  it('finds closest enemy in range', () => {
    const tower = makeTower(arrowConfig, 5, 5);
    const near = makeEnemy('e1', 6, 5); // dist 1
    const far = makeEnemy('e2', 9, 5); // dist 4, out of range (3)
    const target = system.findTarget(tower, [near, far]);
    expect(target?.instanceId).toBe('e1');
  });

  it('returns null if no enemy in range', () => {
    const tower = makeTower(arrowConfig, 5, 5);
    const far = makeEnemy('e1', 20, 20);
    const target = system.findTarget(tower, [far]);
    expect(target).toBeNull();
  });

  it('skips dead enemies', () => {
    const tower = makeTower(arrowConfig, 5, 5);
    const dead = makeEnemy('e1', 6, 5);
    dead.alive = false;
    const target = system.findTarget(tower, [dead]);
    expect(target).toBeNull();
  });

  it('respects target type — ground tower does not target air', () => {
    const tower = makeTower(arrowConfig, 5, 5); // targets: ground
    const flyer = makeEnemy('e1', 6, 5, 100, ['air']);
    const target = system.findTarget(tower, [flyer]);
    expect(target).toBeNull();
  });

  it('determines if tower can fire based on attack period', () => {
    const tower = makeTower(arrowConfig, 5, 5);
    tower.lastAttackTick = 0;
    // attackPeriodSec = 1.0 at 20 ticks/sec = 20 ticks
    expect(system.canFire(tower, 20)).toBe(true);
    expect(system.canFire(tower, 10)).toBe(false);
  });

  it('calculates splash targets', () => {
    const tower = makeTower(flameConfig, 5, 5);
    const target = makeEnemy('e1', 6, 5);
    const nearby = makeEnemy('e2', 6.5, 5); // within splash radius 1.5
    const farAway = makeEnemy('e3', 20, 20);
    const splashed = system.getSplashTargets(tower, target, [target, nearby, farAway]);
    expect(splashed).toContainEqual(expect.objectContaining({ instanceId: 'e2' }));
    expect(splashed).not.toContainEqual(expect.objectContaining({ instanceId: 'e3' }));
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/server && pnpm test -- --run src/systems/CombatSystem.test.ts`
Expected: FAIL

**Step 3: Implement CombatSystem**

```typescript
// packages/server/src/systems/CombatSystem.ts
import type { TowerState, EnemyState, TowerConfig, OnHitEffect } from '@td/shared';
import { TICK_RATE } from '@td/shared';

export interface AttackResult {
  towerId: string;
  targetId: string;
  damage: number;
  splashTargetIds: string[];
  onHitEffects: OnHitEffect[];
}

export class CombatSystem {
  private configs: Record<string, TowerConfig>;

  constructor(configs: Record<string, TowerConfig>) {
    this.configs = configs;
  }

  private distance(ax: number, ay: number, bx: number, by: number): number {
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
  }

  findTarget(tower: TowerState, enemies: EnemyState[]): EnemyState | null {
    const config = this.configs[tower.configId];
    if (!config) return null;

    let closest: EnemyState | null = null;
    let closestDist = Infinity;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      // Check target type compatibility
      const enemyIsAir = enemy.statuses?.some(s => s.type === 'air') ||
        (enemy as unknown as { type: string }).type === 'flyer';
      // Use tags from the spawn data — stored as a custom check
      // For simplicity, check if tower targets match enemy
      if (config.targets === 'ground' && this.isAirEnemy(enemy)) continue;
      if (config.targets === 'air' && !this.isAirEnemy(enemy)) continue;

      const dist = this.distance(tower.x, tower.y, enemy.x, enemy.y);
      if (dist <= config.range && dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    }

    return closest;
  }

  private isAirEnemy(enemy: EnemyState): boolean {
    // Flyers are air enemies
    return enemy.type === 'flyer';
  }

  canFire(tower: TowerState, currentTick: number): boolean {
    const config = this.configs[tower.configId];
    if (!config) return false;
    const ticksBetweenAttacks = Math.floor(config.attackPeriodSec * TICK_RATE);
    return currentTick - tower.lastAttackTick >= ticksBetweenAttacks;
  }

  getDamage(tower: TowerState): number {
    const config = this.configs[tower.configId];
    if (!config) return 0;

    let damage = config.baseDamage;

    // Apply upgrade deltas
    for (const upgrade of config.upgrades) {
      if (upgrade.tier <= tower.tier && upgrade.tier > 1) {
        const dmgDelta = upgrade.deltas['baseDamage'];
        if (typeof dmgDelta === 'string' && dmgDelta.startsWith('+')) {
          damage += parseFloat(dmgDelta.slice(1));
        } else if (typeof dmgDelta === 'number') {
          damage += dmgDelta;
        }
      }
    }

    return damage;
  }

  getSplashTargets(tower: TowerState, primary: EnemyState, allEnemies: EnemyState[]): EnemyState[] {
    const config = this.configs[tower.configId];
    if (!config?.splashRadius) return [];

    return allEnemies.filter((e) => {
      if (!e.alive || e.instanceId === primary.instanceId) return false;
      return this.distance(primary.x, primary.y, e.x, e.y) <= config.splashRadius!;
    });
  }

  getOnHitEffects(tower: TowerState): OnHitEffect[] {
    const config = this.configs[tower.configId];
    return config?.onHit ?? [];
  }

  processAttack(tower: TowerState, enemies: EnemyState[], currentTick: number): AttackResult | null {
    if (!this.canFire(tower, currentTick)) return null;

    const target = this.findTarget(tower, enemies);
    if (!target) return null;

    tower.lastAttackTick = currentTick;
    tower.currentTarget = target.instanceId;
    const damage = this.getDamage(tower);
    const splashTargets = this.getSplashTargets(tower, target, enemies);

    return {
      towerId: tower.instanceId,
      targetId: target.instanceId,
      damage,
      splashTargetIds: splashTargets.map((e) => e.instanceId),
      onHitEffects: this.getOnHitEffects(tower),
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/server && pnpm test -- --run src/systems/CombatSystem.test.ts`
Expected: all tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/systems/CombatSystem.ts packages/server/src/systems/CombatSystem.test.ts
git commit -m "feat: add tower targeting and combat system"
```

---

### Task 11: Elemental Reaction System

**Parallel:** no
**Blocked by:** Task 9, Task 10
**Owned files:** `packages/server/src/systems/ReactionSystem.ts`, `packages/server/src/systems/ReactionSystem.test.ts`

**Files:**
- Create: `packages/server/src/systems/ReactionSystem.ts`
- Create: `packages/server/src/systems/ReactionSystem.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/systems/ReactionSystem.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ReactionSystem } from './ReactionSystem';
import type { EnemyState, ReactionConfig } from '@td/shared';

const reactions: ReactionConfig[] = [
  {
    id: 'vaporize',
    triggerElement: 'fire',
    requiredStatus: 'soaked',
    effect: { type: 'damage_multiplier', value: 1.5 },
    consumesStatus: true,
    sound: 'sfx_vaporize',
    vfx: 'vfx_steam_burst',
  },
  {
    id: 'freeze',
    triggerElement: 'ice',
    requiredStatus: 'soaked',
    effect: { type: 'apply_status', value: 0, durationSec: 3 },
    consumesStatus: true,
    sound: 'sfx_freeze',
    vfx: 'vfx_freeze',
  },
  {
    id: 'melt',
    triggerElement: 'fire',
    requiredStatus: 'frozen',
    effect: { type: 'damage_multiplier', value: 2.0 },
    consumesStatus: true,
    sound: 'sfx_melt',
    vfx: 'vfx_melt',
  },
  {
    id: 'conflagration',
    triggerElement: 'fire',
    requiredStatus: 'toxin',
    effect: { type: 'aoe_burst', value: 50, aoeRadius: 2.0 },
    consumesStatus: true,
    sound: 'sfx_conflagration',
    vfx: 'vfx_conflagration',
  },
];

function makeEnemy(statuses: { type: string; element: string }[] = []): EnemyState {
  return {
    instanceId: 'e1', type: 'grunt', hp: 100, maxHp: 100, speed: 1, armor: 0,
    x: 5, y: 5, waypointIndex: 0, progress: 0, alive: true,
    statuses: statuses.map((s) => ({
      element: s.element as any,
      type: s.type,
      stacks: 1,
      remainingSec: 5,
    })),
  };
}

describe('ReactionSystem', () => {
  let system: ReactionSystem;

  beforeEach(() => {
    system = new ReactionSystem(reactions);
  });

  it('triggers Vaporize when fire hits soaked enemy', () => {
    const enemy = makeEnemy([{ type: 'soaked', element: 'water' }]);
    const result = system.checkReaction(enemy, 'fire', 20);
    expect(result).toBeDefined();
    expect(result!.reaction.id).toBe('vaporize');
    expect(result!.damage).toBe(30); // 20 * 1.5 = 30
  });

  it('does not trigger when enemy lacks required status', () => {
    const enemy = makeEnemy([]);
    const result = system.checkReaction(enemy, 'fire', 20);
    expect(result).toBeNull();
  });

  it('triggers Freeze when ice hits soaked enemy', () => {
    const enemy = makeEnemy([{ type: 'soaked', element: 'water' }]);
    const result = system.checkReaction(enemy, 'ice', 10);
    expect(result).toBeDefined();
    expect(result!.reaction.id).toBe('freeze');
  });

  it('triggers Melt when fire hits frozen enemy', () => {
    const enemy = makeEnemy([{ type: 'frozen', element: 'ice' }]);
    const result = system.checkReaction(enemy, 'fire', 20);
    expect(result).toBeDefined();
    expect(result!.reaction.id).toBe('melt');
    expect(result!.damage).toBe(40); // 20 * 2.0
  });

  it('triggers Conflagration when fire hits toxin enemy', () => {
    const enemy = makeEnemy([{ type: 'toxin', element: 'poison' }]);
    const result = system.checkReaction(enemy, 'fire', 20);
    expect(result).toBeDefined();
    expect(result!.reaction.id).toBe('conflagration');
  });

  it('consumes status when consumesStatus is true', () => {
    const enemy = makeEnemy([{ type: 'soaked', element: 'water' }]);
    system.checkReaction(enemy, 'fire', 20);
    expect(enemy.statuses.find((s) => s.type === 'soaked')).toBeUndefined();
  });

  it('prioritizes Melt over Vaporize (frozen check before soaked)', () => {
    const enemy = makeEnemy([
      { type: 'soaked', element: 'water' },
      { type: 'frozen', element: 'ice' },
    ]);
    const result = system.checkReaction(enemy, 'fire', 20);
    expect(result!.reaction.id).toBe('melt');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/server && pnpm test -- --run src/systems/ReactionSystem.test.ts`
Expected: FAIL

**Step 3: Implement ReactionSystem**

```typescript
// packages/server/src/systems/ReactionSystem.ts
import type { EnemyState, ReactionConfig, ElementType, ReactionType } from '@td/shared';

export interface ReactionResult {
  reaction: ReactionConfig;
  damage: number;
  aoeRadius?: number;
  applyStatus?: string;
  statusDuration?: number;
}

// Priority order: higher-value reactions first
const REACTION_PRIORITY: Record<string, number> = {
  melt: 10,
  conflagration: 9,
  vaporize: 8,
  freeze: 7,
  shatter: 6,
  blight: 5,
  frostburn: 4,
  steam_burst: 3,
};

export class ReactionSystem {
  private reactions: ReactionConfig[];

  constructor(reactions: ReactionConfig[]) {
    this.reactions = reactions.sort(
      (a, b) => (REACTION_PRIORITY[b.id] ?? 0) - (REACTION_PRIORITY[a.id] ?? 0),
    );
  }

  checkReaction(enemy: EnemyState, triggerElement: ElementType, baseDamage: number): ReactionResult | null {
    for (const reaction of this.reactions) {
      if (reaction.triggerElement !== triggerElement) continue;

      const statusIndex = enemy.statuses.findIndex((s) => s.type === reaction.requiredStatus);
      if (statusIndex === -1) continue;

      let damage = baseDamage;
      let applyStatus: string | undefined;
      let statusDuration: number | undefined;

      switch (reaction.effect.type) {
        case 'damage_multiplier':
          damage = Math.round(baseDamage * reaction.effect.value);
          break;
        case 'aoe_burst':
          damage = reaction.effect.value;
          break;
        case 'apply_status':
          applyStatus = 'frozen';
          statusDuration = reaction.effect.durationSec;
          damage = 0;
          break;
      }

      if (reaction.consumesStatus) {
        enemy.statuses.splice(statusIndex, 1);
      }

      return {
        reaction,
        damage,
        aoeRadius: reaction.effect.aoeRadius,
        applyStatus,
        statusDuration,
      };
    }

    return null;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/server && pnpm test -- --run src/systems/ReactionSystem.test.ts`
Expected: all tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/systems/ReactionSystem.ts packages/server/src/systems/ReactionSystem.test.ts
git commit -m "feat: add elemental reaction system with 4 core reactions"
```

---

### Task 12: Game Simulation Orchestrator

**Parallel:** no
**Blocked by:** Task 5, Task 6, Task 7, Task 8, Task 9, Task 10, Task 11
**Owned files:** `packages/server/src/game/GameSimulation.ts`, `packages/server/src/game/GameSimulation.test.ts`

**Files:**
- Create: `packages/server/src/game/GameSimulation.ts`
- Create: `packages/server/src/game/GameSimulation.test.ts`

This is the integration point that wires all server systems together for the per-tick game simulation.

**Step 1: Write failing tests**

```typescript
// packages/server/src/game/GameSimulation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameSimulation } from './GameSimulation';

describe('GameSimulation', () => {
  let sim: GameSimulation;

  beforeEach(() => {
    sim = GameSimulation.create('test-room');
    sim.addPlayer('p1', 'Trey');
    sim.selectClass('p1', 'fire');
  });

  it('starts in lobby phase', () => {
    expect(sim.state.phase).toBe('lobby');
  });

  it('transitions to prep phase when all players ready', () => {
    sim.readyUp('p1');
    sim.startGame();
    expect(sim.state.phase).toBe('prep');
  });

  it('grants starting gold on game start', () => {
    sim.readyUp('p1');
    sim.startGame();
    expect(sim.state.economy.gold).toBeGreaterThan(0);
  });

  it('allows tower placement during prep phase', () => {
    sim.readyUp('p1');
    sim.startGame();
    const result = sim.placeTower('p1', 'arrow_tower', 3, 4);
    expect(result.ok).toBe(true);
  });

  it('rejects tower placement if cannot afford', () => {
    sim.readyUp('p1');
    sim.startGame();
    // Drain gold
    while (sim.state.economy.gold >= 50) {
      sim.placeTower('p1', 'arrow_tower', Math.floor(Math.random() * 5) + 3, 4);
    }
    const result = sim.placeTower('p1', 'arrow_tower', 7, 10);
    expect(result.ok).toBe(false);
  });

  it('transitions to combat when wave starts', () => {
    sim.readyUp('p1');
    sim.startGame();
    sim.startWave();
    expect(sim.state.phase).toBe('combat');
  });

  it('applies base damage when enemies leak', () => {
    sim.readyUp('p1');
    sim.startGame();
    sim.startWave();
    // Simulate many ticks so enemies traverse the whole path
    for (let i = 0; i < 2000; i++) {
      sim.tick(0.05);
    }
    expect(sim.state.baseHp).toBeLessThan(sim.state.maxBaseHp);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/server && pnpm test -- --run src/game/GameSimulation.test.ts`
Expected: FAIL

**Step 3: Implement GameSimulation**

This class is the integration hub. It composes all the systems from Tasks 4-11. The implementation should:

- Hold instances of `GameRoom`, `EconomySystem`, `WaveScheduler`, `TowerSystem`, `EnemySystem`, `CombatSystem`, `ReactionSystem`
- Expose `tick(dt)` method called by `GameLoop`
- During combat tick: move enemies, process tower attacks, check reactions, apply damage, detect leaks, check wave completion
- During prep tick: count down prep timer
- Handle phase transitions: prep -> combat -> post_wave -> prep (loop) or victory/defeat

```typescript
// packages/server/src/game/GameSimulation.ts
import { GameRoom } from '../rooms/GameRoom';
import { EconomySystem } from '../systems/EconomySystem';
import { WaveScheduler } from '../systems/WaveScheduler';
import { TowerSystem } from '../systems/TowerSystem';
import { EnemySystem } from '../systems/EnemySystem';
import { CombatSystem } from '../systems/CombatSystem';
import { ReactionSystem } from '../systems/ReactionSystem';
import type {
  GameState, GamePhase, ElementType, TowerState,
  WaveConfig, TowerConfig, MapConfig, ReactionConfig, Vec2,
} from '@td/shared';
import { PREP_PHASE_DURATION_SEC, TICK_RATE } from '@td/shared';

// Default configs — will be loaded from data files in Phase 6
import { getDefaultMap, getDefaultTowerConfigs, getDefaultWaveConfigs, getDefaultReactionConfigs } from '../data/defaults';

interface CommandResult {
  ok: boolean;
  tower?: TowerState;
  reason?: string;
}

export class GameSimulation {
  private room: GameRoom;
  private economy: EconomySystem;
  private waveScheduler: WaveScheduler;
  private towerSystem: TowerSystem;
  private enemySystem: EnemySystem;
  private combatSystem: CombatSystem;
  private reactionSystem: ReactionSystem;
  private map: MapConfig;
  private spawnQueue: { spawnAtSec: number; enemyType: string; hp: number; speed: number; armor: number; tags: string[] }[] = [];
  private waveElapsedSec: number = 0;

  private constructor(
    room: GameRoom,
    map: MapConfig,
    towerConfigs: Record<string, TowerConfig>,
    waveConfigs: WaveConfig[],
    reactionConfigs: ReactionConfig[],
  ) {
    this.room = room;
    this.map = map;
    this.economy = new EconomySystem();
    this.waveScheduler = new WaveScheduler(waveConfigs);
    this.towerSystem = new TowerSystem(towerConfigs, map);
    this.enemySystem = new EnemySystem(map.waypoints);
    this.combatSystem = new CombatSystem(towerConfigs);
    this.reactionSystem = new ReactionSystem(reactionConfigs);
  }

  static create(roomId: string): GameSimulation {
    const room = new GameRoom(roomId);
    return new GameSimulation(
      room,
      getDefaultMap(),
      getDefaultTowerConfigs(),
      getDefaultWaveConfigs(),
      getDefaultReactionConfigs(),
    );
  }

  get state(): GameState {
    return {
      ...this.room.state,
      economy: this.economy.state,
      towers: this.towerSystem.getTowersAsRecord(),
      enemies: this.enemySystem.getEnemiesAsRecord(),
    };
  }

  addPlayer(id: string, name: string) { return this.room.addPlayer(id, name); }
  removePlayer(id: string) { this.room.removePlayer(id); }
  selectClass(id: string, cls: ElementType) { return this.room.selectClass(id, cls); }
  readyUp(id: string) { return this.room.readyUp(id); }

  startGame(): void {
    this.economy.grantStartingGold(this.room.playerCount);
    this.room.state.phase = 'prep';
    this.room.state.prepTimeRemaining = PREP_PHASE_DURATION_SEC;
    this.room.state.maxWaves = this.waveScheduler.totalWaves;
  }

  placeTower(playerId: string, configId: string, x: number, y: number): CommandResult {
    // Check cost — look up from tower configs
    const cost = this.getCostForTower(configId);
    if (cost === null) return { ok: false, reason: 'Unknown tower' };
    if (!this.economy.canAfford(cost)) return { ok: false, reason: 'Not enough gold' };

    const result = this.towerSystem.placeTower(configId, x, y, playerId);
    if (result.ok) {
      this.economy.spendGold(cost);
    }
    return result;
  }

  private getCostForTower(configId: string): number | null {
    const configs = getDefaultTowerConfigs();
    return configs[configId]?.costGold ?? null;
  }

  startWave(): void {
    if (!this.waveScheduler.hasMoreWaves()) return;
    this.waveScheduler.advance();
    this.room.state.wave = this.waveScheduler.currentWave;
    this.room.state.phase = 'combat';
    this.spawnQueue = this.waveScheduler.getSpawnEvents(this.room.playerCount) as any[];
    this.waveElapsedSec = 0;
  }

  tick(dt: number): void {
    const phase = this.room.state.phase;

    if (phase === 'prep') {
      this.room.state.prepTimeRemaining -= dt;
      if (this.room.state.prepTimeRemaining <= 0) {
        this.startWave();
      }
    } else if (phase === 'combat') {
      this.tickCombat(dt);
    }

    this.room.state.tick++;
  }

  private tickCombat(dt: number): void {
    this.waveElapsedSec += dt;

    // Spawn enemies from queue
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].spawnAtSec <= this.waveElapsedSec) {
      const spawn = this.spawnQueue.shift()!;
      this.enemySystem.spawnEnemy(
        spawn.enemyType as any,
        spawn.hp,
        spawn.speed,
        spawn.armor,
        spawn.tags,
      );
    }

    // Move enemies
    this.enemySystem.update(dt);

    // Process tower attacks
    const enemies = this.enemySystem.getAliveEnemies();
    const towers = this.towerSystem.getAllTowers();

    for (const tower of towers) {
      const attack = this.combatSystem.processAttack(tower, enemies, this.room.state.tick);
      if (!attack) continue;

      // Apply damage to primary target
      this.enemySystem.damageEnemy(attack.targetId, attack.damage);

      // Apply on-hit effects (elemental statuses)
      for (const effect of attack.onHitEffects) {
        if (effect.element) {
          this.enemySystem.applyStatus(attack.targetId, {
            element: effect.element,
            type: this.elementToStatusType(effect.element),
            stacks: 1,
            remainingSec: effect.durationSec ?? 5,
          });
        }
      }

      // Check for reactions on primary target
      const enemy = this.enemySystem.getEnemy(attack.targetId);
      if (enemy && enemy.alive && attack.onHitEffects.length > 0) {
        const triggerElement = attack.onHitEffects[0].element;
        if (triggerElement) {
          this.reactionSystem.checkReaction(enemy, triggerElement, attack.damage);
        }
      }

      // Apply splash damage
      for (const splashId of attack.splashTargetIds) {
        this.enemySystem.damageEnemy(splashId, Math.floor(attack.damage * 0.5));
      }
    }

    // Handle leaked enemies
    const leaked = this.enemySystem.getLeakedEnemies();
    for (const _enemy of leaked) {
      this.room.state.baseHp -= 1;
    }

    // Check defeat
    if (this.room.state.baseHp <= 0) {
      this.room.state.baseHp = 0;
      this.room.state.phase = 'defeat';
      return;
    }

    // Check wave complete
    if (
      this.spawnQueue.length === 0 &&
      this.enemySystem.aliveCount === 0
    ) {
      const waveConfig = this.waveScheduler.getCurrentWaveConfig();
      if (waveConfig) {
        this.economy.addWaveBonus(this.waveScheduler.currentWave, this.room.playerCount);
      }

      if (!this.waveScheduler.hasMoreWaves()) {
        this.room.state.phase = 'victory';
      } else {
        this.room.state.phase = 'prep';
        this.room.state.prepTimeRemaining = PREP_PHASE_DURATION_SEC;
      }
    }
  }

  private elementToStatusType(element: ElementType): string {
    switch (element) {
      case 'fire': return 'burning';
      case 'water': return 'soaked';
      case 'ice': return 'cold';
      case 'poison': return 'toxin';
    }
  }
}
```

**Step 4: Create default data stubs for compilation**

Create `packages/server/src/data/defaults.ts` with minimal stub data so the simulation can compile and tests pass. Full data populating happens in Phase 6 (Tasks 22-25).

```typescript
// packages/server/src/data/defaults.ts
import type { MapConfig, TowerConfig, WaveConfig, ReactionConfig } from '@td/shared';

export function getDefaultMap(): MapConfig {
  return {
    id: 'map_01',
    name: 'Forest Path',
    width: 20,
    height: 15,
    tileSize: 64,
    waypoints: [
      { x: 0, y: 7 }, { x: 5, y: 7 }, { x: 10, y: 3 },
      { x: 15, y: 3 }, { x: 15, y: 7 }, { x: 19, y: 7 },
    ],
    buildZones: [
      { x: 2, y: 4, width: 6, height: 2 },
      { x: 2, y: 9, width: 6, height: 2 },
      { x: 11, y: 0, width: 3, height: 2 },
      { x: 11, y: 5, width: 3, height: 2 },
      { x: 16, y: 4, width: 3, height: 2 },
      { x: 16, y: 9, width: 3, height: 2 },
    ],
    playerZones: [
      { id: 0, minPlayers: 1, buildZones: [0, 1] },
      { id: 1, minPlayers: 2, buildZones: [2, 3] },
      { id: 2, minPlayers: 3, buildZones: [4, 5] },
    ],
  };
}

export function getDefaultTowerConfigs(): Record<string, TowerConfig> {
  return {
    arrow_tower: {
      id: 'arrow_tower', name: 'Arrow Tower', class: 'shared', category: 'basic',
      roles: ['damage'], costGold: 50, range: 3, attackPeriodSec: 1.0,
      baseDamage: 10, targets: 'ground',
      upgrades: [
        { tier: 2, costGold: 40, deltas: { baseDamage: '+5' } },
        { tier: 3, costGold: 80, deltas: { baseDamage: '+10' } },
      ],
    },
    // Minimal stubs — full configs in Task 22
  };
}

export function getDefaultWaveConfigs(): WaveConfig[] {
  return [
    {
      wave: 1,
      groups: [{ enemyType: 'grunt', count: 6, hp: 50, speed: 1, armor: 0, tags: ['ground'], spawnIntervalSec: 0.5 }],
      bountyGold: 5, telegraph: 'Grunts approaching!',
    },
    {
      wave: 2,
      groups: [{ enemyType: 'grunt', count: 8, hp: 60, speed: 1, armor: 0, tags: ['ground'], spawnIntervalSec: 0.4 }],
      bountyGold: 5, telegraph: 'More grunts!',
    },
  ];
}

export function getDefaultReactionConfigs(): ReactionConfig[] {
  return [
    {
      id: 'vaporize', triggerElement: 'fire', requiredStatus: 'soaked',
      effect: { type: 'damage_multiplier', value: 1.5 }, consumesStatus: true,
      sound: 'sfx_vaporize', vfx: 'vfx_steam_burst',
    },
    {
      id: 'freeze', triggerElement: 'ice', requiredStatus: 'soaked',
      effect: { type: 'apply_status', value: 0, durationSec: 3 }, consumesStatus: true,
      sound: 'sfx_freeze', vfx: 'vfx_freeze',
    },
    {
      id: 'melt', triggerElement: 'fire', requiredStatus: 'frozen',
      effect: { type: 'damage_multiplier', value: 2.0 }, consumesStatus: true,
      sound: 'sfx_melt', vfx: 'vfx_melt',
    },
    {
      id: 'conflagration', triggerElement: 'fire', requiredStatus: 'toxin',
      effect: { type: 'aoe_burst', value: 50, aoeRadius: 2.0 }, consumesStatus: true,
      sound: 'sfx_conflagration', vfx: 'vfx_conflagration',
    },
  ];
}
```

**Step 5: Run tests to verify they pass**

Run: `cd packages/server && pnpm test -- --run src/game/GameSimulation.test.ts`
Expected: all tests PASS

**Step 6: Commit**

```bash
git add packages/server/src/game/GameSimulation.ts packages/server/src/game/GameSimulation.test.ts packages/server/src/data/defaults.ts
git commit -m "feat: add game simulation orchestrator wiring all server systems"
```

---

## Phase 4: Client Core — Rendering & Input

### Task 13: Phaser Scene Structure

**Parallel:** yes (with Tasks 14, 15)
**Blocked by:** Task 3
**Owned files:** `packages/client/src/scenes/BootScene.ts`, `packages/client/src/scenes/GameScene.ts`, `packages/client/src/scenes/HudScene.ts`, `packages/client/src/main.ts`

**Files:**
- Create: `packages/client/src/scenes/BootScene.ts`
- Create: `packages/client/src/scenes/GameScene.ts`
- Create: `packages/client/src/scenes/HudScene.ts`
- Modify: `packages/client/src/main.ts`

**Step 1: Create BootScene (asset loading)**

```typescript
// packages/client/src/scenes/BootScene.ts
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const bar = this.add.rectangle(width / 2, height / 2, 400, 30, 0x333333);
    const fill = this.add.rectangle(width / 2 - 198, height / 2, 4, 26, 0x00ff88);

    this.load.on('progress', (value: number) => {
      fill.width = 396 * value;
      fill.x = width / 2 - 198 + fill.width / 2;
    });

    // Placeholder assets — real sprites loaded later
    // Generate colored rectangles as placeholder tower/enemy textures
    this.createPlaceholderTextures();
  }

  private createPlaceholderTextures(): void {
    const colors: Record<string, number> = {
      tower_fire: 0xff4400,
      tower_water: 0x0088ff,
      tower_ice: 0x88ccff,
      tower_poison: 0x44cc44,
      tower_shared: 0xaaaaaa,
      enemy_grunt: 0xcc0000,
      enemy_runner: 0xff8800,
      enemy_tank: 0x880000,
      enemy_flyer: 0xcc00cc,
      enemy_invisible: 0x444444,
      enemy_boss: 0xff0000,
      tile_path: 0x665533,
      tile_build: 0x336633,
      tile_empty: 0x222222,
      projectile: 0xffff00,
    };

    for (const [key, color] of Object.entries(colors)) {
      const gfx = this.add.graphics();
      gfx.fillStyle(color);
      gfx.fillRect(0, 0, 64, 64);
      gfx.generateTexture(key, 64, 64);
      gfx.destroy();
    }
  }

  create(): void {
    this.scene.start('GameScene');
    this.scene.start('HudScene');
  }
}
```

**Step 2: Create GameScene (main game rendering)**

```typescript
// packages/client/src/scenes/GameScene.ts
import Phaser from 'phaser';
import type { GameState, Vec2 } from '@td/shared';
import { TILE_SIZE } from '@td/shared';

export class GameScene extends Phaser.Scene {
  private towerSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private enemySprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private mapTiles: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Camera setup
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Click handler for tower placement
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);
      this.events.emit('tile-clicked', tileX, tileY);
    });
  }

  renderMap(waypoints: Vec2[], buildZones: { x: number; y: number; width: number; height: number }[]): void {
    // Clear existing
    this.mapTiles.forEach((t) => t.destroy());
    this.mapTiles = [];

    // Draw build zones
    for (const zone of buildZones) {
      for (let x = zone.x; x < zone.x + zone.width; x++) {
        for (let y = zone.y; y < zone.y + zone.height; y++) {
          const tile = this.add.rectangle(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE - 2,
            TILE_SIZE - 2,
            0x336633,
            0.4,
          );
          this.mapTiles.push(tile);
        }
      }
    }

    // Draw path
    if (waypoints.length > 1) {
      const graphics = this.add.graphics();
      graphics.lineStyle(TILE_SIZE * 0.6, 0x665533, 0.8);
      graphics.beginPath();
      graphics.moveTo(waypoints[0].x * TILE_SIZE + TILE_SIZE / 2, waypoints[0].y * TILE_SIZE + TILE_SIZE / 2);
      for (let i = 1; i < waypoints.length; i++) {
        graphics.lineTo(waypoints[i].x * TILE_SIZE + TILE_SIZE / 2, waypoints[i].y * TILE_SIZE + TILE_SIZE / 2);
      }
      graphics.strokePath();
    }
  }

  syncState(state: GameState): void {
    this.syncTowers(state);
    this.syncEnemies(state);
  }

  private syncTowers(state: GameState): void {
    const currentIds = new Set(Object.keys(state.towers));

    // Remove sprites for towers that no longer exist
    for (const [id, sprite] of this.towerSprites) {
      if (!currentIds.has(id)) {
        sprite.destroy();
        this.towerSprites.delete(id);
      }
    }

    // Add/update sprites
    for (const [id, tower] of Object.entries(state.towers)) {
      let sprite = this.towerSprites.get(id);
      if (!sprite) {
        const textureKey = `tower_shared`; // Will map to element later
        sprite = this.add.sprite(
          tower.x * TILE_SIZE + TILE_SIZE / 2,
          tower.y * TILE_SIZE + TILE_SIZE / 2,
          textureKey,
        );
        sprite.setDisplaySize(TILE_SIZE - 4, TILE_SIZE - 4);
        this.towerSprites.set(id, sprite);
      }
      sprite.setPosition(tower.x * TILE_SIZE + TILE_SIZE / 2, tower.y * TILE_SIZE + TILE_SIZE / 2);
    }
  }

  private syncEnemies(state: GameState): void {
    const currentIds = new Set(Object.keys(state.enemies));

    for (const [id, sprite] of this.enemySprites) {
      if (!currentIds.has(id) || !state.enemies[id].alive) {
        sprite.destroy();
        this.enemySprites.delete(id);
      }
    }

    for (const [id, enemy] of Object.entries(state.enemies)) {
      if (!enemy.alive) continue;
      let sprite = this.enemySprites.get(id);
      if (!sprite) {
        sprite = this.add.sprite(
          enemy.x * TILE_SIZE + TILE_SIZE / 2,
          enemy.y * TILE_SIZE + TILE_SIZE / 2,
          `enemy_${enemy.type}`,
        );
        sprite.setDisplaySize(TILE_SIZE * 0.6, TILE_SIZE * 0.6);
        this.enemySprites.set(id, sprite);
      }
      // Position will be interpolated in Task 20
      sprite.setPosition(
        enemy.x * TILE_SIZE + TILE_SIZE / 2,
        enemy.y * TILE_SIZE + TILE_SIZE / 2,
      );
    }
  }
}
```

**Step 3: Create HudScene (overlay UI)**

```typescript
// packages/client/src/scenes/HudScene.ts
import Phaser from 'phaser';
import type { GameState } from '@td/shared';

export class HudScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'HudScene' });
  }

  create(): void {
    const style = { fontSize: '18px', color: '#ffffff', fontFamily: 'monospace' };
    this.goldText = this.add.text(10, 10, 'Gold: 0', style);
    this.waveText = this.add.text(10, 35, 'Wave: 0', style);
    this.hpText = this.add.text(10, 60, 'Base HP: 100', style);
    this.phaseText = this.add.text(10, 85, 'Phase: lobby', style);
  }

  syncState(state: GameState): void {
    this.goldText.setText(`Gold: ${state.economy.gold}`);
    this.waveText.setText(`Wave: ${state.wave} / ${state.maxWaves}`);
    this.hpText.setText(`Base HP: ${state.baseHp} / ${state.maxBaseHp}`);
    this.phaseText.setText(`Phase: ${state.phase}`);
  }
}
```

**Step 4: Update main.ts to register scenes**

```typescript
// packages/client/src/main.ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scene: [BootScene, GameScene, HudScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
```

**Step 5: Verify client compiles**

Run: `cd packages/client && pnpm typecheck`
Expected: no errors

**Step 6: Commit**

```bash
git add packages/client/src/
git commit -m "feat: add Phaser scene structure with boot, game, and HUD scenes"
```

---

### Task 14: Tower Placement UI

**Parallel:** yes (with Tasks 13, 15)
**Blocked by:** Task 3
**Owned files:** `packages/client/src/ui/TowerPanel.ts`, `packages/client/src/ui/GhostTower.ts`

**Files:**
- Create: `packages/client/src/ui/TowerPanel.ts`
- Create: `packages/client/src/ui/GhostTower.ts`

**Step 1: Create TowerPanel (tower selection sidebar)**

```typescript
// packages/client/src/ui/TowerPanel.ts
import Phaser from 'phaser';
import type { TowerConfig } from '@td/shared';

export interface TowerPanelEvents {
  onTowerSelected: (configId: string) => void;
}

export class TowerPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private buttons: Phaser.GameObjects.Container[] = [];
  private selectedId: string | null = null;
  private onSelect: (configId: string) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, onSelect: (id: string) => void) {
    this.scene = scene;
    this.container = scene.add.container(x, y);
    this.onSelect = onSelect;
  }

  setTowers(towers: TowerConfig[], availableGold: number): void {
    this.buttons.forEach((b) => b.destroy());
    this.buttons = [];

    towers.forEach((tower, i) => {
      const yOffset = i * 70;
      const canAfford = availableGold >= tower.costGold;
      const bg = this.scene.add.rectangle(0, yOffset, 200, 60, canAfford ? 0x334433 : 0x443333, 0.8);
      bg.setOrigin(0, 0);
      bg.setInteractive({ useHandCursor: true });

      const nameText = this.scene.add.text(10, yOffset + 8, tower.name, {
        fontSize: '14px', color: canAfford ? '#ffffff' : '#888888',
      });
      const costText = this.scene.add.text(10, yOffset + 30, `${tower.costGold}g`, {
        fontSize: '12px', color: canAfford ? '#ffcc00' : '#884400',
      });

      bg.on('pointerdown', () => {
        if (canAfford) {
          this.selectedId = tower.id;
          this.onSelect(tower.id);
        }
      });

      const btn = this.scene.add.container(0, 0, [bg, nameText, costText]);
      this.container.add(btn);
      this.buttons.push(btn);
    });
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  clearSelection(): void {
    this.selectedId = null;
  }

  destroy(): void {
    this.container.destroy();
  }
}
```

**Step 2: Create GhostTower (placement preview)**

```typescript
// packages/client/src/ui/GhostTower.ts
import Phaser from 'phaser';
import { TILE_SIZE } from '@td/shared';

export class GhostTower {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Rectangle | null = null;
  private rangeCircle: Phaser.GameObjects.Arc | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(tileX: number, tileY: number, range: number, valid: boolean): void {
    this.hide();

    const x = tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = tileY * TILE_SIZE + TILE_SIZE / 2;

    this.sprite = this.scene.add.rectangle(x, y, TILE_SIZE - 4, TILE_SIZE - 4, valid ? 0x00ff00 : 0xff0000, 0.5);
    this.rangeCircle = this.scene.add.circle(x, y, range * TILE_SIZE, 0xffffff, 0.1);
    this.rangeCircle.setStrokeStyle(1, valid ? 0x00ff00 : 0xff0000, 0.5);
  }

  hide(): void {
    this.sprite?.destroy();
    this.rangeCircle?.destroy();
    this.sprite = null;
    this.rangeCircle = null;
  }

  destroy(): void {
    this.hide();
  }
}
```

**Step 3: Verify typecheck**

Run: `cd packages/client && pnpm typecheck`
Expected: no errors

**Step 4: Commit**

```bash
git add packages/client/src/ui/
git commit -m "feat: add tower selection panel and ghost placement preview"
```

---

### Task 15: Enemy Health Bars & Status Indicators

**Parallel:** yes (with Tasks 13, 14)
**Blocked by:** Task 3
**Owned files:** `packages/client/src/ui/HealthBar.ts`, `packages/client/src/ui/StatusIndicator.ts`

**Files:**
- Create: `packages/client/src/ui/HealthBar.ts`
- Create: `packages/client/src/ui/StatusIndicator.ts`

**Step 1: Create HealthBar**

```typescript
// packages/client/src/ui/HealthBar.ts
import Phaser from 'phaser';

export class HealthBar {
  private bg: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number, width = 40, height = 5) {
    this.scene = scene;
    this.bg = scene.add.rectangle(x, y, width, height, 0x333333);
    this.fill = scene.add.rectangle(x, y, width, height, 0x00ff00);
    this.bg.setOrigin(0.5, 0.5);
    this.fill.setOrigin(0.5, 0.5);
    this.bg.setDepth(10);
    this.fill.setDepth(11);
  }

  update(x: number, y: number, hpPercent: number): void {
    this.bg.setPosition(x, y - 20);
    this.fill.setPosition(x, y - 20);
    this.fill.setScale(Math.max(0, hpPercent), 1);

    if (hpPercent > 0.6) this.fill.setFillStyle(0x00ff00);
    else if (hpPercent > 0.3) this.fill.setFillStyle(0xffcc00);
    else this.fill.setFillStyle(0xff0000);
  }

  destroy(): void {
    this.bg.destroy();
    this.fill.destroy();
  }
}
```

**Step 2: Create StatusIndicator**

```typescript
// packages/client/src/ui/StatusIndicator.ts
import Phaser from 'phaser';
import type { EnemyStatus } from '@td/shared';

const STATUS_COLORS: Record<string, number> = {
  burning: 0xff4400,
  soaked: 0x0088ff,
  cold: 0x88ccff,
  frozen: 0xaaddff,
  toxin: 0x44cc44,
};

export class StatusIndicator {
  private dots: Phaser.GameObjects.Arc[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(x: number, y: number, statuses: EnemyStatus[]): void {
    this.clear();

    statuses.forEach((status, i) => {
      const color = STATUS_COLORS[status.type] ?? 0xffffff;
      const dot = this.scene.add.circle(x - 10 + i * 8, y - 28, 3, color);
      dot.setDepth(12);
      this.dots.push(dot);
    });
  }

  clear(): void {
    this.dots.forEach((d) => d.destroy());
    this.dots = [];
  }

  destroy(): void {
    this.clear();
  }
}
```

**Step 3: Commit**

```bash
git add packages/client/src/ui/HealthBar.ts packages/client/src/ui/StatusIndicator.ts
git commit -m "feat: add enemy health bars and elemental status indicators"
```

---

### Task 16: Reaction Visual Effects

**Parallel:** no
**Blocked by:** Task 13
**Owned files:** `packages/client/src/effects/ReactionVFX.ts`

**Files:**
- Create: `packages/client/src/effects/ReactionVFX.ts`

**Step 1: Create ReactionVFX**

```typescript
// packages/client/src/effects/ReactionVFX.ts
import Phaser from 'phaser';
import type { ReactionType } from '@td/shared';
import { TILE_SIZE } from '@td/shared';

const REACTION_VISUALS: Record<string, { color: number; scale: number; text: string }> = {
  vaporize: { color: 0xffffff, scale: 1.2, text: 'Vaporize!' },
  freeze: { color: 0x88ccff, scale: 1.0, text: 'Freeze!' },
  melt: { color: 0xff8800, scale: 1.5, text: 'Melt!' },
  conflagration: { color: 0xff2200, scale: 2.0, text: 'Conflagration!' },
  shatter: { color: 0xaaddff, scale: 1.8, text: 'Shatter!' },
  steam_burst: { color: 0xcccccc, scale: 1.3, text: 'Steam!' },
  blight: { color: 0x88cc00, scale: 1.2, text: 'Blight!' },
  frostburn: { color: 0x44aacc, scale: 1.3, text: 'Frostburn!' },
};

export class ReactionVFX {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  play(reaction: ReactionType, worldX: number, worldY: number): void {
    const visual = REACTION_VISUALS[reaction];
    if (!visual) return;

    // Flash circle
    const circle = this.scene.add.circle(worldX, worldY, TILE_SIZE * visual.scale * 0.5, visual.color, 0.6);
    circle.setDepth(20);
    this.scene.tweens.add({
      targets: circle,
      alpha: 0,
      scaleX: visual.scale * 1.5,
      scaleY: visual.scale * 1.5,
      duration: 400,
      onComplete: () => circle.destroy(),
    });

    // Floating text
    const text = this.scene.add.text(worldX, worldY - 30, visual.text, {
      fontSize: '14px',
      color: `#${visual.color.toString(16).padStart(6, '0')}`,
      fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5, 0.5);
    text.setDepth(21);
    this.scene.tweens.add({
      targets: text,
      y: worldY - 60,
      alpha: 0,
      duration: 800,
      onComplete: () => text.destroy(),
    });

    // Screen shake for big reactions
    if (reaction === 'conflagration' || reaction === 'shatter' || reaction === 'melt') {
      this.scene.cameras.main.shake(150, 0.005);
    }
  }
}
```

**Step 2: Commit**

```bash
git add packages/client/src/effects/
git commit -m "feat: add elemental reaction visual effects"
```

---

### Task 17: Projectile Renderer

**Parallel:** no
**Blocked by:** Task 13
**Owned files:** `packages/client/src/effects/ProjectilePool.ts`

**Files:**
- Create: `packages/client/src/effects/ProjectilePool.ts`

**Step 1: Create ProjectilePool**

```typescript
// packages/client/src/effects/ProjectilePool.ts
import Phaser from 'phaser';

interface Projectile {
  sprite: Phaser.GameObjects.Arc;
  targetX: number;
  targetY: number;
  speed: number;
  active: boolean;
  onHit?: () => void;
}

const MAX_PROJECTILES = 100;

export class ProjectilePool {
  private scene: Phaser.Scene;
  private pool: Projectile[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  fire(fromX: number, fromY: number, toX: number, toY: number, color = 0xffff00, onHit?: () => void): void {
    // Reuse inactive projectile or create new
    let proj = this.pool.find((p) => !p.active);

    if (!proj && this.pool.length < MAX_PROJECTILES) {
      const sprite = this.scene.add.circle(fromX, fromY, 3, color);
      sprite.setDepth(15);
      proj = { sprite, targetX: toX, targetY: toY, speed: 600, active: false };
      this.pool.push(proj);
    }

    if (!proj) return; // pool exhausted

    proj.sprite.setPosition(fromX, fromY);
    proj.sprite.setFillStyle(color);
    proj.sprite.setVisible(true);
    proj.targetX = toX;
    proj.targetY = toY;
    proj.active = true;
    proj.onHit = onHit;
  }

  update(dt: number): void {
    for (const proj of this.pool) {
      if (!proj.active) continue;

      const dx = proj.targetX - proj.sprite.x;
      const dy = proj.targetY - proj.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        proj.active = false;
        proj.sprite.setVisible(false);
        proj.onHit?.();
        continue;
      }

      const moveSpeed = proj.speed * dt;
      const ratio = moveSpeed / dist;
      proj.sprite.x += dx * ratio;
      proj.sprite.y += dy * ratio;
    }
  }

  destroy(): void {
    this.pool.forEach((p) => p.sprite.destroy());
    this.pool = [];
  }
}
```

**Step 2: Commit**

```bash
git add packages/client/src/effects/ProjectilePool.ts
git commit -m "feat: add projectile pool for tower attack visuals"
```

---

## Phase 5: Networking — Client-Server Integration

### Task 18: Socket.IO Server Setup

**Parallel:** yes (with Task 19)
**Blocked by:** Task 12
**Owned files:** `packages/server/src/index.ts`, `packages/server/src/networking/SocketServer.ts`, `packages/server/src/networking/SocketServer.test.ts`

**Files:**
- Modify: `packages/server/src/index.ts`
- Create: `packages/server/src/networking/SocketServer.ts`
- Create: `packages/server/src/networking/SocketServer.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/networking/SocketServer.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as clientIO, Socket as ClientSocket } from 'socket.io-client';
import { SocketServer } from './SocketServer';

describe('SocketServer', () => {
  let httpServer: ReturnType<typeof createServer>;
  let socketServer: SocketServer;
  let clientSocket: ClientSocket;
  const PORT = 3099;

  beforeEach(async () => {
    httpServer = createServer();
    socketServer = new SocketServer(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(PORT, resolve));
  });

  afterEach(async () => {
    clientSocket?.disconnect();
    socketServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('accepts a connection and creates a game room', async () => {
    clientSocket = clientIO(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => clientSocket.on('connect', resolve));
    expect(clientSocket.connected).toBe(true);
  });

  it('handles join_game command', async () => {
    clientSocket = clientIO(`http://localhost:${PORT}`);
    await new Promise<void>((resolve) => clientSocket.on('connect', resolve));

    const response = await new Promise<any>((resolve) => {
      clientSocket.emit('command', { type: 'join_game', playerName: 'Trey' }, resolve);
    });
    expect(response.ok).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/server && pnpm test -- --run src/networking/SocketServer.test.ts`
Expected: FAIL

**Step 3: Implement SocketServer**

```typescript
// packages/server/src/networking/SocketServer.ts
import { Server, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { GameSimulation } from '../game/GameSimulation';
import { GameLoop } from '../game/GameLoop';
import type { ClientCommand, GameState } from '@td/shared';
import { SNAPSHOT_INTERVAL_MS } from '@td/shared';

export class SocketServer {
  private io: Server;
  private simulations: Map<string, GameSimulation> = new Map();
  private loops: Map<string, GameLoop> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket): void {
    let roomId = 'default';
    let playerId = socket.id;

    socket.on('command', (cmd: ClientCommand, ack?: (response: any) => void) => {
      const sim = this.getOrCreateSimulation(roomId);

      switch (cmd.type) {
        case 'join_game': {
          const result = sim.addPlayer(playerId, cmd.playerName);
          socket.join(roomId);
          ack?.({ ok: result.ok ?? true });
          this.broadcastSnapshot(roomId, sim);
          break;
        }
        case 'select_class': {
          const result = sim.selectClass(playerId, cmd.elementClass);
          ack?.({ ok: result.ok });
          this.broadcastSnapshot(roomId, sim);
          break;
        }
        case 'ready_up': {
          sim.readyUp(playerId);
          ack?.({ ok: true });

          // Check if all players ready — start game
          const state = sim.state;
          const allReady = Object.values(state.players).every((p) => p.ready && p.elementClass);
          if (allReady && Object.keys(state.players).length > 0) {
            sim.startGame();
            this.startGameLoop(roomId, sim);
          }
          this.broadcastSnapshot(roomId, sim);
          break;
        }
        case 'place_tower': {
          const result = sim.placeTower(playerId, cmd.configId, cmd.x, cmd.y);
          ack?.({ ok: result.ok, reason: result.reason });
          if (result.ok) this.broadcastSnapshot(roomId, sim);
          break;
        }
        case 'start_wave': {
          sim.startWave();
          ack?.({ ok: true });
          this.broadcastSnapshot(roomId, sim);
          break;
        }
        default:
          ack?.({ ok: false, reason: 'Unknown command' });
      }
    });

    socket.on('disconnect', () => {
      const sim = this.simulations.get(roomId);
      if (sim) {
        sim.removePlayer(playerId);
        this.broadcastSnapshot(roomId, sim);
      }
    });
  }

  private getOrCreateSimulation(roomId: string): GameSimulation {
    if (!this.simulations.has(roomId)) {
      this.simulations.set(roomId, GameSimulation.create(roomId));
    }
    return this.simulations.get(roomId)!;
  }

  private startGameLoop(roomId: string, sim: GameSimulation): void {
    if (this.loops.has(roomId)) return;

    let snapshotAccumulator = 0;

    const loop = new GameLoop((dt) => {
      sim.tick(dt);
      snapshotAccumulator += dt * 1000;

      if (snapshotAccumulator >= SNAPSHOT_INTERVAL_MS) {
        snapshotAccumulator -= SNAPSHOT_INTERVAL_MS;
        this.broadcastSnapshot(roomId, sim);
      }
    });

    this.loops.set(roomId, loop);
    loop.start();
  }

  private broadcastSnapshot(roomId: string, sim: GameSimulation): void {
    this.io.to(roomId).emit('snapshot', sim.state);
  }

  close(): void {
    for (const loop of this.loops.values()) loop.stop();
    this.loops.clear();
    this.io.close();
  }
}
```

**Step 4: Update server entry point**

```typescript
// packages/server/src/index.ts
import { createServer } from 'http';
import { SocketServer } from './networking/SocketServer';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const httpServer = createServer();
const socketServer = new SocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Tower Defense Server listening on port ${PORT}`);
});

process.on('SIGINT', () => {
  socketServer.close();
  process.exit(0);
});
```

**Step 5: Install socket.io-client as dev dependency for tests**

Run: `cd packages/server && pnpm add -D socket.io-client`

**Step 6: Run tests to verify they pass**

Run: `cd packages/server && pnpm test -- --run src/networking/SocketServer.test.ts`
Expected: all tests PASS

**Step 7: Commit**

```bash
git add packages/server/src/networking/ packages/server/src/index.ts packages/server/package.json
git commit -m "feat: add Socket.IO server with command handling and snapshot broadcasting"
```

---

### Task 19: Client Network Manager

**Parallel:** yes (with Task 18)
**Blocked by:** Task 13
**Owned files:** `packages/client/src/networking/NetworkManager.ts`

**Files:**
- Create: `packages/client/src/networking/NetworkManager.ts`

**Step 1: Create NetworkManager**

```typescript
// packages/client/src/networking/NetworkManager.ts
import { io, Socket } from 'socket.io-client';
import type { ClientCommand, GameState } from '@td/shared';

type SnapshotCallback = (state: GameState) => void;

export class NetworkManager {
  private socket: Socket | null = null;
  private onSnapshot: SnapshotCallback | null = null;
  private serverUrl: string;

  constructor(serverUrl = 'http://localhost:3001') {
    this.serverUrl = serverUrl;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('Connected to server:', this.socket!.id);
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        console.error('Connection error:', err.message);
        reject(err);
      });

      this.socket.on('snapshot', (state: GameState) => {
        this.onSnapshot?.(state);
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('Disconnected:', reason);
      });
    });
  }

  onGameSnapshot(callback: SnapshotCallback): void {
    this.onSnapshot = callback;
  }

  sendCommand(command: ClientCommand): Promise<any> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ ok: false, reason: 'Not connected' });
        return;
      }
      this.socket.emit('command', command, (response: any) => {
        resolve(response);
      });
    });
  }

  joinGame(playerName: string) {
    return this.sendCommand({ type: 'join_game', playerName });
  }

  selectClass(elementClass: any) {
    return this.sendCommand({ type: 'select_class', elementClass });
  }

  readyUp() {
    return this.sendCommand({ type: 'ready_up' });
  }

  placeTower(configId: string, x: number, y: number) {
    return this.sendCommand({ type: 'place_tower', configId, x, y });
  }

  startWave() {
    return this.sendCommand({ type: 'start_wave' });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  get socketId(): string | undefined {
    return this.socket?.id;
  }
}
```

**Step 2: Commit**

```bash
git add packages/client/src/networking/
git commit -m "feat: add client network manager with Socket.IO connection"
```

---

### Task 20: Client-Side State Interpolation

**Parallel:** no
**Blocked by:** Task 19, Task 13
**Owned files:** `packages/client/src/networking/StateInterpolator.ts`, `packages/client/src/networking/StateInterpolator.test.ts`

**Files:**
- Create: `packages/client/src/networking/StateInterpolator.ts`
- Create: `packages/client/src/networking/StateInterpolator.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/client/src/networking/StateInterpolator.test.ts
import { describe, it, expect } from 'vitest';
import { StateInterpolator } from './StateInterpolator';
import type { EnemyState } from '@td/shared';

function makeEnemy(x: number, y: number): EnemyState {
  return {
    instanceId: 'e1', type: 'grunt', hp: 100, maxHp: 100,
    speed: 1, armor: 0, x, y, waypointIndex: 0, progress: 0,
    statuses: [], alive: true,
  };
}

describe('StateInterpolator', () => {
  it('returns current position if no previous state', () => {
    const interp = new StateInterpolator();
    interp.pushSnapshot({ enemies: { e1: makeEnemy(5, 5) } } as any, 0);
    const pos = interp.getEnemyPosition('e1', 0);
    expect(pos).toEqual({ x: 5, y: 5 });
  });

  it('interpolates between two snapshots', () => {
    const interp = new StateInterpolator();
    interp.pushSnapshot({ enemies: { e1: makeEnemy(0, 5) } } as any, 0);
    interp.pushSnapshot({ enemies: { e1: makeEnemy(10, 5) } } as any, 250);
    // At time 125ms (halfway between snapshots)
    const pos = interp.getEnemyPosition('e1', 125);
    expect(pos!.x).toBeCloseTo(5, 0);
    expect(pos!.y).toBeCloseTo(5, 0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/client && pnpm test -- --run src/networking/StateInterpolator.test.ts`
Expected: FAIL

**Step 3: Implement StateInterpolator**

```typescript
// packages/client/src/networking/StateInterpolator.ts
import type { GameState, Vec2 } from '@td/shared';
import { SNAPSHOT_INTERVAL_MS } from '@td/shared';

interface TimedSnapshot {
  state: GameState;
  timestamp: number;
}

export class StateInterpolator {
  private snapshots: TimedSnapshot[] = [];
  private maxSnapshots = 3;

  pushSnapshot(state: GameState, timestamp: number): void {
    this.snapshots.push({ state, timestamp });
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  getEnemyPosition(instanceId: string, currentTime: number): Vec2 | null {
    if (this.snapshots.length === 0) return null;

    if (this.snapshots.length === 1) {
      const enemy = this.snapshots[0].state.enemies[instanceId];
      return enemy ? { x: enemy.x, y: enemy.y } : null;
    }

    const prev = this.snapshots[this.snapshots.length - 2];
    const curr = this.snapshots[this.snapshots.length - 1];

    const prevEnemy = prev.state.enemies[instanceId];
    const currEnemy = curr.state.enemies[instanceId];

    if (!currEnemy) return null;
    if (!prevEnemy) return { x: currEnemy.x, y: currEnemy.y };

    const elapsed = currentTime - prev.timestamp;
    const interval = curr.timestamp - prev.timestamp;
    const t = interval > 0 ? Math.min(1, elapsed / interval) : 1;

    return {
      x: prevEnemy.x + (currEnemy.x - prevEnemy.x) * t,
      y: prevEnemy.y + (currEnemy.y - prevEnemy.y) * t,
    };
  }

  getLatestState(): GameState | null {
    if (this.snapshots.length === 0) return null;
    return this.snapshots[this.snapshots.length - 1].state;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/client && pnpm test -- --run src/networking/StateInterpolator.test.ts`
Expected: all tests PASS

**Step 5: Commit**

```bash
git add packages/client/src/networking/StateInterpolator.ts packages/client/src/networking/StateInterpolator.test.ts
git commit -m "feat: add client-side state interpolation for smooth enemy movement"
```

---

### Task 21: Wire Client Scenes to Network

**Parallel:** no
**Blocked by:** Task 18, Task 19, Task 20, Task 13
**Owned files:** `packages/client/src/GameClient.ts`

**Files:**
- Create: `packages/client/src/GameClient.ts`
- Modify: `packages/client/src/main.ts`

**Step 1: Create GameClient (wires network to scenes)**

```typescript
// packages/client/src/GameClient.ts
import { NetworkManager } from './networking/NetworkManager';
import { StateInterpolator } from './networking/StateInterpolator';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import type { GameState, ElementType } from '@td/shared';
import { TILE_SIZE } from '@td/shared';

export class GameClient {
  private network: NetworkManager;
  private interpolator: StateInterpolator;
  private gameScene: GameScene | null = null;
  private hudScene: HudScene | null = null;
  private selectedTowerId: string | null = null;

  constructor(serverUrl?: string) {
    this.network = new NetworkManager(serverUrl);
    this.interpolator = new StateInterpolator();
  }

  async connect(playerName: string): Promise<void> {
    await this.network.connect();
    await this.network.joinGame(playerName);

    this.network.onGameSnapshot((state: GameState) => {
      this.interpolator.pushSnapshot(state, performance.now());
      this.hudScene?.syncState(state);
      this.gameScene?.syncState(state);
    });
  }

  bindScenes(gameScene: GameScene, hudScene: HudScene): void {
    this.gameScene = gameScene;
    this.hudScene = hudScene;

    gameScene.events.on('tile-clicked', async (tileX: number, tileY: number) => {
      if (this.selectedTowerId) {
        const result = await this.network.placeTower(this.selectedTowerId, tileX, tileY);
        if (!result.ok) {
          console.warn('Placement rejected:', result.reason);
        }
      }
    });
  }

  async selectClass(elementClass: ElementType): Promise<void> {
    await this.network.selectClass(elementClass);
  }

  async readyUp(): Promise<void> {
    await this.network.readyUp();
  }

  async startWave(): Promise<void> {
    await this.network.startWave();
  }

  selectTower(configId: string): void {
    this.selectedTowerId = configId;
  }

  clearTowerSelection(): void {
    this.selectedTowerId = null;
  }

  getLatestState(): GameState | null {
    return this.interpolator.getLatestState();
  }

  disconnect(): void {
    this.network.disconnect();
  }
}
```

**Step 2: Update main.ts to initialize GameClient**

```typescript
// packages/client/src/main.ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { GameClient } from './GameClient';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scene: [BootScene, GameScene, HudScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

// Initialize client after scenes are ready
game.events.once('ready', () => {
  const gameScene = game.scene.getScene('GameScene') as GameScene;
  const hudScene = game.scene.getScene('HudScene') as HudScene;

  const client = new GameClient();

  // Expose client globally for dev console debugging
  (window as any).__gameClient = client;

  client.connect('Player').then(() => {
    client.bindScenes(gameScene, hudScene);
    console.log('Game client connected and bound to scenes');
  }).catch((err) => {
    console.error('Failed to connect:', err);
  });
});
```

**Step 3: Commit**

```bash
git add packages/client/src/GameClient.ts packages/client/src/main.ts
git commit -m "feat: wire client scenes to network with GameClient orchestrator"
```

---

## Phase 6: Game Content — Data & Balancing

### Task 22: Tower Configuration Data

**Parallel:** yes (with Task 23, 24)
**Blocked by:** Task 8
**Owned files:** `packages/shared/src/data/towers.ts`

**Files:**
- Create: `packages/shared/src/data/towers.ts`

**Step 1: Create comprehensive tower configs**

Create all tower configs for v0.1 MVP: 4 shared basic towers + 2-3 specialty towers per element (8-12 specialty towers). Each must include full stat blocks: id, name, class, category, roles, costGold, range, attackPeriodSec, baseDamage, splashRadius (if applicable), onHit effects, targets, and upgrades (3 tiers).

Reference the design spec section "Tower System" for exact tower names and abilities. All towers from the "Shared Basic Towers" and "Class Specialty Towers" sections should be included.

Key data points per tower:
- Arrow Tower: 50g, range 3, 1.0s period, 10 dmg, ground
- Ballista: 100g, range 4, 2.0s period, 40 dmg, both
- Scout Tower: 60g, range 5, N/A (reveal only), both
- Flame Spire: 120g, range 3.5, 1.2s period, 22 dmg, splash 1.5, burn DoT
- Tidal Tower: 100g, range 3, 1.0s period, 15 dmg, applies Soaked AoE
- Frost Turret: 110g, range 3, 1.0s period, 12 dmg, stacking Cold
- Venom Spitter: 90g, range 3, 0.8s period, 8 dmg, stacking Toxin DoT
- (etc. for all specialty towers)

**Step 2: Commit**

```bash
git add packages/shared/src/data/towers.ts
git commit -m "feat: add complete tower configuration data for v0.1"
```

---

### Task 23: Wave Configuration Data (15-20 waves)

**Parallel:** yes (with Task 22, 24)
**Blocked by:** Task 7
**Owned files:** `packages/shared/src/data/waves.ts`

**Files:**
- Create: `packages/shared/src/data/waves.ts`

**Step 1: Create 20 waves**

Design waves following spec milestones:
- Waves 1-3: Grunts only, teach basics
- Wave 4-5: Introduce Runners (fast, low HP)
- Wave 5: First lumber grant moment
- Wave 6-9: Mix of Grunts + Runners, increasing HP
- Wave 10: Tag-check wave (first Flyers — anti-air required)
- Wave 11-14: Mix with Tanks introduced (high HP, slow)
- Wave 15: BOSS wave (single high-HP boss with abilities)
- Wave 16-17: Invisible enemies introduced
- Wave 18-19: Multi-type waves (Grunts + Runners + Tanks)
- Wave 20: Final boss wave

HP scaling formula: `base_HP * (1 + 0.15 * wave_number)`
Speed: grunts 1.0, runners 1.8, tanks 0.6, flyers 1.2, invisible 1.0, boss 0.4

**Step 2: Commit**

```bash
git add packages/shared/src/data/waves.ts
git commit -m "feat: add 20-wave configuration with escalating difficulty"
```

---

### Task 24: Map Configuration Data

**Parallel:** yes (with Task 22, 23)
**Blocked by:** Task 3
**Owned files:** `packages/shared/src/data/maps.ts`

**Files:**
- Create: `packages/shared/src/data/maps.ts`

**Step 1: Create Forest Path map**

Design a single map (20x15 tile grid) with:
- Winding path using 8-10 waypoints
- 6 build zones (2 per player zone, 3 player zones)
- Player zone 0: always active (1+ players), zones along first path segment
- Player zone 1: active with 2+ players, zones along middle segment
- Player zone 2: active with 3+ players, zones along final segment
- Path should wind enough to give towers multiple firing windows

**Step 2: Create reaction configs as shared data**

Move reaction configs from server defaults into shared data. Add all 4 MVP reactions (Vaporize, Freeze, Melt, Conflagration) with tuned values.

**Step 3: Create class configs**

Define the 4 elemental classes with passive effects matching the design spec.

**Step 4: Commit**

```bash
git add packages/shared/src/data/
git commit -m "feat: add map, reaction, and class configuration data"
```

---

### Task 25: Update Server Defaults to Use Shared Data

**Parallel:** no
**Blocked by:** Task 22, Task 23, Task 24
**Owned files:** `packages/server/src/data/defaults.ts`

**Files:**
- Modify: `packages/server/src/data/defaults.ts`

**Step 1: Replace stub data with imports from shared package**

Update `getDefaultTowerConfigs()`, `getDefaultWaveConfigs()`, `getDefaultMap()`, and `getDefaultReactionConfigs()` to import and return the real data from `@td/shared/data/*`.

**Step 2: Run all server tests**

Run: `cd packages/server && pnpm test`
Expected: all tests PASS

**Step 3: Commit**

```bash
git add packages/server/src/data/defaults.ts
git commit -m "refactor: wire server to shared game content data"
```

---

## Phase 7: Audio, Polish & Lobby

### Task 26: Audio System

**Parallel:** yes (with Task 27)
**Blocked by:** Task 13
**Owned files:** `packages/client/src/audio/AudioManager.ts`, `packages/client/src/audio/AudioManager.test.ts`

**Files:**
- Create: `packages/client/src/audio/AudioManager.ts`
- Create: `packages/client/src/audio/AudioManager.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/client/src/audio/AudioManager.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioManager } from './AudioManager';

// Mock Phaser.Sound since we are in jsdom
describe('AudioManager', () => {
  let manager: AudioManager;

  beforeEach(() => {
    manager = new AudioManager();
  });

  it('registers sound categories', () => {
    manager.registerCategory('reactions', 1.0);
    manager.registerCategory('towers', 0.8);
    expect(manager.getVolume('reactions')).toBe(1.0);
    expect(manager.getVolume('towers')).toBe(0.8);
  });

  it('adjusts category volume', () => {
    manager.registerCategory('sfx', 1.0);
    manager.setVolume('sfx', 0.5);
    expect(manager.getVolume('sfx')).toBe(0.5);
  });

  it('clamps volume to 0-1', () => {
    manager.registerCategory('sfx', 1.0);
    manager.setVolume('sfx', 1.5);
    expect(manager.getVolume('sfx')).toBe(1.0);
    manager.setVolume('sfx', -0.5);
    expect(manager.getVolume('sfx')).toBe(0.0);
  });

  it('applies master volume multiplier', () => {
    manager.registerCategory('sfx', 0.8);
    manager.setMasterVolume(0.5);
    expect(manager.getEffectiveVolume('sfx')).toBeCloseTo(0.4);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/client && pnpm test -- --run src/audio/AudioManager.test.ts`
Expected: FAIL

**Step 3: Implement AudioManager**

```typescript
// packages/client/src/audio/AudioManager.ts
export class AudioManager {
  private categories: Map<string, number> = new Map();
  private masterVolume = 1.0;
  private scene: any | null = null; // Phaser.Scene

  registerCategory(name: string, defaultVolume = 1.0): void {
    this.categories.set(name, Math.min(1, Math.max(0, defaultVolume)));
  }

  bindScene(scene: any): void {
    this.scene = scene;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.min(1, Math.max(0, volume));
  }

  setVolume(category: string, volume: number): void {
    if (!this.categories.has(category)) return;
    this.categories.set(category, Math.min(1, Math.max(0, volume)));
  }

  getVolume(category: string): number {
    return this.categories.get(category) ?? 0;
  }

  getEffectiveVolume(category: string): number {
    return this.getVolume(category) * this.masterVolume;
  }

  play(key: string, category: string): void {
    if (!this.scene) return;
    const volume = this.getEffectiveVolume(category);
    try {
      this.scene.sound.play(key, { volume });
    } catch {
      // Sound not loaded — skip silently in dev
    }
  }

  playReaction(reactionType: string): void {
    this.play(`sfx_${reactionType}`, 'reactions');
  }

  playTowerAttack(towerClass: string): void {
    this.play(`sfx_attack_${towerClass}`, 'towers');
  }

  playUI(key: string): void {
    this.play(key, 'ui');
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/client && pnpm test -- --run src/audio/AudioManager.test.ts`
Expected: all tests PASS

**Step 5: Commit**

```bash
git add packages/client/src/audio/
git commit -m "feat: add audio manager with category volume control"
```

---

### Task 27: Lobby & Class Selection Scene

**Parallel:** yes (with Task 26)
**Blocked by:** Task 13, Task 19
**Owned files:** `packages/client/src/scenes/LobbyScene.ts`, `packages/client/src/scenes/ClassSelectScene.ts`

**Files:**
- Create: `packages/client/src/scenes/LobbyScene.ts`
- Create: `packages/client/src/scenes/ClassSelectScene.ts`
- Modify: `packages/client/src/scenes/BootScene.ts` (start LobbyScene instead of GameScene)

**Step 1: Create LobbyScene**

```typescript
// packages/client/src/scenes/LobbyScene.ts
import Phaser from 'phaser';

export class LobbyScene extends Phaser.Scene {
  private playerNameInput: string = 'Player';
  private roomCodeText!: Phaser.GameObjects.Text;
  private playersListText!: Phaser.GameObjects.Text;
  private joinButton!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this.add.text(cx, 80, 'TOWER DEFENSE', {
      fontSize: '48px', color: '#ffcc00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, 140, 'Co-op Elemental TD', {
      fontSize: '20px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Room code display
    this.roomCodeText = this.add.text(cx, 220, 'Room: default', {
      fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Player list
    this.playersListText = this.add.text(cx, 300, 'Waiting for players...', {
      fontSize: '14px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Join button
    this.joinButton = this.add.text(cx, 450, '[ JOIN GAME ]', {
      fontSize: '24px', color: '#00ff88', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.joinButton.on('pointerdown', () => {
      this.events.emit('join-requested', this.playerNameInput);
    });

    this.joinButton.on('pointerover', () => this.joinButton.setColor('#88ffcc'));
    this.joinButton.on('pointerout', () => this.joinButton.setColor('#00ff88'));
  }

  updatePlayersList(players: { name: string; elementClass: string | null }[]): void {
    const lines = players.map(
      (p) => `${p.name} ${p.elementClass ? `(${p.elementClass})` : '(choosing...)'}`,
    );
    this.playersListText.setText(lines.join('\n'));
  }

  transitionToClassSelect(): void {
    this.scene.start('ClassSelectScene');
  }
}
```

**Step 2: Create ClassSelectScene**

```typescript
// packages/client/src/scenes/ClassSelectScene.ts
import Phaser from 'phaser';
import type { ElementType } from '@td/shared';

const CLASSES: { id: ElementType; name: string; color: number; description: string }[] = [
  { id: 'fire', name: 'Fire', color: 0xff4400, description: 'AoE burst damage, burn DoT' },
  { id: 'water', name: 'Water', color: 0x0088ff, description: 'Utility, pushback, reaction enabler' },
  { id: 'ice', name: 'Ice', color: 0x88ccff, description: 'Hard crowd control, freeze + shatter' },
  { id: 'poison', name: 'Poison', color: 0x44cc44, description: 'Attrition DoT, debuffs, area denial' },
];

export class ClassSelectScene extends Phaser.Scene {
  private selectedClass: ElementType | null = null;

  constructor() {
    super({ key: 'ClassSelectScene' });
  }

  create(): void {
    const cx = this.cameras.main.centerX;

    this.add.text(cx, 60, 'Choose Your Element', {
      fontSize: '32px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    CLASSES.forEach((cls, i) => {
      const x = 160 + i * 250;
      const y = 300;

      const bg = this.add.rectangle(x, y, 200, 250, cls.color, 0.3);
      bg.setStrokeStyle(2, cls.color);
      bg.setInteractive({ useHandCursor: true });

      this.add.text(x, y - 80, cls.name, {
        fontSize: '24px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);

      this.add.text(x, y + 20, cls.description, {
        fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
        wordWrap: { width: 180 }, align: 'center',
      }).setOrigin(0.5);

      bg.on('pointerdown', () => {
        this.selectedClass = cls.id;
        this.events.emit('class-selected', cls.id);
      });

      bg.on('pointerover', () => bg.setFillStyle(cls.color, 0.5));
      bg.on('pointerout', () => bg.setFillStyle(cls.color, 0.3));
    });

    // Ready button
    const readyBtn = this.add.text(cx, 520, '[ READY ]', {
      fontSize: '24px', color: '#00ff88', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    readyBtn.on('pointerdown', () => {
      if (this.selectedClass) {
        this.events.emit('ready-up');
      }
    });
  }
}
```

**Step 3: Update BootScene to start LobbyScene**

Change `this.scene.start('GameScene')` to `this.scene.start('LobbyScene')`.

**Step 4: Commit**

```bash
git add packages/client/src/scenes/LobbyScene.ts packages/client/src/scenes/ClassSelectScene.ts packages/client/src/scenes/BootScene.ts
git commit -m "feat: add lobby and class selection scenes"
```

---

### Task 28: Game HUD Enhancements

**Parallel:** no
**Blocked by:** Task 13, Task 14
**Owned files:** `packages/client/src/scenes/HudScene.ts` (modify)

**Files:**
- Modify: `packages/client/src/scenes/HudScene.ts`

**Step 1: Enhance HUD with tower panel, wave controls, player list**

Extend HudScene to include:
- Tower selection panel (right side)
- "Start Wave" button (visible during prep phase)
- Prep phase countdown timer
- Player list with class icons
- Base HP bar (prominent, center-top)
- Wave telegraph message (shows incoming enemy types)

**Step 2: Run typecheck**

Run: `cd packages/client && pnpm typecheck`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/client/src/scenes/HudScene.ts
git commit -m "feat: enhance HUD with tower panel, wave controls, and player list"
```

---

### Task 29: Prep Phase & Combat Phase Flow

**Parallel:** no
**Blocked by:** Task 21, Task 28
**Owned files:** `packages/client/src/GameClient.ts` (modify), `packages/client/src/scenes/GameScene.ts` (modify)

**Files:**
- Modify: `packages/client/src/GameClient.ts`
- Modify: `packages/client/src/scenes/GameScene.ts`

**Step 1: Wire phase transitions in GameClient**

When snapshot arrives with phase change:
- `lobby` -> Show LobbyScene
- `class_select` -> Show ClassSelectScene
- `prep` -> Show GameScene + HudScene, render map, enable tower placement, show prep timer
- `combat` -> Disable tower placement, show wave info, update enemy rendering each frame
- `post_wave` -> Show wave cleared message, transition to prep
- `victory` -> Show victory screen
- `defeat` -> Show defeat screen

**Step 2: Wire map rendering on first prep phase**

When transitioning to `prep` for wave 1, call `gameScene.renderMap()` with the map config from the server snapshot (or from shared data).

**Step 3: Run client dev server and verify phase flow visually**

Run: `pnpm dev` (both server and client)
Expected: Can see lobby -> class select -> prep -> combat flow in browser

**Step 4: Commit**

```bash
git add packages/client/src/GameClient.ts packages/client/src/scenes/GameScene.ts
git commit -m "feat: wire game phase transitions through lobby, prep, and combat"
```

---

## Phase 8: Integration Testing & Playtesting

### Task 30: End-to-End Integration Tests

**Parallel:** no
**Blocked by:** All previous tasks
**Owned files:** `packages/server/src/__tests__/integration.test.ts`

**Files:**
- Create: `packages/server/src/__tests__/integration.test.ts`

**Step 1: Write integration tests**

```typescript
// packages/server/src/__tests__/integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { io as clientIO, Socket as ClientSocket } from 'socket.io-client';
import { SocketServer } from '../networking/SocketServer';

const PORT = 3098;

describe('Integration: Full Game Flow', () => {
  let httpServer: ReturnType<typeof createServer>;
  let socketServer: SocketServer;
  let player1: ClientSocket;
  let player2: ClientSocket;

  beforeEach(async () => {
    httpServer = createServer();
    socketServer = new SocketServer(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(PORT, resolve));

    player1 = clientIO(`http://localhost:${PORT}`);
    player2 = clientIO(`http://localhost:${PORT}`);

    await Promise.all([
      new Promise<void>((r) => player1.on('connect', r)),
      new Promise<void>((r) => player2.on('connect', r)),
    ]);
  });

  afterEach(async () => {
    player1?.disconnect();
    player2?.disconnect();
    socketServer.close();
    await new Promise<void>((r) => httpServer.close(() => r()));
  });

  it('two players can join, select classes, and start a game', async () => {
    const join1 = await emitCommand(player1, { type: 'join_game', playerName: 'Trey' });
    expect(join1.ok).toBe(true);

    const join2 = await emitCommand(player2, { type: 'join_game', playerName: 'Matt' });
    expect(join2.ok).toBe(true);

    await emitCommand(player1, { type: 'select_class', elementClass: 'fire' });
    await emitCommand(player2, { type: 'select_class', elementClass: 'ice' });

    await emitCommand(player1, { type: 'ready_up' });

    // Wait for snapshot with prep phase after both ready
    const snapshot = await new Promise<any>((resolve) => {
      player2.on('snapshot', (state) => {
        if (state.phase !== 'lobby' && state.phase !== 'class_select') resolve(state);
      });
      emitCommand(player2, { type: 'ready_up' });
    });

    expect(snapshot.phase).toBe('prep');
    expect(snapshot.economy.gold).toBeGreaterThan(0);
  });

  it('player can place a tower during prep phase', async () => {
    // Setup: join and start game
    await emitCommand(player1, { type: 'join_game', playerName: 'Trey' });
    await emitCommand(player1, { type: 'select_class', elementClass: 'fire' });
    await emitCommand(player1, { type: 'ready_up' });

    // Wait for prep phase
    await waitForPhase(player1, 'prep');

    const result = await emitCommand(player1, {
      type: 'place_tower', configId: 'arrow_tower', x: 3, y: 4,
    });
    expect(result.ok).toBe(true);
  });

  it('game progresses through combat when wave starts', async () => {
    await emitCommand(player1, { type: 'join_game', playerName: 'Trey' });
    await emitCommand(player1, { type: 'select_class', elementClass: 'fire' });
    await emitCommand(player1, { type: 'ready_up' });

    await waitForPhase(player1, 'prep');

    await emitCommand(player1, { type: 'start_wave' });

    const combatSnapshot = await waitForPhase(player1, 'combat');
    expect(combatSnapshot.wave).toBe(1);
  });
});

function emitCommand(socket: ClientSocket, cmd: any): Promise<any> {
  return new Promise((resolve) => {
    socket.emit('command', cmd, resolve);
  });
}

function waitForPhase(socket: ClientSocket, phase: string): Promise<any> {
  return new Promise((resolve) => {
    const handler = (state: any) => {
      if (state.phase === phase) {
        socket.off('snapshot', handler);
        resolve(state);
      }
    };
    socket.on('snapshot', handler);
  });
}
```

**Step 2: Run integration tests**

Run: `cd packages/server && pnpm test -- --run src/__tests__/integration.test.ts`
Expected: all tests PASS

**Step 3: Run all tests across all packages**

Run: `pnpm test`
Expected: all tests PASS across shared, server, and client

**Step 4: Commit**

```bash
git add packages/server/src/__tests__/
git commit -m "test: add end-to-end integration tests for full game flow"
```

---

## Team Assignment Recommendation (v0.1)

### Trey — Server Lead
- **Tasks:** 4, 5, 6, 7, 8, 10, 11, 12, 18, 25, 30
- **Focus:** All server-side game logic, game simulation, Socket.IO server, integration tests

### Matt — Client Lead
- **Tasks:** 13, 14, 15, 16, 17, 19, 20, 21, 27, 28, 29
- **Focus:** All Phaser scenes, UI components, networking client, scene wiring

### Milk — Shared & Data Lead
- **Tasks:** 1, 2, 3, 9, 22, 23, 24, 26
- **Focus:** Monorepo setup, shared types, enemy system, all game content data, audio system

### Parallelization Opportunities

These task groups can run in parallel across developers:

| Parallel Group | Tasks | Developers |
|---|---|---|
| Scaffolding | 1 + 2 + 3 | All three simultaneously |
| Server core | 4+5+6+7 (sequential per dev) | Trey |
| Client core | 13+14+15 (parallel) | Matt |
| Server combat | 8 (Trey) + 9 (Milk) | Parallel |
| Game data | 22+23+24 (parallel) | Milk |
| Networking | 18 (Trey) + 19 (Matt) | Parallel |
| Audio + Lobby | 26 (Milk) + 27 (Matt) | Parallel |

---

## v0.2 Outline (Higher-Level)

> These tasks are intentionally less detailed. Full step-by-step plans should be written when v0.1 is complete and playtested.

### v0.2 Goals
- Lumber economy + builder unlock pacing
- Heroes (4 heroes, 2 abilities each)
- Hybrid towers (3-5)
- Full 30-wave campaign
- 5-6 player support
- Proximity bonuses + chain triggers
- Tower transfer mechanic

### v0.2 Task Blocks

**Block A: Lumber Economy (3-4 tasks)**
- Add lumber to EconomySystem (grant every 5 waves)
- Add lumber cost field to tower configs for ultimate/advanced towers
- Add builder tier unlock system (spend lumber to unlock tower tiers)
- Update HUD to show lumber, builder tier

**Block B: Hero System (5-6 tasks)**
- Define HeroConfig type in shared (id, class, abilities, stats, levels)
- Create HeroSystem on server (purchase, positioning, auto-attack, leveling)
- Create hero ability system with cooldowns and targeting
- Create 4 hero data configs (Flame Warden, Tidecaller, Frostguard, Plague Doctor)
- Render heroes on client (sprite, ability buttons, cooldown UI)
- Wire hero abilities to server commands and client input

**Block C: Hybrid Towers (2-3 tasks)**
- Define hybrid tower requirements (two elements must be present on team)
- Create 3-5 hybrid tower configs (Steamworks, Frostfire Beacon, Toxic Geyser, etc.)
- Add hybrid tower unlock validation to TowerSystem

**Block D: Extended Content (2-3 tasks)**
- Extend wave configs to 30 waves
- Add 5-6 player zone support to maps
- Add Caster enemy type with shield/heal abilities

**Block E: Advanced Synergies (2-3 tasks)**
- Implement proximity bonus system (detect adjacent complementary towers, apply stat buffs)
- Add remaining 4 reactions (Steam Burst, Shatter, Blight, Frostburn)
- Add chain trigger detection (sequential element application along path)

**Block F: Tower Transfer (1-2 tasks)**
- Add transfer_tower command (change ownerId, small gold cost)
- Add transfer UI on client (drag tower to teammate or button)

---

## v0.3 Outline (Higher-Level)

### v0.3 Goals
- Meta-progression (account XP, class skill trees)
- Additional maps
- Ultimate towers
- Cosmetics system
- Endless mode
- Prestige challenges
- Full 50-wave campaign option

### v0.3 Task Blocks

**Block A: Meta-Progression Backend (4-5 tasks)**
- Database setup (Supabase or PlanetScale) for player accounts
- Account XP system: earn XP per wave/boss/reaction/session
- Class skill tree schema and data (60-80 nodes per class)
- Skill tree progression API (unlock nodes, apply passive bonuses)
- Session reward calculation and persistence

**Block B: Skill Tree UI (3-4 tasks)**
- Skill tree visualization scene (node graph with connections)
- Node unlock flow (click node, confirm spend, animate unlock)
- Passive bonus application to in-game towers/heroes
- Pre-game skill loadout selection

**Block C: Additional Maps (2-3 tasks)**
- Design 2-3 new map layouts with different path topologies
- Map selection in lobby
- Map-specific visual themes

**Block D: Ultimate Towers (2 tasks)**
- Define 2-3 ultimate tower configs (Elemental Nexus, Arcane Conduit, Cataclysm Engine)
- High lumber cost, late-game unlock, powerful effects

**Block E: Cosmetics & Prestige (3-4 tasks)**
- Cosmetic item schema (tower skins, projectile effects, player icons)
- Cosmetic unlocking via prestige challenges
- Cosmetic application system (client-side skin swapping)
- Prestige challenge definitions and tracking

**Block F: Endless Mode (2-3 tasks)**
- Procedural wave generation beyond wave 50 (scaling HP/speed/type mixing)
- Endless mode lobby option
- Leaderboard for highest wave reached

**Block G: Extended Campaign (1-2 tasks)**
- Extend wave configs to 50 waves
- Add wave 30-50 enemy variants and multi-tag wave compositions

---

## Dependency Graph Summary

```
Phase 1 (Tasks 1-3): Scaffolding → No dependencies
Phase 2 (Tasks 4-7): Server Core → Depends on Phase 1
Phase 3 (Tasks 8-12): Combat → Depends on Phase 2
Phase 4 (Tasks 13-17): Client → Depends on Task 3 only
Phase 5 (Tasks 18-21): Networking → Depends on Phase 3 + Phase 4
Phase 6 (Tasks 22-25): Data → Depends on relevant systems
Phase 7 (Tasks 26-29): Polish → Depends on Phase 4 + Phase 5
Phase 8 (Task 30): Integration → Depends on everything
```

```
[1,2,3] ──┬──> [4,5,6,7] ──> [8,9] ──> [10] ──> [11] ──> [12] ──> [18] ──> [21] ──> [29] ──> [30]
           │                                                          │        │
           └──> [13,14,15] ──> [16,17] ──────────────────────> [19,20]┘   [27,28]┘
           │                                                          │
           └──> [22,23,24] ──────────────────────────────────> [25]───┘
                                                                      │
                                                               [26]───┘
```
