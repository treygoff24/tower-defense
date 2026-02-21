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
  type: 'burn_on_hit' | 'soaked_on_hit' | 'cold_on_hit' | 'toxin_on_hit';
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
  type: 'dot' | 'status' | 'pushback';
  element?: ElementType;
  dps?: number;
  durationSec?: number;
  slowPercent?: number;
  value?: number; // For effects like pushback distance
}

// ── Tower Instance (runtime state) ─────────────────────────
export type TargetingMode = 'first' | 'last' | 'strongest' | 'weakest' | 'closest';

export interface TowerState {
  instanceId: string;
  configId: string;
  ownerId: string;
  tier: number;
  x: number;
  y: number;
  currentTarget?: string;
  lastAttackTick: number;
  targetingMode?: TargetingMode;
}

// ── Enemy Types ────────────────────────────────────────────
export type EnemyType = 'grunt' | 'runner' | 'tank' | 'flyer' | 'invisible' | 'caster' | 'boss';

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
  | 'freeze'
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
  type: 'damage_multiplier' | 'apply_status' | 'aoe_burst';
  value?: number;
  aoeRadius?: number;
  durationSec?: number;
  status?: string; // For applying status effects (e.g., freeze applies 'frozen')
}

// ── Map Types ──────────────────────────────────────────────
export interface Vec2 {
  x: number;
  y: number;
}

export interface Decoration {
  x: number;
  y: number;
  type: 'tree' | 'rock' | 'bush';
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
  decorations?: Decoration[];
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
  | { type: 'set_targeting'; instanceId: string; mode: TargetingMode }
  | { type: 'start_wave' }
  | { type: 'reconnect'; playerId: string }
  | { type: 'chat'; message: string }
  | { type: 'ping'; x: number; y: number };

// Server -> Client events
export type ServerEvent =
  | { type: 'game_snapshot'; state: GameState }
  | { type: 'tower_placed'; tower: TowerState; accepted: boolean; reason?: string }
  | { type: 'tower_upgraded'; instanceId: string; newTier: number }
  | { type: 'tower_sold'; instanceId: string; goldRefund: number }
  | { type: 'enemy_damaged'; instanceId: string; damage: number; newHp: number }
  | { type: 'enemy_killed'; instanceId: string; bounty: number }
  | { type: 'reaction_triggered'; reaction: ReactionType; x: number; y: number; damage: number }
  | { type: 'tower_fired'; towerId: string; targetId: string; damage: number; element?: string; towerX: number; towerY: number; targetX: number; targetY: number }
  | { type: 'base_damaged'; damage: number; remainingHp: number }
  | { type: 'wave_started'; wave: number; telegraph: string }
  | { type: 'wave_completed'; wave: number; goldReward: number }
  | { type: 'phase_changed'; phase: GamePhase }
  | { type: 'player_joined'; player: PlayerState }
  | { type: 'player_left'; playerId: string }
  | { type: 'chat_message'; playerId: string; playerName: string; message: string }
  | { type: 'ping_marker'; playerId: string; x: number; y: number }
  | { type: 'error'; message: string };

// ── Constants ──────────────────────────────────────────────
export const ENEMY_BASE_DAMAGE: Record<EnemyType, number> = {
  grunt: 1,
  runner: 1,
  tank: 3,
  flyer: 2,
  invisible: 2,
  caster: 2,
  boss: 10,
};

export const TICK_RATE = 20; // server ticks per second
export const TICK_DURATION_MS = 1000 / TICK_RATE;
export const SNAPSHOT_INTERVAL_MS = 250;
export const PREP_PHASE_DURATION_SEC = 30;
export const BASE_MAX_HP = 100;
export const TOWER_SELL_REFUND_PERCENT = 0.5;
export const MAX_PLAYERS = 4;
export const TILE_SIZE = 64;

// ── Data Configuration Exports ─────────────────────────────
export { TOWER_CONFIGS } from './data/towers.js';
export { WAVE_CONFIGS } from './data/waves.js';
export { MAP_CONFIGS } from './data/maps.js';
export { REACTION_CONFIGS } from './data/reactions.js';
export { CLASS_CONFIGS } from './data/classes.js';
