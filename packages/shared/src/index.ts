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
export type GamePhase =
  | 'lobby'
  | 'class_select'
  | 'prep'
  | 'combat'
  | 'post_wave'
  | 'victory'
  | 'defeat';

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
  | { type: 'reconnect'; playerId: string }
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
export const MAX_PLAYERS = 4;
export const TILE_SIZE = 64;
